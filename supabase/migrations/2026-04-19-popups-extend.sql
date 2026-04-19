-- Étend la table popups pour matcher le schéma utilisé en localStorage (defaultPopups)
-- Ajoute : emoji, cta_action, promo_code, discount_pct, order_position, trigger_event
-- L'ancien champ "active" devient "enabled" (alias en code).

alter table popups add column if not exists emoji text;
alter table popups add column if not exists cta_action text default 'dismiss';
alter table popups add column if not exists promo_code text;
alter table popups add column if not exists discount_pct numeric(5,2) default 0;
alter table popups add column if not exists order_position int default 0;
alter table popups add column if not exists trigger_event text default 'after_confirmation';
alter table popups add column if not exists enabled boolean default false;

-- Recopie active → enabled si nécessaire
update popups set enabled = active where enabled is null;

create index if not exists idx_popups_order on popups(order_position);
create index if not exists idx_popups_enabled on popups(enabled) where enabled = true;
