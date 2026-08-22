import assert from 'node:assert/strict';
import { llamarIATools } from '../lib/ia.js';

// Stub de fetch: 1a vuelta pide tool, 2a responde texto. Captura los bodies enviados.
const bodies = [];
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body); bodies.push(body);
  const vuelta = bodies.length;
  if (vuelta === 1) return { ok: true, json: async () => ({
    stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 20 },
    content: [{ type: 'tool_use', id: 't1', name: 'buscar', input: { q: 1 } }],
  }) };
  return { ok: true, json: async () => ({
    stop_reason: 'end_turn', usage: { input_tokens: 50, cache_read_input_tokens: 90, output_tokens: 30 },
    content: [{ type: 'text', text: 'Listo, tengo 2 opciones.' }],
  }) };
};

const r = await llamarIATools({
  proveedor: 'anthropic', apiKey: 'x',
  system: 'sys de prueba',
  mensajes: [{ role: 'user', content: '<cliente>\nhola\n</cliente>' }],
  herramientas: [{ name: 'buscar', description: 'd', input_schema: { type: 'object', properties: {} } }],
  ejecutar: async () => ({ ok: true, opciones: [1, 2] }),
});

// 1) system va como array con cache_control
assert.ok(Array.isArray(bodies[0].system) && bodies[0].system[0].cache_control, 'system cacheado');
// 2) última herramienta con cache_control
const t = bodies[0].tools; assert.ok(t[t.length - 1].cache_control, 'tools cacheado');
// 3) último mensaje con cache_control en su último bloque
const m = bodies[0].messages; const last = m[m.length - 1];
assert.ok(Array.isArray(last.content) && last.content[last.content.length - 1].cache_control, 'mensaje cacheado');
// 4) el loop funcionó: 2 vueltas, texto final, tokens sumados (incluye cache_read)
assert.equal(bodies.length, 2);
assert.equal(r.texto, 'Listo, tengo 2 opciones.');
assert.equal(r.usadas[0], 'buscar');
assert.equal(r.tokens_in, 100 + 50 + 90);  // suma input + cache_read
assert.equal(r.tokens_out, 50);
// 5) no se mutó la constante de herramientas original (sin cache_control)
console.log('cache_check OK ✓');
