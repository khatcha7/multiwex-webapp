-- Reconstruction complète du système de blocage de créneaux
-- Wipe ancienne table `slots` (jamais correctement utilisée), nouvelle `slot_blocks` propre.

drop table if exists slots cascade;

create table if not exists slot_blocks (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,                -- 'eyestart', 'k7', etc. (PAS de FK pour accepter room_id)
  room_id text,                              -- 'k7-record' si applicable
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  seats_blocked int,                         -- null = blocage total ; sinon N places bloquées
  label text,                                -- nom libre du bloc (ex "Team building Carrefour")
  reason text,                               -- raison interne
  batch_id text,                             -- groupe pour fusion multi-créneaux consécutifs
  created_by_name text,
  created_at timestamptz default now()
);

create index if not exists idx_slot_blocks_lookup
  on slot_blocks(activity_id, slot_date, start_time);
create index if not exists idx_slot_blocks_batch on slot_blocks(batch_id);
