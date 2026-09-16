-- 0018 (16.9): the shift board gets simpler.
-- A shift is now "a shift type, on a day, in a department" — no hours, no per-shift budget.
-- Times stay in the table (old rows keep their data) but are no longer entered or shown.
alter table shift_roles drop column if exists budget_amount;

-- one shift of a type per day per department (uniqueness is also checked in the app, which gives a Hebrew error)
create index if not exists shifts_type_day_ix on shifts (event_id, department_id, shift_role_id, day);

-- the day the event itself starts; everything before it is a build day (marked as such on the board)
alter table events add column if not exists event_starts_on date;
update events set event_starts_on = '2026-11-02' where id = '00000000-0000-0000-0000-000000002026' and event_starts_on is null;
