-- Multiwex — Schéma Supabase V2
-- À exécuter dans l'éditeur SQL de Supabase (Project → SQL Editor)
-- Version : 2026-04-14

-- =========================================================================
-- ACTIVITÉS (catalogue statique, seedé depuis lib/activities.js)
-- =========================================================================
create table if not exists activities (
  id text primary key,
  name text not null,
  tagline text,
  duration_min int not null default 0,
  price_regular numeric(6,2) not null default 0,
  price_wed numeric(6,2) not null default 0,
  max_players int not null default 0,
  bookable boolean not null default true,
  walk_in boolean not null default false,
  external_url text,
  logo_path text,
  image_path text,
  description text,
  restrictions jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- CRÉNEAUX (générés dynamiquement OU bloqués manuellement par staff)
-- =========================================================================
create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references activities(id),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  blocked boolean not null default false,
  block_reason text,
  blocked_by uuid, -- staff_user_id
  note text,
  created_at timestamptz not null default now(),
  unique (activity_id, slot_date, start_time)
);
create index if not exists idx_slots_date on slots(slot_date);
create index if not exists idx_slots_activity_date on slots(activity_id, slot_date);

-- =========================================================================
-- UTILISATEURS CLIENTS
-- =========================================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  company_name text,
  vat_number text,
  address text,
  city text,
  postal_code text,
  country text default 'BE',
  marketing_opt_in boolean default false,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- RÉSERVATIONS (sale.order équivalent)
-- =========================================================================
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null, -- MW-XXXXXX
  customer_id uuid references customers(id),
  booking_date date not null,
  players int not null,
  subtotal numeric(8,2) not null default 0,
  discount numeric(8,2) not null default 0,
  total numeric(8,2) not null default 0,
  paid boolean not null default false,
  payment_method text, -- card, cash, giftcard, demo_promo, on_site_card, on_site_cash
  promo_code text,
  source text not null default 'online', -- online, on_site, phone
  created_at timestamptz not null default now(),
  package_id text,
  notes text
);
create index if not exists idx_bookings_date on bookings(booking_date);
create index if not exists idx_bookings_customer on bookings(customer_id);

-- =========================================================================
-- LIGNES DE RÉSERVATION (1 par créneau réservé)
-- =========================================================================
create table if not exists booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  activity_id text not null references activities(id),
  slot_date date not null,
  slot_start time not null,
  slot_end time not null,
  players int not null,
  unit_price numeric(6,2) not null,
  total_price numeric(8,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_booking_items_slot on booking_items(activity_id, slot_date, slot_start);
create index if not exists idx_booking_items_booking on booking_items(booking_id);

-- Vue pour calcul rapide de l'occupation d'un créneau (nb joueurs total sur un slot spécifique)
create or replace view slot_occupancy as
select
  activity_id,
  slot_date,
  slot_start,
  slot_end,
  count(*) as groups_count,
  sum(players) as players_count
from booking_items
group by activity_id, slot_date, slot_start, slot_end;

-- =========================================================================
-- CARTES CADEAUX
-- =========================================================================
create table if not exists giftcards (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  amount numeric(8,2) not null,
  balance numeric(8,2) not null,
  from_name text,
  to_name text,
  to_email text,
  message text,
  paid boolean not null default false,
  redeemed_bookings uuid[] default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- =========================================================================
-- STAFF (back-office)
-- =========================================================================
create table if not exists staff_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text,
  permissions jsonb not null default '{}'::jsonb,
  -- permissions exemples:
  -- { "calendar": true, "bookings_view": true, "bookings_edit": true,
  --   "on_site_booking": true, "financial_reports": false, "settings": false,
  --   "users_manage": false }
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references staff_users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text
);

-- =========================================================================
-- AUDIT LOG (tout ce que fait le staff)
-- =========================================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid references staff_users(id),
  staff_user_name text,
  action text not null, -- create_booking, block_slot, edit_booking, etc.
  entity_type text,     -- booking, slot, customer, config
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on audit_log(created_at desc);

-- =========================================================================
-- CONFIGURATION ÉDITABLE (content editor)
-- =========================================================================
create table if not exists site_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Seed config par défaut
insert into site_config (key, value) values
  ('site.tagline', '"Choisissez vos activités, on s''occupe du reste."'),
  ('site.flash_sale_text', '"MERCREDI -50% SUR TOUTES LES ACTIVITÉS"'),
  ('booking.buffer_min', '10'),
  ('booking.cancel_cutoff_hours', '24'),
  ('booking.join_cutoff_min', '10'),
  ('promo.demo_code', '"DEMO100"'),
  ('contact.phone', '"+32 (0)84 770 222"'),
  ('contact.email', '"info@multiwex.be"')
  on conflict (key) do nothing;

-- =========================================================================
-- PROMO CODES
-- =========================================================================
create table if not exists promo_codes (
  code text primary key,
  description text,
  type text not null default 'percent', -- percent, flat
  value numeric(6,2) not null,
  max_uses int,
  used_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into promo_codes (code, description, type, value) values
  ('DEMO100', 'Code démo — 100% de réduction', 'percent', 100)
  on conflict (code) do nothing;

-- =========================================================================
-- POPUPS ÉVÉNEMENTS (saisonniers)
-- =========================================================================
create table if not exists popups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- RLS (Row Level Security) — à activer en prod
-- =========================================================================
-- alter table bookings enable row level security;
-- alter table booking_items enable row level security;
-- ... (politiques à ajouter selon besoin)

-- =========================================================================
-- REALTIME — activer les publications pour que le client puisse subscribe
-- =========================================================================
-- Dans Supabase dashboard : Database → Replication → activer pour bookings, slots, booking_items
