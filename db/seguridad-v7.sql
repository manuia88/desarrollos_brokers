-- ============================================================
-- Remediación v7 (auditoría v3 de verificación). YA APLICADO en Supabase (toqgeimczebtndkatczn)
-- vía migración MCP v7_ficha_og_eventos_notificar_cron. Registro versionado.
-- ============================================================

-- #1 ALTA — ficha_og filtraba metadata de desarrollos NO publicados (hermano de ficha_publica que
--   quedó sin gate en v5/v6). Ahora exige publicado=true (mismo criterio que ficha_publica).
create or replace function public.ficha_og(p_sku text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'nombre', d.nombre, 'precio_min', d.precio_min,
    'ubicacion', concat_ws(', ', d.colonia, d.alcaldia),
    'rec_min', d.rec_min, 'rec_max', d.rec_max, 'm2_min', d.m2_min, 'm2_max', d.m2_max,
    'portada', (select m.url from public.media m where m.dev_sku=d.sku and m.tipo in ('portada','render','foto')
                order by (m.tipo <> 'portada'), m.orden limit 1)
  ) from public.desarrollos d where d.sku = p_sku and coalesce(d.publicado,false) = true;
$$;

-- #2 MEDIA — eventos_insert dejaba org_id libre (inyección cross-org en analítica/heatmap).
--   Ahora el org_id debe ser el del llamador (o super).
drop policy if exists eventos_insert on public.eventos;
create policy eventos_insert on public.eventos for insert to authenticated
  with check (actor = auth.uid() and (app_is_super() or org_id = app_current_org()));

-- #6 (regresión v6) — el discriminador de notificar bloqueaba al cron pg_cron (rutear_sla corre sin
--   JWT -> claims vacío). Ahora el gate SOLO aplica a role='authenticated'; service_role e interno pasan.
create or replace function public.notificar(p_user uuid, p_tipo text, p_titulo text, p_cuerpo text, p_link text default null)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid; v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if p_user is null then return; end if;
  select org_id into v_org from public.profiles where id = p_user;
  if v_role = 'authenticated' then
    if not app_is_super() and (app_current_org() is null or app_current_org() is distinct from v_org) then return; end if;
  end if;
  insert into public.notificaciones(org_id, user_id, tipo, titulo, cuerpo, link)
  values (v_org, p_user, p_tipo, p_titulo, p_cuerpo, p_link);
end $$;

-- Cambios de código que acompañan v7 (en el repo, no BD):
--  #3 OAuth: /api/google/connect ya NO recibe el JWT en la query; POST con token en header -> nonce
--     de un solo uso -> GET ?n=nonce. (marca/page.js, components/MediosManager.js, connect/route.js)
--  #4 reminders/run: si TODOS los envíos fallan, libera el reclamo para reintentar (no se pierde).
--  #5 next.config.mjs: cabeceras X-Frame-Options/CSP frame-ancestors/HSTS/nosniff/Referrer-Policy.
--  #7 next -> 14.2.35 (parcha CVE-2025-29927 y otras). #8 xlsx -> SheetJS 0.20.3 (tarball oficial).
