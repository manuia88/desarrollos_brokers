// CRUD de client_cards (búsquedas guardadas por cliente) + reverse matching.
import { supabase } from './supabase';
import { fitScore } from './matching';

// Convierte una tarjeta guardada -> criterios para fitScore.
export function criteriosDeCard(card) {
  const c = card.criterios || {};
  return {
    presupuestoMin: card.presupuesto_min || c.presupuestoMin || null,
    presupuestoMax: card.presupuesto_max || c.presupuestoMax || null,
    recs: card.recamaras ? card.recamaras.split(',').filter(Boolean) : (c.recs || []),
    zonas: card.zonas || c.zonas || [],
    entregaBucket: c.entregaBucket || '',
    creditos: card.credito ? [card.credito] : (c.creditos || []),
    cajonesMin: c.cajonesMin || 0,
    bodega: !!c.bodega,
    amenidades: c.amenidades || [],
  };
}

export async function listarCards() {
  const { data } = await supabase.from('client_cards').select('*').eq('activo', true).order('creado', { ascending: false });
  return data || [];
}

export async function guardarCard(card) {
  const row = {
    nombre: card.nombre || 'Cliente sin nombre',
    telefono: card.telefono || null,
    email: card.email || null,
    presupuesto_min: card.presupuestoMin || null,
    presupuesto_max: card.presupuestoMax || null,
    recamaras: (card.recs && card.recs.length) ? card.recs.join(',') : null,
    zonas: card.zonas && card.zonas.length ? card.zonas : null,
    credito: (card.creditos && card.creditos[0]) || null,
    notas: card.notas || null,
    alertas: !!card.alertas,
    alertas_canal: card.alertas_canal || 'app',
    criterios: {
      recs: card.recs || [], zonas: card.zonas || [], entregaBucket: card.entregaBucket || '',
      creditos: card.creditos || [], cajonesMin: card.cajonesMin || 0, bodega: !!card.bodega,
      amenidades: card.amenidades || [], presupuestoMin: card.presupuestoMin || null, presupuestoMax: card.presupuestoMax || null,
    },
    activo: true,
  };
  // org_id / asesor_id los pone el trigger de la tabla o se completan aquí si hace falta.
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).maybeSingle();
    row.asesor_id = session.user.id;
    if (prof?.org_id) row.org_id = prof.org_id;
  }
  const { data, error } = await supabase.from('client_cards').insert(row).select().single();
  return { data, error };
}

export async function archivarCard(id) {
  return supabase.from('client_cards').update({ activo: false }).eq('id', id);
}

// Reverse matching: top-N unidades para una tarjeta.
export function mejoresMatches(card, devs, units, topN = 6) {
  const crit = criteriosDeCard(card);
  const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
  return units
    .map(u => { const d = byId[u.dev_sku]; if (!d) return null; const f = fitScore(u, d, crit); return { u, d, ...f }; })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
