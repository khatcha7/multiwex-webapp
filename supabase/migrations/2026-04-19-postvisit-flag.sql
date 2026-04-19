-- Flag pour ne pas renvoyer le mail post-visite plusieurs fois
alter table bookings add column if not exists post_visit_sent_at timestamptz;
create index if not exists idx_bookings_postvisit on bookings(booking_date, post_visit_sent_at);
