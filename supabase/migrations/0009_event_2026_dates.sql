-- Midburn 2026 real dates (from Shay, 11.9.2026): build 30.10–1.11, event 2–7.11.
-- The 2026 seed used placeholder dates (build 21–23.11.2025, event 24–28.11.2025) → shift everything by +343 days,
-- and add a 6th event day (7.11) by copying the last day's shifts.
update events set starts_on = '2026-10-30', ends_on = '2026-11-07', name = 'מידברן 2026'
where id = '00000000-0000-0000-0000-000000002026';

update event_milestones set day = day + 343
where event_id = '00000000-0000-0000-0000-000000002026' and day < '2026-01-01';

update shifts set day = day + 343
where event_id = '00000000-0000-0000-0000-000000002026' and day < '2026-01-01';

insert into shifts (event_id, department_id, shift_role_id, day, title_he, slots, starts_at, ends_at, notes)
select event_id, department_id, shift_role_id, '2026-11-07', title_he, slots, starts_at, ends_at, notes
from shifts where event_id = '00000000-0000-0000-0000-000000002026' and day = '2026-11-06'
on conflict do nothing;
