-- 0023 (16.9): two changes Shay asked for on the six scenarios.
--
-- a) the member counts move from 35/40/45 down to 30/35/40, and the scenario names follow.
--    Each is done in a single pass (minus five), because stepping one pair at a time would
--    catch the scenarios renamed a moment earlier and drag them all down to 30.
--
-- b) the dues per member are rounded UP to the nearest 50 ₪ — 1,430 becomes 1,450 and 1,460
--    becomes 1,500. The 5% he mentioned as a fallback is already in the formula (buffer_pct),
--    so this rounding sits on top of it, not instead of it. The un-rounded figure stays
--    available as dues_per_member_raw so it is always clear where the rounding came from.
--    approve_scenario_checked() reads dues_per_member straight out of this view into
--    fee_rules.amount, so the rounded number is what members are actually charged.

update scenario_parameter_values pv
   set value = to_jsonb((pv.value #>> '{}')::int - 5)
  from scenarios s
 where s.id = pv.scenario_id
   and s.event_id = '00000000-0000-0000-0000-000000002026'
   and s.status = 'draft'
   and pv.parameter_id = (select id from scenario_parameters where key = 'member_count')
   and (pv.value #>> '{}')::int in (35, 40, 45);

update scenarios
   set name = ((split_part(name, ' ', 1))::int - 5) || substr(name, length(split_part(name, ' ', 1)) + 1)
 where event_id = '00000000-0000-0000-0000-000000002026'
   and status = 'draft'
   and name ~ '^(35|40|45) חברים';

-- the rounded dues. The view is dropped and rebuilt rather than replaced because the new
-- raw column sits before dues_per_member, and "create or replace view" only allows new
-- columns at the end. Nothing else depends on it (the functions that read it are resolved
-- at run time), so the drop is safe.
drop view if exists v_scenario_summary;
create view v_scenario_summary as
with totals as (
  select s.id as scenario_id, s.event_id, s.name, coalesce(sum(li.amount), 0) as total,
         coalesce((select sum(amount) from scenario_income_lines i where i.scenario_id = s.id), 0) as other_income
  from scenarios s left join scenario_line_items li on li.scenario_id = s.id
  group by s.id
), calc as (
  select t.*,
         (scenario_param(t.scenario_id, 'buffer_pct') #>> '{}')::numeric as buffer_pct,
         (scenario_param(t.scenario_id, 'member_count') #>> '{}')::numeric as member_count,
         coalesce((scenario_param(t.scenario_id, 'buffer_amount') #>> '{}')::numeric, 0) as buffer_amount
  from totals t
)
select c.*,
       round((c.total * (1 + c.buffer_pct / 100) + c.buffer_amount - c.other_income)
             / nullif(c.member_count, 0), 2) as dues_per_member_raw,
       -- up to the next round 50 ₪
       ceil((c.total * (1 + c.buffer_pct / 100) + c.buffer_amount - c.other_income)
            / nullif(c.member_count, 0) / 50) * 50 as dues_per_member
from calc c;

-- recompute the drafts so the new member counts land in the per-member lines
do $$
declare r record;
begin
  for r in select id from scenarios where status = 'draft' loop
    perform compute_scenario(r.id);
  end loop;
end $$;
