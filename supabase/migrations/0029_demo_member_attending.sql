-- 0029 (19.9): the test member joins the event for the walkthrough.
-- attending = true and a full share means he is charged the dues like anyone else, so the
-- "my account" screen shows a real balance instead of zeros — which is the point of a demo.
-- Side effect, on purpose and temporary: the roster counts 31 instead of 30 and the planned
-- dues income rises by one share. Both go back the moment this is reversed after the training.
update event_members em
   set attending = true, participation_share = 1
  from members m
 where m.id = em.member_id
   and em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'בדיקה' and m.last_name = 'חבר';
