-- Stockage de l'orderCode VivaWallet pour réconcilier les webhooks de paiement
alter table bookings add column if not exists viva_order_code text;
create index if not exists idx_bookings_viva_order on bookings(viva_order_code);
