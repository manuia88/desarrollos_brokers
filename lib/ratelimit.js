// Límites contra abuso de costo/spam. Dos capas:
//  - rateLimit(): ventana en memoria por instancia (frena ráfagas inmediatas).
//  - cuotaOrgIA(): tope diario por inmobiliaria en BD (persistente entre instancias).

const buckets = new Map();

// true si la clave sigue dentro del límite (max eventos por windowMs).
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (b.n >= max) return false;
  b.n++;
  // Limpieza perezosa para no crecer sin fin.
  if (buckets.size > 5000) { for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k); }
  return true;
}

// Tope diario de llamadas a IA por org (vía RPC service_role). true = puede seguir.
export async function cuotaOrgIA(db, orgId, max = 500) {
  if (!orgId) return true;
  try { const { data } = await db.rpc('ia_consumir', { p_org: orgId, p_max: max }); return data !== false; }
  catch { return true; }  // no bloquear por un fallo del contador
}

export function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
