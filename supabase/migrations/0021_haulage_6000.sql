-- 0021 (16.9): haulage for 2026 was closed at 6,000 ₪ (it was 7,000 — last year's price).
-- Also fixes the spelling of the alcohol line, which came in from the 2025 sheet as "אכהל".
update cost_items set unit_cost = 6000
 where name_he = 'הובלה'
   and department_id = (select id from departments where slug = 'logistics');

update cost_items set name_he = 'אלכוהול' where name_he = 'אכהל';

-- recompute every draft scenario so the new price lands in all of them.
-- approved scenarios stay frozen — that is the whole point of approving one.
do $$
declare r record;
begin
  for r in select id from scenarios where status = 'draft' loop
    perform compute_scenario(r.id);
  end loop;
end $$;
