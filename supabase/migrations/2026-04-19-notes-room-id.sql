-- Notes peuvent être attachées à une room/piste précise (K7 Record/Studio/Dancefloor, Slash Piste 1/2/3)
-- room_id null = note sur l'activité globale (toutes les rooms)

alter table notes add column if not exists room_id text;

create index if not exists idx_notes_room on notes(activity_id, room_id, note_date, slot_start);
