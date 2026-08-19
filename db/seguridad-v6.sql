-- ============================================================
-- Remediación v6 (auditoría profunda 2a pasada). YA APLICADO en Supabase (toqgeimczebtndkatczn)
-- vía migraciones MCP: v6_privesc_guards_and_rpc_gates, v6_storage_quota_grants_dedup,
-- y un ajuste de grants de crear_lead. Registro versionado.
-- ============================================================

-- #1 CRÍTICO — bloquear escalada a super_admin / cambio de org via PATCH a profiles (trigger).
create or replace function public.profiles_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('service_role','postgres','supabase_admin') then return NEW; end if;
  if app_is_super() then return NEW; end if;
  if NEW.rol is distinct from OLD.rol and NEW.rol = 'super_admin' then raise exception 'no autorizado para asignar super_admin'; end if;
  if NEW.org_id is distinct from OLD.org_id then NEW.org_id := OLD.org_id; end if;
  if NEW.id = auth.uid() and NEW.rol is distinct from OLD.rol then NEW.rol := OLD.rol; end if;
  return NEW;
end $$;
drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles for each row execute function public.profiles_guard();

-- #7 — impedir auto-aprobación de org (estado) y cambio de tipo por el director (trigger).
create or replace function public.orgs_guard() returns trigger language plpgsql security invoker as $$
begin
  if current_user in ('service_role','postgres','supabase_admin') then return NEW; end if;
  if app_is_super() then return NEW; end if;
  if NEW.estado is distinct from OLD.estado then NEW.estado := OLD.estado; end if;
  if NEW.tipo   is distinct from OLD.tipo   then NEW.tipo   := OLD.tipo;   end if;
  return NEW;
end $$;
drop trigger if exists orgs_guard_trg on public.orgs;
create trigger orgs_guard_trg before update on public.orgs for each row execute function public.orgs_guard();

-- #5 apartar_unidad: solo unidades publicadas (marketplace) o de tu org / super.
-- #6 apartado_set_split: dueño del deal o director/gerente/super + split_asesor de la org.
-- #12 set_eb_modo, #18 escritura_set, #17 asignar_lead: gate de rol director/gerente/super.
-- #9 notificar: bloquear el caso org NULL para autenticados (service_role sigue permitido por rol de JWT).
-- #16 ficha_publica: el bloque 'asesor' solo si el desarrollo existe y está publicado.
--   (definiciones completas en la migración v6_privesc_guards_and_rpc_gates)

-- #4 storage 'medios': SELECT solo de desarrollos publicados o de tu org.
drop policy if exists medios_obj_select on storage.objects;
create policy medios_obj_select on storage.objects for select to public using (
  bucket_id = 'medios' and exists (
    select 1 from public.desarrollos d
    where d.sku = (storage.foldername(name))[1]
      and (coalesce(d.publicado,false) = true or d.dev_org_id = app_current_org())));
-- #13 límites de tamaño/tipo del bucket.
update storage.buckets set file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf'] where id = 'medios';

-- #15 unicidad para serializar el envío de recordatorios.
create unique index if not exists reminders_enviados_cita_tipo_idx on public.reminders_enviados(cita_id, tipo);

-- #8/#14 cuota IA por CLAVE (org o asesor) — cierra el bypass de org nula.
drop function if exists public.ia_consumir(uuid, int);
drop table if exists public.ia_cuota_dia;
create table public.ia_cuota_dia (clave text not null, dia date not null default (now() at time zone 'America/Mexico_City')::date, usados int not null default 0, primary key (clave, dia));
alter table public.ia_cuota_dia enable row level security;
create or replace function public.ia_consumir(p_clave text, p_max int)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_dia date := (now() at time zone 'America/Mexico_City')::date; v_usados int;
begin
  if p_clave is null or p_clave = '' then return true; end if;
  insert into public.ia_cuota_dia(clave, dia, usados) values (p_clave, v_dia, 1)
    on conflict (clave, dia) do update set usados = public.ia_cuota_dia.usados + 1 returning usados into v_usados;
  return v_usados <= p_max;
end $$;
revoke execute on function public.ia_consumir(text, int) from public, anon, authenticated;
grant  execute on function public.ia_consumir(text, int) to service_role;

-- #20 revocar anon/PUBLIC en funciones privilegiadas que exigen sesión (grant authenticated):
--   aprobar_org, importar_fichas, apartar_unidad, autorizar_apartado, apartado_set_estatus,
--   apartado_set_split, asignar_lead, escritura_set, set_eb_modo, mis_conexiones, registrar_org, crear_lead.

-- RESIDUALES CONOCIDOS (no bloqueantes, documentados):
--  * Bucket 'medios' sigue public=true: cierre total = bucket privado + signed URLs (refactor de render). Enumeración por API ya cerrada.
--  * registrar_vista sigue anon (telemetría de vistas de la ficha pública); riesgo = inflar analítica (baja).
--  * leads_update RLS permite a cualquier miembro de la org cambiar asesor_id (la RPC asignar_lead ya exige gestor).
