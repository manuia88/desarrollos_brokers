-- ============================================================
-- Registro de inmobiliarias con anti-duplicados + ingreso de asesores.
-- (Aplicado en vivo vía migraciones: orgs_nombre_norm_dedup, buscar_orgs_y_guard, solicitudes_ingreso.)
-- ============================================================

create extension if not exists pg_trgm;

-- Normaliza el nombre de una organización a su "raíz de marca".
create or replace function public.nombre_norm(txt text)
returns text language plpgsql immutable as $$
declare u text;
begin
  u := upper(coalesce(txt,''));
  u := translate(u, 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ', 'AAAAAEEEEIIIIOOOOOUUUUNC');
  u := regexp_replace(u, '\([^)]*\)', ' ', 'g');
  u := regexp_replace(u, 'S\.?\s*A\.?\s+DE\s+C\.?\s*V\.?', ' ', 'g');
  u := regexp_replace(u, 'S\.?\s+DE\s+R\.?\s*L\.?(\s+DE\s+C\.?\s*V\.?)?', ' ', 'g');
  u := regexp_replace(u, 'S\.?\s*A\.?\s*P\.?\s*I\.?(\s+DE\s+C\.?\s*V\.?)?', ' ', 'g');
  u := regexp_replace(u, 'S\.?\s*A\.?\s*B\.?', ' ', 'g');
  u := regexp_replace(u, 'SOFOM[A-Z. ]*', ' ', 'g');
  u := regexp_replace(u, 'S\.\s*C\.', ' ', 'g');
  u := regexp_replace(u, 'A\.\s*C\.', ' ', 'g');
  u := regexp_replace(u, '[^A-Z0-9]+', ' ', 'g');
  u := regexp_replace(u, '\m(INMOBILIARIAS?|INMOBILIARIO|PROPIEDADES|BIENES|RAICES|GRUPO|DESARROLLOS|DESARROLLADORA|ASESORES|ASESORIA|CONSULTORES|REALTY|REAL|ESTATE|PROPERTIES|GROUP|HOMES|CASAS?|VIVIENDA|CONSTRUCTORA|SC|AC|DE|DEL|LA|EL|LOS|LAS|Y)\M', ' ', 'g');
  u := btrim(regexp_replace(u, '\s+', ' ', 'g'));
  return u;
end $$;

alter table public.orgs add column if not exists nombre_norm text
  generated always as (public.nombre_norm(nombre)) stored;
create index if not exists orgs_nombre_norm_trgm on public.orgs using gin (nombre_norm gin_trgm_ops);

-- Búsqueda de inmobiliarias por raíz + parecido (el asesor elige, no escribe libre).
create or replace function public.buscar_orgs(q text)
returns table(id uuid, nombre text, tipo text, estado text, sim real)
language sql stable security definer set search_path to 'public' as $$
  select o.id, o.nombre, o.tipo, o.estado,
    round(greatest(similarity(o.nombre_norm, public.nombre_norm(q)),
                   case when o.nombre_norm = public.nombre_norm(q) then 1 else 0 end)::numeric, 3)::real
  from orgs o
  where o.tipo = 'inmobiliaria' and length(public.nombre_norm(q)) >= 2
    and (o.nombre_norm = public.nombre_norm(q) or o.nombre_norm % public.nombre_norm(q))
  order by 5 desc, o.nombre limit 10;
$$;
revoke all on function public.buscar_orgs(text) from public, anon;
grant execute on function public.buscar_orgs(text) to authenticated;

-- registrar_org con guard anti-duplicado + p_forzar (override).
drop function if exists public.registrar_org(text,text,text);
create or replace function public.registrar_org(p_nombre text, p_tipo text, p_rfc text, p_forzar boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid; v_dup_id uuid; v_dup_nombre text; v_tipo text := coalesce(p_tipo,'inmobiliaria');
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if (select org_id from profiles where id = auth.uid()) is not null then
    raise exception 'ya perteneces a una organización'; end if;
  if not coalesce(p_forzar,false) and v_tipo in ('inmobiliaria','desarrollador') then
    select id, nombre into v_dup_id, v_dup_nombre from orgs
     where tipo = v_tipo and nombre_norm <> ''
       and (nombre_norm = public.nombre_norm(p_nombre) or nombre_norm % public.nombre_norm(p_nombre))
     order by similarity(nombre_norm, public.nombre_norm(p_nombre)) desc, creado asc limit 1;
    if v_dup_id is not null then
      raise exception 'org_duplicada|%|%', v_dup_id, v_dup_nombre using errcode = '23505'; end if;
  end if;
  insert into orgs(nombre, tipo, estado, rfc) values (p_nombre, v_tipo, 'pendiente', p_rfc) returning id into v_org;
  update profiles set org_id = v_org,
    rol = case when v_tipo = 'independiente' then 'independiente' else 'director' end
  where id = auth.uid();
  perform app_audit('org','crear', v_org::text, jsonb_build_object('tipo', v_tipo));
  return v_org;
end $$;
grant execute on function public.registrar_org(text,text,text,boolean) to authenticated;

-- Solicitudes de ingreso de asesores a una inmobiliaria.
create table if not exists public.solicitudes_ingreso(
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  estado text not null default 'pendiente',
  nota text, creado timestamptz not null default now(), resuelto timestamptz, resuelto_por uuid
);
create unique index if not exists solicitudes_una_pendiente on public.solicitudes_ingreso(asesor_id) where estado = 'pendiente';
create index if not exists solicitudes_org_idx on public.solicitudes_ingreso(org_id) where estado = 'pendiente';
alter table public.solicitudes_ingreso enable row level security;
drop policy if exists sol_select_own on public.solicitudes_ingreso;
create policy sol_select_own on public.solicitudes_ingreso for select using (asesor_id = auth.uid());
revoke insert, update, delete on public.solicitudes_ingreso from anon, authenticated;

-- RPCs: pedir ingreso (asesor), ver la propia, bandeja del director, resolver.
create or replace function public.solicitar_ingreso(p_org uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if (select org_id from profiles where id = auth.uid()) is not null then raise exception 'ya perteneces a una organización'; end if;
  if not exists (select 1 from orgs where id = p_org and tipo = 'inmobiliaria') then raise exception 'inmobiliaria no encontrada'; end if;
  delete from solicitudes_ingreso where asesor_id = auth.uid() and estado = 'pendiente';
  insert into solicitudes_ingreso(asesor_id, org_id) values (auth.uid(), p_org) returning id into v_id;
  perform app_audit('solicitud','crear', v_id::text, jsonb_build_object('org', p_org));
  return v_id;
end $$;

create or replace function public.mi_solicitud()
returns table(id uuid, org_id uuid, org_nombre text, estado text, creado timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.org_id, o.nombre, s.estado, s.creado from solicitudes_ingreso s join orgs o on o.id = s.org_id
  where s.asesor_id = auth.uid() order by s.creado desc limit 1;
$$;

create or replace function public.solicitudes_pendientes()
returns table(id uuid, org_id uuid, org_nombre text, asesor_nombre text, asesor_email text, asesor_tel text, creado timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.org_id, o.nombre, p.nombre, p.email, p.telefono, s.creado
  from solicitudes_ingreso s join orgs o on o.id = s.org_id join profiles p on p.id = s.asesor_id
  where s.estado = 'pendiente'
    and ( app_is_super() or ( s.org_id = app_current_org() and (select rol from profiles where id = auth.uid()) = 'director' ) )
  order by s.creado;
$$;

create or replace function public.resolver_ingreso(p_sol uuid, p_aprobar boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare s record; v_rol text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into s from solicitudes_ingreso where id = p_sol;
  if not found then raise exception 'solicitud no encontrada'; end if;
  if s.estado <> 'pendiente' then raise exception 'la solicitud ya fue resuelta'; end if;
  select rol into v_rol from profiles where id = auth.uid();
  if not ( app_is_super() or (v_rol = 'director' and app_current_org() = s.org_id) ) then raise exception 'no autorizado'; end if;
  if p_aprobar then
    if (select org_id from profiles where id = s.asesor_id) is not null then
      update solicitudes_ingreso set estado='rechazada', nota='el asesor ya está en otra inmobiliaria', resuelto=now(), resuelto_por=auth.uid() where id = p_sol;
      return 'rechazada'; end if;
    update profiles set org_id = s.org_id, rol = 'asesor', activo = true where id = s.asesor_id;
    update solicitudes_ingreso set estado='aprobada', resuelto=now(), resuelto_por=auth.uid() where id = p_sol;
    perform app_audit('solicitud','aprobar', p_sol::text, jsonb_build_object('asesor', s.asesor_id, 'org', s.org_id));
    return 'aprobada';
  else
    update solicitudes_ingreso set estado='rechazada', resuelto=now(), resuelto_por=auth.uid() where id = p_sol;
    perform app_audit('solicitud','rechazar', p_sol::text, jsonb_build_object('asesor', s.asesor_id, 'org', s.org_id));
    return 'rechazada';
  end if;
end $$;

revoke all on function public.solicitar_ingreso(uuid) from public, anon;
revoke all on function public.mi_solicitud() from public, anon;
revoke all on function public.solicitudes_pendientes() from public, anon;
revoke all on function public.resolver_ingreso(uuid, boolean) from public, anon;
grant execute on function public.solicitar_ingreso(uuid) to authenticated;
grant execute on function public.mi_solicitud() to authenticated;
grant execute on function public.solicitudes_pendientes() to authenticated;
grant execute on function public.resolver_ingreso(uuid, boolean) to authenticated;
