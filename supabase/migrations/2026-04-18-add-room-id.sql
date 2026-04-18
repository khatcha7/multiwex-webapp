-- Ajout du choix de salle/piste sur les booking_items
-- (K7 a 4 salles, Slash & Hit a plusieurs pistes — auparavant attribué via hash du booking id)

alter table booking_items
  add column if not exists room_id text;

create index if not exists idx_booking_items_room
  on booking_items(activity_id, room_id, slot_date, slot_start);
