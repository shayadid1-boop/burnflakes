-- 0026 (19.9): חשל"ש had no budget line at all — the cleaning and recycling spend was buried inside
-- logistics. Shay moved 500 ₪ across: logistics' "ציוד נוסף" drops from 800 to 300, and the department
-- that actually buys the bags, gloves and cleaning supplies gets its own 500 ₪ line.
-- The camp total does not change; the money simply sits where the person spending it can see it.

update cost_items set unit_cost = 300
 where name_he = 'ציוד נוסף'
   and department_id = (select id from departments where slug = 'logistics');

insert into cost_items (department_id, name_he, unit_cost, base_quantity, quantity_driver, is_active)
select (select id from departments where slug = 'chashlash'), 'ציוד ניקיון ומחזור', 500, 1, 'fixed', true
 where not exists (
   select 1 from cost_items
    where department_id = (select id from departments where slug = 'chashlash')
      and name_he = 'ציוד ניקיון ומחזור');

-- the approved budget is a frozen copy, so it needs the same move applied by hand.
-- The two amounts cancel out, so the approved total stays exactly where Shay set it.
update budget_lines set planned_amount = 300
 where event_id = '00000000-0000-0000-0000-000000002026'
   and name_he = 'ציוד נוסף'
   and department_id = (select id from departments where slug = 'logistics');

insert into budget_lines (event_id, department_id, name_he, planned_amount)
select '00000000-0000-0000-0000-000000002026',
       (select id from departments where slug = 'chashlash'), 'ציוד ניקיון ומחזור', 500
on conflict (event_id, department_id, name_he) do update set planned_amount = excluded.planned_amount;

-- recompute every draft scenario so both sides of the move land in them
do $$
declare r record;
begin
  for r in select id from scenarios where status = 'draft' loop
    perform compute_scenario(r.id);
  end loop;
end $$;
