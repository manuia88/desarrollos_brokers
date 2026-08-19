// Límites contra abuso de costo/spam. Dos capas:
//  - rateLimit(): ventana en memoria por instancia (frena ráfagas inmediatas).
//  - cuotaIA(): tope diario por CLAVE (org o asesor) en BD (persistente entre instancias).

const buckets = new Map();

// Barre las entradas expiradas (se llama antes de decidir, aun en camino de retorno temprano).
function podar(now) {
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}

// true si la clave sigue dentro del límite (max eventos por windowMs).
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) podar(now);  // poda incondicional al crecer, no solo en el camino de incremento
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (b.n >= max) return false;
  b.n++;
  return true;
}

// Tope diario de IA por clave (org o asesor) vía RPC service_role. true = puede seguir.
export async function cuotaIA(db, clave, max = 500) {
  if (!clave) return true;
  try { const { data } = await db.rpc('ia_consumir', { p_clave: String(clave), p_max: max }); return data !== false; }
  catch { return true; }  // no bloquear por un fallo del contador
}

export function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
