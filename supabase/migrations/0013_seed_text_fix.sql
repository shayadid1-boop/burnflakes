-- 0013: the build-shift description still mentioned the placeholder dates (21–23.11); real build days are 30.10–1.11.2026
update shift_roles set description_he = replace(description_he, 'הקמות 21–23.11', 'הקמות 30.10–1.11')
 where event_id = '00000000-0000-0000-0000-000000002026' and description_he like '%21–23.11%';
