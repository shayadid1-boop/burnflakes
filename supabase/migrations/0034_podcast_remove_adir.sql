-- 0034 (23.9): Adir's episode comes out of the podcast library too. The recording stays in the
-- camp's Drive folder and can be added back by link from the podcast screen.
delete from podcast_episodes where title_he ilike '%אדיר%' or file_name ilike 'adir%';
