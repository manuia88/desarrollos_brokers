-- ===== Módulo de agentes (aplicado como migraciones modulo_agentes + agente_cron_horario) =====
-- Registro versionado. El cron 'agente-proactivo' llama /api/agente/cron cada hora con
-- el header x-cron-secret: <TU_CRON_SECRET> (mismo secreto que recordatorios; NO va en el repo).

-- Modo del agente por inmobiliaria: off | sugerir (borradores que aprueba el asesor) | auto
alter table public.orgs add column if not exists agente_modo text not null default 'auto';
alter table public.orgs add constraint orgs_agente_modo_chk check (agente_modo in ('off','sugerir','auto'));

-- Citas: origen 'bot' para el KPI "citas agendadas por el asistente"
alter table public.citas add column if not exists origen text;

-- Mensajes: canal (whatsapp|telegram|web), estado (enviado|borrador|descartado), tokens
alter table public.wa_mensajes
  add column if not exists canal text not null default 'whatsapp',
  add column if not exists estado text not null default 'enviado',
  add column if not exists tokens_in integer,
  add column if not exists tokens_out integer;
create index if not exists wa_msj_org_tel on public.wa_mensajes (org_id, canal, telefono, creado desc);

-- Estado por conversación: pausa humana (el bot NO contesta encima del asesor), no leídos, lead
create table if not exists public.agente_conversaciones (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  canal text not null default 'whatsapp',
  contacto text not null,
  lead_id bigint,
  estado text not null default 'bot' check (estado in ('bot','pausado')),
  pausado_hasta timestamptz,
  ultimo text, ultimo_rol text,
  no_leidos int not null default 0,
  actualizado timestamptz not null default now(),
  creado timestamptz not null default now(),
  unique (org_id, canal, contacto)
);

-- Dedupe de toques proactivos (cadencia_1/2/3, precio:<dev>:<dia>, noshow:<cita>)
create table if not exists public.agente_toques (
  id bigint generated always as identity primary key,
  lead_id bigint not null,
  tipo text not null,
  enviado_at timestamptz not null default now(),
  unique (lead_id, tipo)
);

-- RLS: el panel lee lo de su org; escrituras solo vía service role (API server)
alter table public.agente_conversaciones enable row level security;
create policy conv_select on public.agente_conversaciones for select
  using (app_is_super() or org_id = app_current_org());
alter table public.agente_toques enable row level security;   -- sin policies: solo service
alter table public.wa_mensajes enable row level security;
create policy wa_select on public.wa_mensajes for select
  using (app_is_super() or org_id = app_current_org());

-- Consumo de tokens por día (para el tile "costo del mes" del panel)
alter table public.ia_cuota_dia
  add column if not exists tokens_in bigint not null default 0,
  add column if not exists tokens_out bigint not null default 0;
-- ia_registrar_tokens(clave, in, out): upsert diario; solo service (revoke a public/anon/authenticated).
-- cuota_select: cada org puede leer su propia fila 'org:<uuid>'.

-- Retención (pg_cron 'agente-retencion', diario): wa_mensajes >90d, conversaciones muertas >180d.

-- (auditoría funcional) Las policies no bastan sin GRANT de tabla — migración agente_grants:
-- grant select on agente_conversaciones, wa_mensajes, ia_cuota_dia to authenticated;

-- (sesión 2) Aviso "te están viendo": registrar_vista ahora notifica al asesor cuando un
-- cliente identificado (client card) abre su ficha compartida — dedupe 1/hora por
-- cliente+desarrollo (migraciones liga_abierta_aviso + liga_abierta_texto_limpio).
-- Nota: el aviso usa desarrollos.nombre crudo (el mapa de títulos vive en JS, no se duplica en SQL).
