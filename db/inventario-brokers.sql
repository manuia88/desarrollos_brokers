-- Disponibilidad de inventario para brokers.
-- Ya existía desarrollos.publicado (abre el desarrollo a brokers) y dev_org_id (dueño).
-- Se agrega control POR UNIDAD. (Aplicado vía migración unidad_publicado_brokers.)

alter table public.unidades add column if not exists publicado boolean not null default true;

-- Brokers ven una unidad sólo si su desarrollo está publicado Y la unidad está publicada.
-- El dueño (dev_org_id = su org) sigue viendo todas las suyas; el super ve todo.
drop policy if exists uni_select on public.unidades;
create policy uni_select on public.unidades for select using (
  app_is_super() or exists (
    select 1 from public.desarrollos d
    where d.sku = unidades.dev_sku
      and ( d.dev_org_id = app_current_org()
            or ( app_is_active() and coalesce(d.publicado, true) and coalesce(unidades.publicado, true) ) )
  )
);
