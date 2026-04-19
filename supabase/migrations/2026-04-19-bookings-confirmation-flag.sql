-- A5 — Tag pour savoir si le mail de confirmation a été envoyé avec succès
alter table bookings add column if not exists confirmation_sent_at timestamptz;
alter table bookings add column if not exists confirmation_sent_status text;
-- Statuts possibles : 'sent' | 'failed' | NULL (pas encore tenté)
create index if not exists idx_bookings_confirm_pending on bookings(created_at) where confirmation_sent_at is null;
