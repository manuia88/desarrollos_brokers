-- PostgREST (la API de Supabase) devuelve máximo 1000 filas por consulta por defecto.
-- Con más de 1000 unidades, la app cargaba el inventario incompleto (solo las primeras 1000).
-- Subimos el tope a 50000 para el rol de la API. Idempotente.
alter role authenticator set pgrst.db_max_rows = '50000';
notify pgrst, 'reload config';
