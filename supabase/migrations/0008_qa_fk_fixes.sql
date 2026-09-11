-- QA fixes: deletes the UI offers were blocked by plain FKs; planned income was invisible on the balance sheet until its fund existed

-- 1. deleting a draft scenario that was cloned from failed (scenarios.cloned_from FK)
alter table scenarios drop constraint scenarios_cloned_from_fkey;
alter table scenarios add constraint scenarios_cloned_from_fkey foreign key (cloned_from) references scenarios(id) on delete set null;

-- 2. deleting a shift role that already has shifts failed (shifts.shift_role_id FK); shifts keep their own slots/times
alter table shifts drop constraint shifts_shift_role_id_fkey;
alter table shifts add constraint shifts_shift_role_id_fkey foreign key (shift_role_id) references shift_roles(id) on delete set null;

-- 3. deleting a shift that has an expense attached failed (expenses.shift_id FK)
alter table expenses drop constraint expenses_shift_id_fkey;
alter table expenses add constraint expenses_shift_id_fkey foreign key (shift_id) references shifts(id) on delete set null;

-- 4. v_event_balance joins planned income through funds: make sure every planned income kind has its fund after approval
create or replace function approve_scenario_checked(p_scenario uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_dues numeric; v_fund uuid; t member_tier; k fund_kind;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform approve_scenario(p_scenario);
  select event_id into v_event from scenarios where id = p_scenario;
  select dues_per_member into v_dues from v_scenario_summary where scenario_id = p_scenario;
  insert into funds (event_id, key, name_he, kind, in_refund_pool, from_members)
  values (v_event, 'camp_dues', 'דמי קמפ', 'camp_dues', true, true)
  on conflict (event_id, key) do nothing;
  select id into v_fund from funds where event_id = v_event and key = 'camp_dues';
  for t in select unnest(enum_range(null::member_tier)) loop
    insert into fee_rules (fund_id, tier, amount) values (v_fund, t, round(coalesce(v_dues, 0), 2))
    on conflict (fund_id, tier) do update set amount = excluded.amount;
  end loop;
  insert into budget_income_lines (event_id, fund_kind, department_id, name_he, planned_amount)
  select v_event, 'camp_dues', null, 'דמי קמפ', round(coalesce(v_dues, 0) * coalesce(member_count, 0), 2)
  from v_scenario_summary where scenario_id = p_scenario;
  for k in select distinct fund_kind from budget_income_lines where event_id = v_event and fund_kind <> 'camp_dues' loop
    perform ensure_fund(v_event, k);
  end loop;
end $$;
