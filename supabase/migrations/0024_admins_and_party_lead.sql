-- 0024 (19.9): who runs what, as Shay set it.
-- Two admins now: Shay and Niv. Niv was marked dept_lead without any department, which in practice
-- gave him nothing; as an admin he sees the whole system.
update event_members em
   set role = 'admin'
  from members m
 where m.id = em.member_id
   and em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'ניב' and m.last_name = 'בורנשטיין';

-- Shachaf runs the party / fundraiser event, which until now had no lead — meaning nobody but an
-- admin could record income there.
update event_members em
   set role = 'dept_lead'
  from members m
 where m.id = em.member_id
   and em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'שחף' and m.last_name = 'זייד';

insert into department_leads (event_id, department_id, event_member_id)
select '00000000-0000-0000-0000-000000002026',
       (select id from departments where slug = 'fundraiser'),
       em.id
  from event_members em join members m on m.id = em.member_id
 where em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'שחף' and m.last_name = 'זייד'
on conflict do nothing;
