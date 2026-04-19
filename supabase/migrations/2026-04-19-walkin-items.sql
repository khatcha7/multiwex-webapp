-- Permet les items de réservation sans créneau (vente directe : BattleKart, Starcadium walk-in)
alter table booking_items alter column slot_start drop not null;
alter table booking_items alter column slot_end drop not null;
