-- w2 prep: approving a scenario also sets the camp-dues fund; ledger visible only to admin or to the member himself

-- 1. approve ⇒ camp_dues fund + equal fee for every tier (decision 7.9: dues equal for all, exceptions by hand in member_charge_overrides)
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
end $$;

-- 2. ledger access: admin sees everyone, a member sees only himself
revoke select on v_member_ledger, v_member_charges from anon, authenticated;
create or replace function ledger(p_event uuid) returns setof v_member_ledger language sql stable security definer set search_path = public as $$
  select * from v_member_ledger l
  where l.event_id = p_event and (is_admin() or l.event_member_id = my_event_member_id(p_event))
  order by l.first_name, l.last_name
$$;
grant execute on function ledger(uuid) to authenticated;

-- 3. helpers for screens
create or replace view v_expenses as
select x.id, x.event_id, x.department_id, d.slug as department_slug, d.name_he as department, x.description, x.amount, x.expense_date,
       x.status, x.paid_from, x.has_receipt, x.budget_line_id, b.name_he as budget_line, x.shift_id, x.notes, x.created_at,
       x.paid_by_event_member_id, coalesce(m.first_name || ' ' || coalesce(m.last_name, ''), x.paid_by_name) as paid_by,
       x.created_by
from expenses x
join departments d on d.id = x.department_id
left join budget_lines b on b.id = x.budget_line_id
left join event_members em on em.id = x.paid_by_event_member_id
left join members m on m.id = em.member_id;
alter view v_expenses set (security_invoker = true);
grant select on v_expenses to authenticated;

-- which departments does this member lead in an event (for the nav)
create or replace function my_departments(p_event uuid) returns table (id uuid, slug text, name_he text, kind text) language sql stable security definer set search_path = public as $$
  select d.id, d.slug, d.name_he, d.kind from departments d
  where d.is_active and (is_admin() or leads_department(p_event, d.id)) order by d.sort_order
$$;
grant execute on function my_departments(uuid) to authenticated;

-- income category funds are created on demand (a fundraiser lead may log income before the treasurer set anything up)
create or replace function ensure_fund(p_event uuid, p_kind fund_kind) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select id into v_id from funds where event_id = p_event and key = p_kind::text;
  if v_id is not null then return v_id; end if;
  v_name := case p_kind when 'fundraiser' then 'אירועי גיוס' when 'donation' then 'תרומות' when 'sponsorship' then 'ספונסרים'
                        when 'sale' then 'מכירות' when 'carryover' then 'יתרה משנה קודמת' else 'הכנסות אחרות' end;
  insert into funds (event_id, key, name_he, kind, in_refund_pool, from_members) values (p_event, p_kind::text, v_name, p_kind, true, false) returning id into v_id;
  return v_id;
end $$;
grant execute on function ensure_fund(uuid, fund_kind) to authenticated;
