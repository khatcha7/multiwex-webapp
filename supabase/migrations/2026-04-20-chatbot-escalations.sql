-- Table pour stocker les demandes client qu'Ellie IA escalade à un humain
-- (cas complexes : packs custom, séminaires B2B, réclamations, etc.)

create table if not exists chatbot_escalations (
  id uuid primary key default gen_random_uuid(),
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email text not null,
  customer_phone text,
  reason text not null,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'dismissed')),
  assigned_to text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_chatbot_escalations_status
  on chatbot_escalations(status, created_at desc)
  where status in ('pending', 'in_progress');

create index if not exists idx_chatbot_escalations_email
  on chatbot_escalations(customer_email);

-- Trigger pour updated_at
create or replace function chatbot_escalations_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_chatbot_escalations_updated_at on chatbot_escalations;
create trigger trg_chatbot_escalations_updated_at
  before update on chatbot_escalations
  for each row execute function chatbot_escalations_updated_at();
