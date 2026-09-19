-- 0030 (19.9): the test lead joins the event too, and moves from ארט to סלון for the walkthrough.
-- Same reasoning as 0029: attending with a full share means his own account screen and his shift
-- share behave like a real person's. Both test users are reversed together after the training.
update event_members em
   set attending = true, participation_share = 1
  from members m
 where m.id = em.member_id
   and em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'בדיקה' and m.last_name = 'ראש מחלקה';

delete from department_leads dl
 using event_members em, members m
 where dl.event_member_id = em.id and em.member_id = m.id
   and dl.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'בדיקה' and m.last_name = 'ראש מחלקה';

insert into department_leads (event_id, department_id, event_member_id)
select '00000000-0000-0000-0000-000000002026',
       (select id from departments where slug = 'lounge'),
       em.id
  from event_members em join members m on m.id = em.member_id
 where em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'בדיקה' and m.last_name = 'ראש מחלקה'
on conflict do nothing;
