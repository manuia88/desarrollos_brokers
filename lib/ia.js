// Capa de IA. Llama al LLM configurado por variables de entorno en Vercel.
// Soporta Anthropic (ANTHROPIC_API_KEY) u OpenAI (OPENAI_API_KEY).
// Sin ninguna key -> iaConfigurada() = false y las rutas degradan con mensaje claro.

export function iaConfigurada() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// system: string. mensajes: [{role:'user'|'assistant', content:'...'}]
export async function llamarIA({ system, mensajes, maxTokens = 600 }) {
  const anth = process.env.ANTHROPIC_API_KEY;
  if (anth) {
    const model = process.env.IA_MODEL || 'claude-3-5-haiku-latest';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': anth, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: mensajes }),
    });
    if (!r.ok) throw new Error('IA (Anthropic) error ' + r.status);
    const j = await r.json();
    return (j.content || []).map(b => b.text || '').join('').trim();
  }
  const oai = process.env.OPENAI_API_KEY;
  if (oai) {
    const model = process.env.IA_MODEL || 'gpt-4o-mini';
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + oai },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...mensajes] }),
    });
    if (!r.ok) throw new Error('IA (OpenAI) error ' + r.status);
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() || '';
  }
  throw new Error('IA no configurada');
}

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

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
