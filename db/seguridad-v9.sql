-- Remediación v9 (residual #5 de la auditoría v4). Aplicado en Supabase vía v9_horarios_tras_endpoint.
-- horarios_asesor ya NO es ejecutable por anon; la ocupación se sirve por /api/agenda/horarios
-- (service_role) validando desarrollo publicado + rate-limit por IP y por asesor. Ficha pública
-- actualizada para consumir ese endpoint. Cierra la enumeración de agenda por UUID directo.
revoke execute on function public.horarios_asesor(uuid) from anon, public;
grant  execute on function public.horarios_asesor(uuid) to service_role, authenticated;
