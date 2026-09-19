-- 0025 (19.9): the approved budget must add up to the money we actually collect.
--
-- Dues are 1,500 ₪ × 30 members = 45,000 ₪ of planned income, while the frozen expense lines add up
-- to about 41,700 ₪. The gap is the 5% buffer plus the rounding up of the dues — real money that had
-- no line to sit on, so the budget screen showed 41,700 while the camp is collecting 45,000.
-- From now on approving a scenario also writes that gap as an explicit reserve line, so planned
-- expenses equal planned income and nothing is unaccounted for.

create or replace function approve_scenario_checked(p_scenario uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_dues numeric; v_fund uuid; t member_tier;
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
  -- planned camp-dues income for the balance sheet = dues × member count of the scenario
  insert into budget_income_lines (event_id, fund_kind, department_id, name_he, planned_amount)
  select v_event, 'camp_dues', null, 'דמי קמפ', round(coalesce(v_dues, 0) * coalesce(member_count, 0), 2)
  from v_scenario_summary where scenario_id = p_scenario;

  perform set_budget_reserve(v_event);
end $$;

-- the reserve itself: whatever planned income exceeds planned expenses, parked on one visible line.
-- Kept as its own function so it can be re-run on a budget that was approved before this migration.
create or replace function set_budget_reserve(p_event uuid) returns numeric language plpgsql security definer set search_path = public as $$
declare v_income numeric; v_planned numeric; v_gap numeric; v_dept uuid;
begin
  select id into v_dept from departments where slug = 'misc';
  if v_dept is null then return 0; end if;

  delete from budget_lines where event_id = p_event and department_id = v_dept and name_he = 'רזרבה';

  select coalesce(sum(planned_amount), 0) into v_income from budget_income_lines where event_id = p_event;
  select coalesce(sum(planned_amount), 0) into v_planned from budget_lines where event_id = p_event;
  v_gap := round(v_income - v_planned, 2);
  if v_gap <= 0 then return 0; end if;

  insert into budget_lines (event_id, department_id, name_he, planned_amount)
  values (p_event, v_dept, 'רזרבה', v_gap);
  return v_gap;
end $$;

-- bring the budget that is already approved into line, without re-freezing it
select set_budget_reserve('00000000-0000-0000-0000-000000002026');
