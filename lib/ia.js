import { tituloDev } from './nombre.js';
// Capa de IA con BYOK (bring your own key).
// La llave se resuelve en cascada: broker -> su inmobiliaria -> variable de entorno
// (solo para pruebas de la plataforma) -> ninguna. Así la plataforma NO paga el uso de nadie.
import { descifrar } from './cripto.js';

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

// Lee un PDF NATIVO con visión usando OpenAI (Chat Completions con archivo).
// Da paridad de OCR/visión para brokers que conectaron una llave de OpenAI.
export async function llamarIADocOpenAI({ apiKey, system, pregunta, pdfBase64, maxTokens = 1500, model }) {
  if (!apiKey) throw new Error('IA no configurada');
  const m = model || 'gpt-4o';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: m, max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [
          { type: 'file', file: { filename: 'documento.pdf', file_data: 'data:application/pdf;base64,' + pdfBase64 } },
          { type: 'text', text: pregunta },
        ] },
      ],
    }),
  });
  if (!r.ok) throw new Error('IA (OpenAI doc) error ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || '';
}

// Envoltura: lee un PDF con visión con el proveedor que sea (Anthropic u OpenAI).
export async function leerPdfVision({ proveedor, apiKey, system, pregunta, pdfBase64, maxTokens = 1500 }) {
  if (proveedor === 'openai') return llamarIADocOpenAI({ apiKey, system, pregunta, pdfBase64, maxTokens });
  return llamarIADoc({ apiKey, system, pregunta, pdfBase64, maxTokens });
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
export async function resolverIA(db, userId, opts = {}) {
  const permitirPlataforma = opts.permitirPlataforma !== false; // por defecto sí (endpoints internos)
  if (userId && db) {
    try {
      const { data: prof } = await db.from('profiles').select('org_id').eq('id', userId).maybeSingle();
      const orgId = prof?.org_id || null;
      const { data: conns } = await db.from('conexiones').select('scope,asesor_id,org_id,ambiente,api_key').eq('proveedor', 'ia').eq('activa', true);
      const list = conns || [];
      const propia = list.find(c => c.scope === 'asesor' && c.asesor_id === userId);
      const dorg = orgId ? list.find(c => c.scope === 'org' && c.org_id === orgId) : null;
      const chosen = propia || dorg;
      if (chosen) { const key = descifrar(chosen.api_key); if (key) return { proveedor: chosen.ambiente === 'openai' ? 'openai' : 'anthropic', apiKey: key, fuente: propia ? 'broker' : 'org', orgId }; }
    } catch {
      // Error de BD/red: NO caer a la llave de plataforma (evita gasto involuntario). Sin IA.
      return null;
    }
  }
  if (permitirPlataforma) {
    if (process.env.ANTHROPIC_API_KEY) return { proveedor: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, fuente: 'plataforma' };
    if (process.env.OPENAI_API_KEY) return { proveedor: 'openai', apiKey: process.env.OPENAI_API_KEY, fuente: 'plataforma' };
  }
  return null;
}

// Resolución para canales PÚBLICOS: primero la llave propia (broker -> su org);
// si no hay ninguna, cae a la llave de la plataforma como PRUEBA gratis (trial:true),
// para que una inmobiliaria nueva vea el asistente funcionando antes de conectar la suya.
// Devuelve { proveedor, apiKey, orgId, trial } o null (sin llave propia y sin plataforma).
export async function resolverIAPublica(db, asesorId, orgId) {
  let propia = asesorId ? await resolverIA(db, asesorId, { permitirPlataforma: false }) : null;
  if (!propia && orgId) propia = await resolverIAOrg(db, orgId);
  if (propia) return { ...propia, orgId: propia.orgId || orgId, trial: false };
  if (process.env.ANTHROPIC_API_KEY) return { proveedor: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, orgId, fuente: 'trial', trial: true };
  if (process.env.OPENAI_API_KEY) return { proveedor: 'openai', apiKey: process.env.OPENAI_API_KEY, orgId, fuente: 'trial', trial: true };
  return null;
}

// Llave de IA a nivel inmobiliaria (widget/canales de la org, sin asesor conocido).
export async function resolverIAOrg(db, orgId) {
  if (!db || !orgId) return null;
  try {
    const { data: c } = await db.from('conexiones').select('ambiente,api_key').eq('proveedor', 'ia')
      .eq('scope', 'org').eq('org_id', orgId).eq('activa', true).limit(1).maybeSingle();
    if (!c) return null;
    const key = descifrar(c.api_key);
    return key ? { proveedor: c.ambiente === 'openai' ? 'openai' : 'anthropic', apiKey: key, fuente: 'org', orgId } : null;
  } catch { return null; }
}

// Resumen compacto de un desarrollo para el contexto del concierge.
export function contextoDesarrollo(d, units) {
  const g = {};
  (units || []).forEach(u => { const k = u.rec ?? 0; (g[k] = g[k] || []).push(u.precio || Infinity); });
  const modelos = Object.entries(g).map(([rec, ps]) => `${rec === '0' ? 'Loft' : rec + ' rec'} desde ${MXN(Math.min(...ps))} (${ps.length} disp.)`).join('; ');
  const f = d.ficha || {};
  const creditos = [d.credito_ion && 'ION', d.credito_hir && 'HIR Casa', d.credito_bancario && 'Bancario'].filter(Boolean).join(', ');
  return [
    `Desarrollo: ${tituloDev(d)} (${d.colonia || ''}, ${d.alcaldia || ''}, ${d.estado || ''}).`,
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

// ============================================================
// Tool use (function calling) con ambos proveedores.
// herramientas: [{ name, description, input_schema }] (JSON Schema, formato Anthropic).
// ejecutar(name, args) -> Promise<objeto serializable> (el resultado que ve el modelo).
// Devuelve { texto, tokens_in, tokens_out, usadas: [nombres] }.
// ============================================================
export async function llamarIATools({ proveedor, apiKey, system, mensajes, herramientas, ejecutar, maxTokens = 600, maxVueltas = 5, model }) {
  if (!apiKey) throw new Error('IA no configurada');
  let tin = 0, tout = 0; const usadas = [];

  if (proveedor === 'openai') {
    const m = model || process.env.IA_MODEL_OPENAI || 'gpt-4o-mini';
    const tools = herramientas.map(h => ({ type: 'function', function: { name: h.name, description: h.description, parameters: h.input_schema } }));
    const msgs = [{ role: 'system', content: system }, ...mensajes];
    for (let v = 0; v < maxVueltas; v++) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model: m, max_tokens: maxTokens, messages: msgs, tools }),
      });
      if (!r.ok) throw new Error('IA (OpenAI) error ' + r.status);
      const j = await r.json();
      tin += j.usage?.prompt_tokens || 0; tout += j.usage?.completion_tokens || 0;
      const msg = j.choices?.[0]?.message;
      if (!msg?.tool_calls?.length) return { texto: (msg?.content || '').trim(), tokens_in: tin, tokens_out: tout, usadas };
      msgs.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {}; try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* args vacíos */ }
        usadas.push(tc.function?.name);
        let out; try { out = await ejecutar(tc.function?.name, args); } catch (e) { out = { error: String(e?.message || e) }; }
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 6000) });
      }
    }
    return { texto: '', tokens_in: tin, tokens_out: tout, usadas };
  }

  const m = model || process.env.IA_MODEL || 'claude-3-5-haiku-latest';
  const msgs = [...mensajes];
  for (let v = 0; v < maxVueltas; v++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: m, max_tokens: maxTokens, system, messages: msgs, tools: herramientas }),
    });
    if (!r.ok) throw new Error('IA (Anthropic) error ' + r.status);
    const j = await r.json();
    tin += j.usage?.input_tokens || 0; tout += j.usage?.output_tokens || 0;
    if (j.stop_reason !== 'tool_use') {
      return { texto: (j.content || []).map(b => b.text || '').join('').trim(), tokens_in: tin, tokens_out: tout, usadas };
    }
    msgs.push({ role: 'assistant', content: j.content });
    const results = [];
    for (const b of (j.content || []).filter(b => b.type === 'tool_use')) {
      usadas.push(b.name);
      let out; try { out = await ejecutar(b.name, b.input || {}); } catch (e) { out = { error: String(e?.message || e) }; }
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out).slice(0, 6000) });
    }
    msgs.push({ role: 'user', content: results });
  }
  return { texto: '', tokens_in: tin, tokens_out: tout, usadas };
}
