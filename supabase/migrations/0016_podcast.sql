-- 0016: podcast library — episodes recorded by a camp member, hosted in a shared Google Drive folder (public "anyone with the link").
-- We store only the Drive file id; playback uses Drive's own player. Admin can give each episode a proper title/description.
create table if not exists podcast_episodes (
  id            uuid primary key default gen_random_uuid(),
  camp_id       uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  drive_file_id text not null,
  title_he      text not null,
  description_he text,
  file_name     text,
  file_size     bigint,
  recorded_on   date,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (camp_id, drive_file_id)
);
alter table podcast_episodes enable row level security;
create policy read_all on podcast_episodes for select to authenticated using (true);
create policy admin_all on podcast_episodes for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on podcast_episodes to authenticated;
revoke all on podcast_episodes from anon;

insert into podcast_episodes (drive_file_id, title_he, file_name, file_size, recorded_on, sort_order) values
('1MVA3YkJ1CLoA_1lcu4-M5yYEKoS16val', 'ניב', 'Niv.mp3', 120140276, '2022-11-15', 1),
('1lNpk5gJfpkzEMsAIWIOTBF3VnueupUEV', 'גבע', 'Geva.mp3', 107920195, '2022-11-15', 2),
('1uWJUhAscML0ZxZRIqXuOMyH_ZmL3AelO', 'ליאת', 'Liat.mp3', 127780570, '2022-11-15', 3),
('1Wrp8OFkMRISeS7BZj_6u-q2GTpGZwhTt', 'לורה', 'Lora.mp3', 132320652, '2022-11-15', 4),
('1zn5Y5LT6BNpk9lPpM4Un-4X0jdACdH4x', 'שיר', 'Shir.mp3', 78820831, '2022-11-15', 5),
('1vEvRYwxaxLzRsMDwUdd0tS9Fuk9R0B2K', '7 דקות בגן עדן וקצת יותר - מנותקת', '7 דקות בגן עדן וקצת יותר - מנותקת', 125439999, '2022-11-15', 6),
('1d5EykVrYOuc4KPVgX3G6azBAO19FirTj', 'חממית', 'Hamamit.mp3', 2279966, '2022-11-01', 7),
('1toJSE3bgEFR8gw9PtM-jPPB7mASD8q5V', 'שאיפות', 'Sheifot.mp3', 2240260, '2022-11-01', 8),
('100mDSvObCG5kVufzKk1kez752HqtgOdV', 'טלי', 'Tali.mp3', 135070823, '2022-11-01', 9),
('189AlnsED74QXMglr_sDqYpQQ-wO78mo9', 'חיבוק', 'Hibuk.mp3', 15760195, '2022-11-01', 10),
('1hihKlzaRxfLuLEgF8wsE3x5ih2Cth7iI', 'וסת', 'Veset.mp3', 72119901, '2022-11-01', 11),
('1sW1fcWaNxxrHMlSoTFoSKXSBua1GVgvF', 'מיטל', 'Meital.mp3', 95040782, '2022-11-01', 12),
('16cbuIqBC4Xg-LwwarsLbakuL_OKINP_Q', 'הודיה', 'Hodaya.mp3', 129760652, '2022-11-01', 13),
('1bp6-_AUwosPQQrzURwji4-HdHTXjr5Ks', 'אדיר', 'Adir.mp3', 71679999, '2022-11-01', 14)
on conflict (camp_id, drive_file_id) do nothing;
