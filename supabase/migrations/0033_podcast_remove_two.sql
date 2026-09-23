-- 0033 (23.9): Shay asked to take Eyal's and Hodaya's episodes out of the podcast library.
-- Only the rows in the system go; the recordings stay in the camp's Drive folder, so either can be
-- put back later with "add by link" on the podcast screen.
-- Matched on the Hebrew title or the file name, so an Eyal episode added by hand through the
-- screen is caught too, not only the one seeded from Drive.
delete from podcast_episodes
 where title_he ilike '%הודיה%' or title_he ilike '%אייל%'
    or file_name ilike 'hodaya%' or file_name ilike 'eyal%' or file_name ilike 'eial%';
