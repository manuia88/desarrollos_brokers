// Capa de IA con BYOK (bring your own key).
// La llave se resuelve en cascada: broker -> su inmobiliaria -> variable de entorno
// (solo para pruebas de la plataforma) -> ninguna. Así la plataforma NO paga el uso de nadie.
import { descifrar } from './cripto';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

// Llama al LLM con una llave EXPLÍCITA. proveedor: 'anthropic' (default) | 'openai'.
export async function llamarIA({ proveedor, apiKey, system, mensajes, maxTokens = 600, model }) {
  if (!apiKey) throw new Error('IA no configurada');
  if (proveedor === 'openai') {
    const m = model || process.env.IA_MODEL || 'gpt-4o-mini';
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model: m, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...mensajes] }),
    });
    if (!r.ok) throw new Error('IA (OpenAI) error ' + r.status);
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() || '';
  }
  const m = model || process.env.IA_MODEL || 'claude-3-5-haiku-latest';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: m, max_tokens: maxTokens, system, messages: mensajes }),
  });
  if (!r.ok) throw new Error('IA (Anthropic) error ' + r.status);
  const j = await r.json();
  return (j.content || []).map(b => b.text || '').join('').trim();
}

// Lee un PDF NATIVO con visión (para escaneos/imágenes). Solo Anthropic por ahora.
export async function llamarIADoc({ apiKey, system, pregunta, pdfBase64, maxTokens = 1500, model }) {
  if (!apiKey) throw new Error('IA no configurada');
  const m = model || 'claude-3-5-sonnet-latest';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: m, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: pregunta },
      ] }],
    }),
  });
  if (!r.ok) throw new Error('IA (Anthropic doc) error ' + r.status);
  const j = await r.json();
  return (j.content || []).map(b => b.text || '').join('').trim();
}

// Validación ligera de una llave al conectarla (una llamada mínima).
export async function validarIA(proveedor, apiKey) {
  try {
    const out = await llamarIA({ proveedor, apiKey, system: 'Contesta solo: ok', mensajes: [{ role: 'user', content: 'ok' }], maxTokens: 5 });
    return !!out;
  } catch { return false; }
}

// Resuelve la llave de IA para un usuario (broker/asesor): su conexión, luego la de su org,
// luego el entorno (pruebas de plataforma), luego null. Devuelve {proveedor, apiKey, fuente}.
export async function resolverIA(db, userId) {
  try {
    if (userId && db) {
      const { data: prof } = await db.from('profiles').select('org_id').eq('id', userId).maybeSingle();
      const orgId = prof?.org_id || null;
      const { data: conns } = await db.from('conexiones').select('scope,asesor_id,org_id,ambiente,api_key').eq('proveedor', 'ia').eq('activa', true);
      const list = conns || [];
      const propia = list.find(c => c.scope === 'asesor' && c.asesor_id === userId);
      const dorg = orgId ? list.find(c => c.scope === 'org' && c.org_id === orgId) : null;
      const chosen = propia || dorg;
      if (chosen) { const key = descifrar(chosen.api_key); if (key) return { proveedor: chosen.ambiente === 'openai' ? 'openai' : 'anthropic', apiKey: key, fuente: propia ? 'broker' : 'org' }; }
    }
  } catch { /* cae al entorno */ }
  if (process.env.ANTHROPIC_API_KEY) return { proveedor: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, fuente: 'plataforma' };
  if (process.env.OPENAI_API_KEY) return { proveedor: 'openai', apiKey: process.env.OPENAI_API_KEY, fuente: 'plataforma' };
  return null;
}

// Resumen compacto de un desarrollo para el contexto del concierge.
export function contextoDesarrollo(d, units) {
  const g = {};
  (units || []).forEach(u => { const k = u.rec ?? 0; (g[k] = g[k] || []).push(u.precio || Infinity); });
  const modelos = Object.entries(g).map(([rec, ps]) => `${rec === '0' ? 'Loft' : rec + ' rec'} desde ${MXN(Math.min(...ps))} (${ps.length} disp.)`).join('; ');
  const f = d.ficha || {};
  const creditos = [d.credito_ion && 'ION', d.credito_hir && 'HIR Casa', d.credito_bancario && 'Bancario'].filter(Boolean).join(', ');
  return [
    `Desarrollo: ${d.nombre} (${d.colonia || ''}, ${d.alcaldia || ''}, ${d.estado || ''}).`,
    d.direccion && `Dirección: ${d.direccion}.`,
    `Precios: ${MXN(d.precio_min)} a ${MXN(d.precio_max)}.`,
    `Recámaras ${d.rec_min}–${d.rec_max}, baños ${d.banos_min}–${d.banos_max}, estac. ${d.estac_min}–${d.estac_max}, ${Math.round(d.m2_min)}–${Math.round(d.m2_max)} m².`,
    modelos && `Modelos disponibles: ${modelos}.`,
    `Etapa: ${d.etapa || '—'}${d.fecha_entrega ? `, entrega ${d.fecha_entrega}` : ''}.`,
    `Esquema de pago base: apartado ${MXN(d.apartado)}, firma de contrato 15%, mensualidades en obra 10%, escritura 75% (este 75% suele financiarse con crédito).`,
    creditos && `Créditos aceptados: ${creditos}.`,
    d.amenidades && `Amenidades: ${d.amenidades}.`,
    f['Mantenimiento mensual'] && `Mantenimiento: ${f['Mantenimiento mensual']}.`,
  ].filter(Boolean).join('\n');
}
