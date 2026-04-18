-- Système de notes pour le calendrier (Phase 1)
-- 2 tables : note_categories (configurable) + notes (CRUD avec audit)

create table if not exists note_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#e8005a',
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references note_categories(id) on delete set null,
  note_date date not null,
  -- 3 scopes : 'day' (toute la journée) | 'range' (plage horaire d'une activité) | 'slot' (1 créneau précis)
  scope text not null check (scope in ('day', 'range', 'slot')),
  -- requis si scope='range' ou 'slot'
  activity_id text,
  -- requis si scope='range' ou 'slot'
  slot_start time,
  -- requis si scope='range', optionnel si 'slot'
  slot_end time,
  -- contenu (Phase 1: plain text, Phase 2: HTML rich text)
  content text not null,
  -- audit
  created_by_staff_id uuid,
  created_by_name text,
  updated_by_staff_id uuid,
  updated_by_name text,
  -- lock admin
  locked boolean default false,
  locked_by_staff_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_date on notes(note_date);
create index if not exists idx_notes_slot on notes(activity_id, note_date, slot_start);
create index if not exists idx_notes_category on notes(category_id);
