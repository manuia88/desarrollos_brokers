-- Tabla de secreto para la sincronización Google Sheets -> Supabase.
-- La Edge Function "sync-desarrollos" compara el header x-sync-secret contra este valor.
-- Sólo el service_role (dentro de la Edge Function) la lee; RLS activa y sin políticas => nadie más.
create table if not exists public.sync_config (
  id          int primary key default 1,
  sync_secret text not null default encode(gen_random_bytes(24), 'hex'),
  check (id = 1)
);
alter table public.sync_config enable row level security;
insert into public.sync_config (id) values (1) on conflict (id) do nothing;

-- Para ver / rotar el secreto (ejecutar como service_role / desde el editor SQL):
--   select sync_secret from public.sync_config where id = 1;
--   update public.sync_config set sync_secret = encode(gen_random_bytes(24),'hex') where id = 1;
