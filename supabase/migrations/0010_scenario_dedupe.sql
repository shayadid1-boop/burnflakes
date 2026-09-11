-- 0010: guard against double-submitted scenario creation.
-- 1) remove exact duplicate drafts (same event + name, no parameter changes vs. defaults, no overrides), keeping the newest computed one
with dup as (
  select s.id,
         row_number() over (partition by s.event_id, s.name order by s.computed_at desc nulls last, s.created_at desc) as rn
  from scenarios s
  where s.status = 'draft'
    and not exists (select 1 from scenario_line_items l where l.scenario_id = s.id and l.is_override)
    and not exists (select 1 from scenario_income_lines i where i.scenario_id = s.id)
    and not exists (
      select 1 from scenario_parameter_values v join scenario_parameters p on p.id = v.parameter_id
      where v.scenario_id = s.id and v.value is distinct from p.default_value)
)
delete from scenarios where id in (select id from dup where rn > 1);

-- 2) new_scenario: if an identical request arrives within 10 seconds, return the existing draft instead of creating another
create or replace function new_scenario(p_event uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select id into v_new from scenarios
   where event_id = p_event and name = p_name and status = 'draft' and created_at > now() - interval '10 seconds'
   order by created_at desc limit 1;
  if v_new is not null then return v_new; end if;
  insert into scenarios (event_id, name, status, created_by) values (p_event, p_name, 'draft', my_event_member_id(p_event)) returning id into v_new;
  insert into scenario_parameter_values (scenario_id, parameter_id, value)
  select v_new, id, default_value from scenario_parameters;
  perform compute_scenario(v_new);
  return v_new;
end $$;
