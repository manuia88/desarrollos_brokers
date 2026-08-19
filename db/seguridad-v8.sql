-- ============================================================
-- Remediación v8 (auditoría v4 de cierre). YA APLICADO en Supabase (toqgeimczebtndkatczn)
-- vía migración MCP v8_agendar_publica_y_grants. Registro versionado.
-- El ciclo de auditoría cerró: 0 críticas, 0 altas. v8 tapa 2 medias + 1 baja restantes.
-- ============================================================

-- #3 (media): agendar_cita_publica — el flujo ANÓNIMO ya no avanza la etapa de un lead existente
--   (evita tampering del pipeline) y exige que el desarrollo esté publicado.
--   (definición completa en la migración v8_agendar_publica_y_grants)

-- #4 (baja): quitar DML directo de anon/authenticated en ia_cuota_dia (la contabilidad pasa solo
--   por ia_consumir con service_role); elimina la dependencia única en el RLS deny-all.
revoke insert, update, delete, select on public.ia_cuota_dia from anon, authenticated;

-- Cambios de código que acompañan v8 (en el repo):
--  #1 (media): app/api/ia/copiloto/route.js -> .eq('publicado', true) en la consulta de desarrollos,
--     igual que concierge y whatsapp (cierra fuga latente de borradores cross-org al copiloto).
--  #2 (media): SETUP-RECORDATORIOS.md -> el valor real de CRON_SECRET se reemplazó por <TU_CRON_SECRET>;
--     .gitignore ahora excluye .env/.env.*. ACCIÓN DEL USUARIO PENDIENTE: rotar CRON_SECRET
--     (nuevo valor en Vercel env) y actualizar el header x-cron-secret de los cron.job en Supabase.

-- RESIDUALES ACEPTADOS (documentados; requisito del producto o acción de config del usuario):
--  #5 (baja) horarios_asesor: expone ocupación (fecha/hora, sin PII) a anon; lo necesita el widget
--     de agenda pública. Aceptado; cierre total = token efímero por asesor en vez de UUID directo.
--  #6 (baja) Supabase Auth: habilitar "leaked password protection" y política de fuerza mínima
--     en el dashboard (Auth → Policies). Acción de configuración del usuario.
