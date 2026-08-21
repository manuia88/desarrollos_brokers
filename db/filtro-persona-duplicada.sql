-- ============================================================
-- Filtro de persona duplicada: una persona no puede tener dos registros
-- (p.ej. asesor en una inmobiliaria y además broker independiente).
-- Se compara por correo, teléfono y nombre+teléfono. (Aplicado vía migración filtro_persona_duplicada.)
-- ============================================================

-- Teléfono a sus últimos 10 dígitos (ignora +52, espacios, guiones).
create or replace function public.tel_norm(t text) returns text language sql immutable as $$
  select right(regexp_replace(coalesce(t,''), '[^0-9]', '', 'g'), 10)
$$;

-- El alta de usuario ahora también copia el teléfono del metadata al perfil.
create or replace function public.app_handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles(id, email, nombre, telefono)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', new.email), new.raw_user_meta_data->>'telefono')
  on conflict (id) do nothing;
  return new;
end $$;

-- ¿La persona actual ya está registrada y activa en otro lado? Devuelve descripción o null.
create or replace function public.persona_conflicto() returns text
language plpgsql stable security definer set search_path to 'public' as $$
declare me record; hit record;
begin
  select email, nombre, telefono into me from profiles where id = auth.uid();
  select p.rol as rol, o.nombre as org into hit
  from profiles p left join orgs o on o.id = p.org_id
  where p.id <> auth.uid() and p.org_id is not null
    and (
      (me.email is not null and lower(p.email) = lower(me.email))
      or (public.tel_norm(me.telefono) <> '' and public.tel_norm(p.telefono) = public.tel_norm(me.telefono))
      or (public.nombre_norm(p.nombre) = public.nombre_norm(me.nombre)
          and public.tel_norm(me.telefono) <> '' and public.tel_norm(p.telefono) = public.tel_norm(me.telefono))
    )
  limit 1;
  if hit.rol is null then return null; end if;
  return case when hit.rol = 'independiente' then 'broker independiente'
              else 'asesor en ' || coalesce(hit.org, 'una inmobiliaria') end;
end $$;
revoke all on function public.persona_conflicto() from public, anon;
grant execute on function public.persona_conflicto() to authenticated;

-- El filtro se aplica dentro de registrar_org y solicitar_ingreso (ver db/registro-inmobiliarias.sql,
-- que ya incluye la llamada: v_conf := public.persona_conflicto();
--   if v_conf is not null then raise exception 'persona_duplicada|%', v_conf using errcode='23505'; end if;)
