-- w1t4/w1t5: scenario builder support — clone, safe recompute, approve
-- (found in local testing: recomputing an approved scenario broke the budget_lines FK)

alter table budget_lines drop constraint budget_lines_scenario_line_item_id_fkey;
alter table budget_lines add constraint budget_lines_scenario_line_item_id_fkey
  foreign key (scenario_line_item_id) references scenario_line_items(id) on delete set null;

-- an approved scenario is frozen: duplicate it to change it
create or replace function compute_scenario_checked(p_scenario uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_status scenario_status;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select status into v_status from scenarios where id = p_scenario;
  if v_status = 'approved' then raise exception 'scenario is approved and frozen — duplicate it to make changes'; end if;
  perform compute_scenario(p_scenario);
end $$;

-- duplicate a scenario (parameters, manual overrides, planned income) and compute it
create or replace function clone_scenario(p_source uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid; v_event uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select event_id into v_event from scenarios where id = p_source;
  insert into scenarios (event_id, name, status, cloned_from, created_by)
  values (v_event, p_name, 'draft', p_source, my_event_member_id(v_event)) returning id into v_new;
  insert into scenario_parameter_values (scenario_id, parameter_id, value)
  select v_new, parameter_id, value from scenario_parameter_values where scenario_id = p_source;
  insert into scenario_line_items (scenario_id, cost_item_id, department_id, name_he, quantity, unit_cost, is_override)
  select v_new, cost_item_id, department_id, name_he, quantity, unit_cost, true from scenario_line_items where scenario_id = p_source and is_override;
  insert into scenario_income_lines (scenario_id, fund_kind, department_id, name_he, amount, notes)
  select v_new, fund_kind, department_id, name_he, amount, notes from scenario_income_lines where scenario_id = p_source;
  perform compute_scenario(v_new);
  return v_new;
end $$;

-- new empty scenario for an event with the catalog defaults
create or replace function new_scenario(p_event uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  insert into scenarios (event_id, name, status, created_by) values (p_event, p_name, 'draft', my_event_member_id(p_event)) returning id into v_new;
  insert into scenario_parameter_values (scenario_id, parameter_id, value)
  select v_new, id, default_value from scenario_parameters;
  perform compute_scenario(v_new);
  return v_new;
end $$;

-- set one parameter and recompute (drafts only)
create or replace function set_scenario_param(p_scenario uuid, p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if (select status from scenarios where id = p_scenario) = 'approved' then raise exception 'scenario is approved and frozen'; end if;
  insert into scenario_parameter_values (scenario_id, parameter_id, value)
  select p_scenario, id, p_value from scenario_parameters where key = p_key
  on conflict (scenario_id, parameter_id) do update set value = excluded.value;
  perform compute_scenario(p_scenario);
end $$;

-- manual override of one computed line (or reset it back to the catalog)
create or replace function override_scenario_line(p_line uuid, p_quantity numeric, p_unit_cost numeric) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  update scenario_line_items set quantity = p_quantity, unit_cost = p_unit_cost, is_override = true where id = p_line;
end $$;
create or replace function reset_scenario_line(p_line uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_scenario uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select scenario_id into v_scenario from scenario_line_items where id = p_line;
  delete from scenario_line_items where id = p_line;
  perform compute_scenario(v_scenario);
end $$;

grant execute on function clone_scenario(uuid, text), new_scenario(uuid, text), set_scenario_param(uuid, text, jsonb),
  override_scenario_line(uuid, numeric, numeric), reset_scenario_line(uuid) to authenticated;

-- per-line view for the builder screen
create or replace view v_scenario_lines as
select li.id, li.scenario_id, d.slug as department_slug, d.name_he as department, d.sort_order as department_order,
       li.name_he, li.quantity, li.unit_cost, li.amount, li.is_override, li.cost_item_id,
       ci.quantity_driver, ci.driver_param_key
from scenario_line_items li
join departments d on d.id = li.department_id
left join cost_items ci on ci.id = li.cost_item_id;
grant select on v_scenario_lines to authenticated, anon;
