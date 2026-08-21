-- Alta directa de inmobiliarias que Manu administra (super_admin de la plataforma).
-- No pasan por registrar_org() a propósito: Manu NO debe convertirse en director de
-- ninguna org (perdería super_admin). Se crean como orgs activas y él las opera con
-- "Ver como" + las fija en "Mis inmobiliarias" (pins) desde la SuperBar.
--
-- Ejecutado en vivo el 2026-08-21 (proyecto toqgeimczebtndkatczn).
-- Quiero Casa ya existía como tipo='desarrollador' + es_master_broker=true.

insert into public.orgs (nombre, tipo, estado)
values ('IAD',    'inmobiliaria', 'activo'),
       ('TuHabi', 'inmobiliaria', 'activo'),
       ('Pulppo', 'inmobiliaria', 'activo')
on conflict do nothing
returning id, nombre, nombre_norm;

-- Resultado:
--   IAD     -> nombre_norm IAD
--   TuHabi  -> nombre_norm TUHABI
--   Pulppo  -> nombre_norm PULPPO
--
-- El índice trigram + nombre_norm ya bloquea futuros duplicados (PULPPO PROPIEDADES,
-- INMOBILIARIA PULPPO SA DE CV, etc. colapsan todos a PULPPO).
