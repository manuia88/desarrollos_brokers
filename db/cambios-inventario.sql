-- Diario de cambios de inventario (página /cambios).
-- Triggers sobre unidades: registran alta, baja y cambios reales de precio/estatus,
-- sin importar por dónde entre el dato (sync del Sheet, captura manual, SQL directo).
-- El sync espejo hace upsert por SKU y borra solo lo que salió del Sheet, así que
-- cada fila aquí es un cambio real, no ruido del re-sync. (Aplicado como migración cambios_inventario.)

create table if not exists public.cambios_inventario (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  sku text not null,
  dev_sku text,
  tipo text not null check (tipo in ('alta','baja','precio','estatus')),
  antes jsonb,
  despues jsonb
);
create index if not exists cambios_inv_fecha on public.cambios_inventario (fecha desc);

alter table public.cambios_inventario enable row level security;
drop policy if exists cambios_select on public.cambios_inventario;
create policy cambios_select on public.cambios_inventario for select
  using (app_is_super() or app_is_active());
-- Sin policy de escritura: solo escriben los triggers (security definer).

create or replace function public.log_cambio_unidad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into cambios_inventario (sku, dev_sku, tipo, despues)
    values (new.sku, new.dev_sku, 'alta', jsonb_build_object('precio', new.precio, 'estatus', new.estatus));
  elsif tg_op = 'DELETE' then
    insert into cambios_inventario (sku, dev_sku, tipo, antes)
    values (old.sku, old.dev_sku, 'baja', jsonb_build_object('precio', old.precio, 'estatus', old.estatus));
    return old;
  else
    if new.precio is distinct from old.precio then
      insert into cambios_inventario (sku, dev_sku, tipo, antes, despues)
      values (new.sku, new.dev_sku, 'precio', jsonb_build_object('precio', old.precio), jsonb_build_object('precio', new.precio));
    end if;
    if new.estatus is distinct from old.estatus then
      insert into cambios_inventario (sku, dev_sku, tipo, antes, despues)
      values (new.sku, new.dev_sku, 'estatus', jsonb_build_object('estatus', old.estatus), jsonb_build_object('estatus', new.estatus));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_cambios_unidades on public.unidades;
create trigger trg_cambios_unidades
  after insert or update or delete on public.unidades
  for each row execute function public.log_cambio_unidad();

-- (misma tanda) ficha_og ahora también devuelve 'direccion', para que el metadata
-- de /f/[sku] arme el título comercial con tituloDev. Aplicado como ficha_og_direccion.
-- Y hardening: revoke execute de log_cambio_unidad a anon/authenticated; search_path
-- fijo en profiles_guard, orgs_guard, nombre_norm, tel_norm (migración hardening_funciones).
