-- Snapshot completo de cada unidad: guarda TODAS las columnas de la hoja (no sólo las tipadas).
-- Igual que desarrollos.ficha, garantiza que ninguna columna del Sheet se pierda al sincronizar
-- (incluye las columnas de cálculo: Enganche, Mensualidades, Escritura, Meses Restantes,
-- Mensualidad Estimada, Precio por m², y las ligas de plano).
-- La Edge Function sync-desarrollos llena este campo con la fila completa, keyed por encabezado
-- normalizado (quita el paréntesis final: "Enganche (15%)" -> "Enganche").
alter table public.unidades add column if not exists ficha jsonb not null default '{}'::jsonb;
