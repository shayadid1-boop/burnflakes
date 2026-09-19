-- 0032 (19.9): the daily חשל"ש shift covers two jobs, not one — bringing the ice and clearing
-- the camp's rubbish and recycling. Same two people, same once a day; only the name and the
-- description change, so nobody signed up loses their place.
update shift_roles
   set name_he = 'קרח ופינוי חשל"ש',
       description_he = 'הבאת קרח וסידורו בקירור המשותף, ופינוי האשפה והמיחזור של הקמפ'
 where event_id = '00000000-0000-0000-0000-000000002026'
   and name_he = 'קרח';
