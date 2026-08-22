-- Alertas de inventario para tarjetas de cliente (reverse matching).
-- Opt-in por tarjeta + canal de aviso. Idempotente.

alter table public.client_cards add column if not exists alertas boolean not null default false;
alter table public.client_cards add column if not exists alertas_canal text not null default 'app';   -- 'app' | 'whatsapp' | 'email'
-- Estado del reverse matching (por si aún no existían):
alter table public.client_cards add column if not exists notificados text[] not null default '{}';
alter table public.client_cards add column if not exists wl_seeded boolean not null default false;

-- Restringe el canal a valores válidos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_cards_alertas_canal_chk') then
    alter table public.client_cards
      add constraint client_cards_alertas_canal_chk check (alertas_canal in ('app','whatsapp','email'));
  end if;
end $$;
