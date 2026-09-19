-- 0031 (19.9): the shift board is reset to the three duties the camp actually staffs.
--
--   קרח        · חשל"ש · 2 people · once a day, every day of the festival (2–7.11) = 6 days
--   ארוחת בוקר · מטבח   · 2 people · every morning except the first festival day (3–7.11) = 5 days
--   ארוחת ערב  · מטבח   · 3 people · every evening except the last day (2–6.11)   = 5 days
--
-- The meal counts line up with the budget on purpose: 5 breakfasts and 5 dinners are exactly what
-- the approved scenario pays for. Ice moves from logistics to חשל"ש, where it belongs.
-- Everything else (bartender, games, kids' room, cleaning, build and truck shifts) comes off the
-- board for now — anything still needed gets added by hand from the department board.

delete from shift_assignments a
 using shifts s
 where a.shift_id = s.id and s.event_id = '00000000-0000-0000-0000-000000002026';
delete from shifts where event_id = '00000000-0000-0000-0000-000000002026';
delete from shift_roles where event_id = '00000000-0000-0000-0000-000000002026';

insert into shift_roles (event_id, department_id, name_he, description_he, slots_per_shift)
values ('00000000-0000-0000-0000-000000002026', (select id from departments where slug = 'chashlash'),
        'קרח', 'הבאת קרח וסידורו בקירור המשותף', 2),
       ('00000000-0000-0000-0000-000000002026', (select id from departments where slug = 'kitchen'),
        'ארוחת בוקר', 'הכנת ארוחת הבוקר לקמפ וניקיון אחריה', 2),
       ('00000000-0000-0000-0000-000000002026', (select id from departments where slug = 'kitchen'),
        'ארוחת ערב', 'הכנת ארוחת הערב לקמפ וניקיון אחריה', 3);

insert into shifts (event_id, department_id, shift_role_id, day, slots)
select sr.event_id, sr.department_id, sr.id, d::date, sr.slots_per_shift
  from shift_roles sr
  cross join lateral generate_series(
       case sr.name_he when 'ארוחת בוקר' then date '2026-11-03' else date '2026-11-02' end,
       case sr.name_he when 'ארוחת ערב'  then date '2026-11-06' else date '2026-11-07' end,
       interval '1 day') as d
 where sr.event_id = '00000000-0000-0000-0000-000000002026';
