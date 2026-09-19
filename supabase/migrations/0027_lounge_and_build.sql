-- 0027 (19.9): two more departments get their own money, continuing what 0026 started for חשל"ש.
--
-- סלון: the 400 ₪ lounge line was sitting under "שונות". It moves to the lounge department itself,
-- so Liat opens her department and sees her budget instead of an empty screen. Same money, same total.
--
-- הקמות: opened with a zero line, on purpose — Shay will fill in the amount once the build days are
-- planned. A visible zero is better than no line at all: it shows up in every scenario and is one
-- number away from being real.
--
-- שירותים is deliberately left alone — that budget is handled elsewhere.

update cost_items
   set department_id = (select id from departments where slug = 'lounge'),
       name_he = 'ציוד לסלון הציבורי'
 where name_he = 'סלון'
   and department_id = (select id from departments where slug = 'misc');

insert into cost_items (department_id, name_he, unit_cost, base_quantity, quantity_driver, is_active)
select (select id from departments where slug = 'build'), 'תקציב הקמות', 0, 1, 'fixed', true
 where not exists (
   select 1 from cost_items
    where department_id = (select id from departments where slug = 'build')
      and name_he = 'תקציב הקמות');

-- the same move inside the frozen approved budget, so the 2026 total stays 45,000
update budget_lines
   set department_id = (select id from departments where slug = 'lounge'),
       name_he = 'ציוד לסלון הציבורי'
 where event_id = '00000000-0000-0000-0000-000000002026'
   and name_he = 'סלון'
   and department_id = (select id from departments where slug = 'misc');

insert into budget_lines (event_id, department_id, name_he, planned_amount)
select '00000000-0000-0000-0000-000000002026',
       (select id from departments where slug = 'build'), 'תקציב הקמות', 0
on conflict (event_id, department_id, name_he) do nothing;

do $$
declare r record;
begin
  for r in select id from scenarios where status = 'draft' loop
    perform compute_scenario(r.id);
  end loop;
end $$;
