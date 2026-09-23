-- 0035 (23.9): a shopping list that works itself out, starting with the gift.
--
-- Last year the gift team guessed quantities and was left with 44 milks and 19 boxes of cereal
-- while still going 200 ₪ over. Their own end-of-event notes say what one shift actually used —
-- that is the number this list runs on:
--     to buy = ceil(per shift × number of shifts) − already in the store
-- Each item is tied to one of the department's budget lines, so the list is checked against the
-- approved budget before anyone goes shopping, not after.
--
-- Generic on purpose (department_id on every row): the kitchen can use the same list later.

create table if not exists shopping_plans (
  event_id      uuid not null references events(id) on delete cascade,
  department_id uuid not null references departments(id),
  shift_count   integer not null default 3 check (shift_count between 0 and 30),
  updated_at    timestamptz not null default now(),
  primary key (event_id, department_id)
);

create table if not exists shopping_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  department_id uuid not null references departments(id),
  name_he       text not null,
  unit_he       text not null default 'יח׳',
  per_shift     numeric(8,2) not null default 0 check (per_shift >= 0),
  in_stock      integer not null default 0 check (in_stock >= 0),
  unit_price    numeric(10,2) not null default 0 check (unit_price >= 0),
  budget_line   text,                 -- the department's budget line this item is paid from (by name)
  notes_he      text,
  sort_order    integer not null default 0,
  unique (event_id, department_id, name_he)
);

alter table shopping_plans enable row level security;
alter table shopping_items enable row level security;
-- everyone may look (a member can see what the gift team is buying); only the department's lead or an admin changes it
create policy read_all on shopping_plans for select to authenticated using (true);
create policy lead_write on shopping_plans for all to authenticated
  using (leads_department(event_id, department_id)) with check (leads_department(event_id, department_id));
create policy read_all on shopping_items for select to authenticated using (true);
create policy lead_write on shopping_items for all to authenticated
  using (leads_department(event_id, department_id)) with check (leads_department(event_id, department_id));
grant select, insert, update, delete on shopping_plans, shopping_items to authenticated;

-- ---- the gift, from the 2025 gift file ----
-- per shift: the "מסקנות" sheet ("בכל משמרת היו: …"); pillows raised to 6 because the same sheet says
-- "להוסיף עוד כריות — לפחות 6 למשמרת" (4.5 ran out).
-- price: what was actually paid in 2025, from the "הוצאות" sheet (total ÷ quantity).
-- in store: the end-of-2025 count. Milk is left at 0 — a year-old carton can't be counted on.
insert into shopping_plans (event_id, department_id, shift_count)
values ('00000000-0000-0000-0000-000000002026', (select id from departments where slug = 'gift'), 3)
on conflict do nothing;

insert into shopping_items (event_id, department_id, name_he, unit_he, per_shift, in_stock, unit_price, budget_line, notes_he, sort_order)
select '00000000-0000-0000-0000-000000002026', (select id from departments where slug = 'gift'), v.*
  from (values
    ('כריות',          'שקית',   6.0, 0, 27.90, 'קורנפלקסים', 'ב־2025 נגמרו 4.5 למשמרת — הומלץ לפחות 6', 1),
    ('קראנץ',          'שקית',   4.5, 9, 17.00, 'קורנפלקסים', 'במחסן מ־2025 — לבדוק תוקף', 2),
    ('קורנפלקס צהוב',  'קופסה',  2.5, 6, 12.90, 'קורנפלקסים', 'במחסן מ־2025 — לבדוק תוקף', 3),
    ('סיני מיני',      'קופסה',  2.0, 0, 17.00, 'קורנפלקסים', null, 4),
    ('טריקס',          'קופסה',  2.0, 2, 17.00, 'קורנפלקסים', 'במחסן מ־2025 — לבדוק תוקף', 5),
    ('גרנולה',         'אריזה',  2.0, 2, 17.50, 'קורנפלקסים', 'אריזה גדולה', 6),
    ('חלב פרה',        'ליטר',  11.0, 0,  7.20, 'חלב', null, 7),
    ('משקה שקדים',     'ליטר',   7.0, 0,  7.90, 'חלב', null, 8),
    ('משקה שיבולת',    'ליטר',   6.0, 0,  7.90, 'חלב', null, 9),
    ('משקה סויה',      'ליטר',   4.0, 0,  7.90, 'חלב', null, 10),
    ('משקה אורז',      'ליטר',   2.0, 0,  9.90, 'חלב', null, 11)
  ) as v(name_he, unit_he, per_shift, in_stock, unit_price, budget_line, notes_he, sort_order)
on conflict (event_id, department_id, name_he) do nothing;
