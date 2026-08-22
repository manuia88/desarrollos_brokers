// Checks del Asesor Digital: la lógica pura que decide qué unidades ofrecer y
// qué horarios proponer. Correr: node scripts/agente.test.mjs (lo corre npm test).
import assert from 'node:assert/strict';
import { filtrarUnidades, generarHorarios, HERRAMIENTAS, promptAgente } from '../lib/agente.js';

// --- filtrarUnidades ---
const devs = {
  A: { alcaldia: 'Benito Juárez', etapa: 'Entrega inmediata' },
  B: { alcaldia: 'Coyoacán', etapa: 'Preventa' },
};
const unidades = [
  { dev_sku: 'A', precio: 3200000, rec: 2 },
  { dev_sku: 'A', precio: 2500000, rec: 1 },
  { dev_sku: 'B', precio: 2900000, rec: 2 },
  { dev_sku: 'X', precio: 1000000, rec: 3 },   // dev NO publicado: fuera siempre
  { dev_sku: 'B', precio: 9000000, rec: 3 },
];
{
  const r = filtrarUnidades(unidades, devs, { presupuesto_max: 3000000, recamaras: 2 });
  assert.deepEqual(r.map(u => u.precio), [2900000]);           // respeta presupuesto (+5%) y recámaras
  assert.ok(!r.some(u => u.dev_sku === 'X'));                  // jamás ofrece un dev no publicado
}
{
  const r = filtrarUnidades(unidades, devs, { alcaldia: 'coyoacán' });
  assert.ok(r.every(u => u.dev_sku === 'B'));                  // filtro de zona case-insensitive
}
{
  const r = filtrarUnidades(unidades, devs, { entrega_inmediata: true });
  assert.ok(r.every(u => u.dev_sku === 'A'));
}
{
  const r = filtrarUnidades(unidades, devs, {});
  assert.equal(r[0].precio, 2500000);                          // ordena de barato a caro
  assert.ok(r.length <= 5);
}

// --- generarHorarios ---
{
  const lunes = new Date('2026-08-24T09:00:00');               // lunes
  const libres = generarHorarios([], lunes);
  assert.equal(libres.length, 6);
  assert.ok(libres.every(h => new Date(h.fecha + 'T12:00').getDay() !== 0));  // nunca domingo
  assert.ok(libres.every(h => h.fecha > '2026-08-24'));        // nunca hoy ni pasado
}
{
  const lunes = new Date('2026-08-24T09:00:00');
  const ocupadas = [{ fecha: '2026-08-25', hora: '11:00' }, { fecha: '2026-08-25', hora: '13:00:00' }];
  const libres = generarHorarios(ocupadas, lunes);
  assert.ok(!libres.some(h => h.fecha === '2026-08-25' && ['11:00', '13:00'].includes(h.hora)));  // no choca (con y sin segundos)
}

// --- contrato de herramientas y prompt ---
assert.deepEqual(HERRAMIENTAS.map(h => h.name),
  ['buscar_unidades', 'info_desarrollo', 'cotizar', 'horarios_disponibles', 'agendar_cita', 'registrar_prospecto', 'pasar_a_humano']);
assert.ok(HERRAMIENTAS.every(h => h.input_schema?.type === 'object'));
const prompt = promptAgente({ lead: { nombre: 'Ana', dev_sku: 'AI3' }, nombreOrg: 'Prueba' });
assert.ok(prompt.includes('AGENDE UNA VISITA'));               // la meta es explícita
assert.ok(prompt.includes('SOLO de tus herramientas'));        // anti-invento estructural
assert.ok(prompt.includes('Ana'));                             // no re-pide datos al ya registrado

console.log('agente.test.mjs: lógica del Asesor Digital OK ✓');
