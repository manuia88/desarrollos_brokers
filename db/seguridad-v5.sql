-- ============================================================
-- Remediación de seguridad v5 (auditoría). YA APLICADO en Supabase (project toqgeimczebtndkatczn)
-- vía migraciones MCP. Este archivo queda como registro versionado.
-- Migraciones: harden_public_definer_functions, harden_grants_rls_maintenance,
--              fix_function_execute_grants, ia_cuota_diaria_por_org.
-- ============================================================

-- 1) Token opaco para tarjetas de cliente (cierra enumeración de PII).
alter table public.client_cards add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists client_cards_token_idx on public.client_cards(token);

drop function if exists public.cliente_card_publica(bigint, uuid);
create or replace function public.cliente_card_publica(p_token text, p_asesor uuid)
returns table(nombre text, telefono text, email text)
language sql stable security definer set search_path to 'public' as $$
  select c.nombre, c.telefono, c.email
  from client_cards c join profiles p on p.id = p_asesor
  where c.token::text = p_token and c.org_id = p.org_id limit 1;
$$;
grant execute on function public.cliente_card_publica(text, uuid) to anon, authenticated;

-- 2) ficha_publica: solo desarrollos PUBLICADOS + lista blanca de columnas + unidades acotadas.
--    (ver definición completa aplicada en la migración harden_public_definer_functions)

-- 3) cliente_registrado: exige contexto autenticado; no revela identidad de otra inmobiliaria.
--    revoke execute ... from public, anon; grant ... to authenticated.

-- 4) notificar: solo intra-org cuando hay contexto autenticado; revoke de anon.

-- 5) Funciones cron/mantenimiento: solo service_role.
revoke execute on function public.rutear_sla() from public, anon, authenticated;
grant  execute on function public.rutear_sla() to service_role;
revoke execute on function public.rutear_lead(bigint) from public, anon, authenticated;
grant  execute on function public.rutear_lead(bigint) to service_role;
revoke execute on function public.liberar_apartados_vencidos() from public, anon, authenticated;
grant  execute on function public.liberar_apartados_vencidos() to service_role;

-- 6) RLS de media por org/publicado.
drop policy if exists media_select on public.media;
create policy media_select on public.media for select using (
  app_is_super() or exists (
    select 1 from public.desarrollos d
    where d.sku = media.dev_sku and (d.dev_org_id = app_current_org() or coalesce(d.publicado, false) = true)));

-- 7) Mínimo privilegio.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;

-- 8) Tope diario de IA por inmobiliaria (anti abuso de costo del BYOK).
create table if not exists public.ia_cuota_dia (
  org_id uuid not null,
  dia date not null default (now() at time zone 'America/Mexico_City')::date,
  usados int not null default 0,
  primary key (org_id, dia));
alter table public.ia_cuota_dia enable row level security;
create or replace function public.ia_consumir(p_org uuid, p_max int)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_dia date := (now() at time zone 'America/Mexico_City')::date; v_usados int;
begin
  if p_org is null then return true; end if;
  insert into public.ia_cuota_dia(org_id, dia, usados) values (p_org, v_dia, 1)
    on conflict (org_id, dia) do update set usados = public.ia_cuota_dia.usados + 1
    returning usados into v_usados;
  return v_usados <= p_max;
end $$;
revoke execute on function public.ia_consumir(uuid, int) from public, anon, authenticated;
grant  execute on function public.ia_consumir(uuid, int) to service_role;
