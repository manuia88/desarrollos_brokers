-- Un desarrollador puede además funcionar como inmobiliaria/master broker (recluta vendedores).
-- (Aplicado vía migración org_master_broker.)
alter table public.orgs add column if not exists es_master_broker boolean not null default false;

-- Ejemplo: Quiero Casa es desarrollador y también administra vendedores.
update public.orgs set es_master_broker = true
 where tipo = 'desarrollador' and nombre_norm = public.nombre_norm('Quiero Casa');

-- buscar_orgs y solicitar_ingreso ahora permiten unirse a: tipo='inmobiliaria' OR es_master_broker.
-- (Ver definiciones completas en db/registro-inmobiliarias.sql — mismas funciones con esa condición.)
