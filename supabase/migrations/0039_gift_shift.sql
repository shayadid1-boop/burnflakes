-- 0039 (4.10): the final shift board, one duty per department line. The three existing duties
-- already match what was asked (breakfast Tue–Sat ×2, dinner Mon–Fri ×3, ice + waste Mon–Sat ×2);
-- the gift gets its own shift: Tuesday to Friday (3–6.11), 3 people each.
-- 2026: 2.11 = Monday … 7.11 = Saturday.

insert into shift_roles (event_id, department_id, name_he, description_he, slots_per_shift)
select '00000000-0000-0000-0000-000000002026', d.id, 'גיפט', 'הפעלת הגיפט: הכנה, הגשה וסידור בסוף', 3
  from departments d
 where d.slug = 'gift'
   and not exists (select 1 from shift_roles r
                    where r.event_id = '00000000-0000-0000-0000-000000002026'
                      and r.department_id = d.id and r.name_he = 'גיפט');

insert into shifts (event_id, department_id, shift_role_id, day, slots)
select sr.event_id, sr.department_id, sr.id, d::date, sr.slots_per_shift
  from shift_roles sr
  cross join generate_series(date '2026-11-03', date '2026-11-06', interval '1 day') as d
 where sr.event_id = '00000000-0000-0000-0000-000000002026'
   and sr.name_he = 'גיפט'
   and not exists (select 1 from shifts s where s.shift_role_id = sr.id and s.day = d::date);
