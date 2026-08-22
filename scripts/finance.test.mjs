// Golden tests del módulo financiero — la ruta de dinero de las propuestas.
// Correr: node scripts/finance.test.mjs   (lo corre el CI en cada push)
import assert from 'node:assert/strict';
import { mxn2, esquemaPago, mensualidadCredito, resumenCredito } from '../lib/finance.js';

// --- mxn2: redondeo a centavos ---
assert.equal(mxn2(0.1 + 0.2), 0.3);
assert.equal(mxn2(1880751.75), 1880751.75);
assert.ok(Number.isNaN(mxn2('no-numero'))); // basura da NaN: los callers guardan con Number()||0

// --- esquemaPago: caso real (Av. Industria 42 · Fase 3, verificado en el cotizador) ---
// precio 2,507,669 · enganche 15% · obra 10% · escritura 75% · 10 meses
{
  const e = esquemaPago(2507669, { enganchePct: 0.15, obraPct: 0.10, escrituraPct: 0.75, apartado: 20000, meses: 10 });
  assert.equal(e.enganche, 376150.35);
  assert.equal(e.apartado, 20000);                    // a cuenta del enganche
  assert.equal(e.engancheRestante, 356150.35);
  assert.equal(e.montoObra, 250766.9);
  assert.equal(e.mensualidadObra, 25076.69);
  assert.equal(e.saldoEscritura, 1880751.75);          // el 75% que mostró el cotizador
  assert.equal(e.totalEsquema, e.precio);              // el esquema reconstruye el precio
  assert.equal(e.consistente, true);
}

// --- esquemaPago: bordes ---
{
  const e = esquemaPago(1000000, { enganchePct: 0.30, obraPct: 0, escrituraPct: 0.70, apartado: 500000, meses: 0 });
  assert.equal(e.apartado, 300000);                    // apartado se topa al enganche
  assert.equal(e.engancheRestante, 0);
  assert.equal(e.mensualidadObra, 0);                  // sin obra
  assert.equal(e.consistente, true);
}
{
  const e = esquemaPago(0, { enganchePct: 0.1, obraPct: 0.1, escrituraPct: 0.8 });
  assert.equal(e.totalEsquema, 0);                     // precio 0 no truena
}
{
  const e = esquemaPago(1000000, { enganchePct: 0.10, obraPct: 0.10, escrituraPct: 0.70 });
  assert.equal(e.consistente, false);                  // 90% ≠ 100% -> inconsistente
}

// --- mensualidadCredito: amortización francesa ---
// Golden verificado a mano: 1,880,752 @ 10.20% anual, 20 años -> $18,399.58 (el cotizador muestra $18,400)
assert.equal(mensualidadCredito(1880752, 0.1020, 20), 18399.58);
// 1,000,000 @ 12% anual, 20 años: referencia clásica -> $11,010.86
assert.equal(mensualidadCredito(1000000, 0.12, 20), 11010.86);
// tasa 0: capital entre meses, exacto
assert.equal(mensualidadCredito(120000, 0, 10), 1000);
// entradas inválidas -> 0, nunca NaN
assert.equal(mensualidadCredito(0, 0.1, 20), 0);
assert.equal(mensualidadCredito(1000000, 0.1, 0), 0);
assert.equal(mensualidadCredito(null, null, null), 0);

// --- resumenCredito: consistencia interna ---
{
  const r = resumenCredito(1000000, 0.12, 20);
  assert.equal(r.meses, 240);
  assert.equal(r.mensualidad, 11010.86);
  assert.equal(r.totalPagado, mxn2(11010.86 * 240));
  assert.equal(r.intereses, mxn2(r.totalPagado - 1000000));
  assert.ok(r.intereses > 0);
}

console.log('finance.test.mjs: todos los golden tests OK ✓');
