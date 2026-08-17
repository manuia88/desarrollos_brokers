import { supabase } from './supabase';

// Registro ligero de actividad para métricas (búsquedas, precalificaciones, etc.).
// eventos.actor debe ser el usuario actual (lo exige el RLS).
export async function track(tipo, meta, me) {
  if (!me?.id) return;
  try {
    await supabase.from('eventos').insert({
      tipo, entidad: 'actividad', entidad_id: String(meta?.entidad_id ?? '-'),
      actor: me.id, org_id: me.org_id || null, meta: meta || {},
    });
  } catch { /* fire-and-forget */ }
}
