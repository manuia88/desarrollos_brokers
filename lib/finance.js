// ============================================================
// Módulo financiero — funciones PURAS (sin estado, sin DOM).
// Todos los montos en MXN. Las tasas se pasan como decimal anual
// (0.105 = 10.5%). Verificado con golden datasets en scripts/finance.test.mjs
// ============================================================

// Redondeo a centavos para evitar arrastre de flotantes.
export function mxn2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Desglose del esquema de pago de una preventa.
// Los porcentajes (enganche + obra + escritura) representan el 100% del precio.
// El apartado es un anticipo fijo que va A CUENTA del enganche (no se suma aparte).
export function esquemaPago(precio, opts) {
  const p = Number(precio) || 0;
  const enganchePct = Number(opts.enganchePct) || 0;
  const obraPct = Number(opts.obraPct) || 0;
  const escrituraPct = Number(opts.escrituraPct) || 0;
  const apartadoInput = Number(opts.apartado) || 0;
  const meses = Math.max(0, Math.floor(Number(opts.meses) || 0));

  const enganche = mxn2(p * enganchePct);
  const apartado = mxn2(Math.min(apartadoInput, enganche));
  const engancheRestante = mxn2(enganche - apartado);
  const montoObra = mxn2(p * obraPct);
  const mensualidadObra = mxn2(meses > 0 ? montoObra / meses : montoObra);
  const saldoEscritura = mxn2(p * escrituraPct);

  return {
    precio: p,
    enganche, apartado, engancheRestante,
    montoObra, meses, mensualidadObra,
    saldoEscritura,
    // suma de control: debe reconstruir el precio si los % suman 1
    totalEsquema: mxn2(enganche + montoObra + saldoEscritura),
  };
}

// Mensualidad de un crédito con amortización francesa (pago fijo).
// monto: capital a financiar. tasaAnual: decimal. anios: plazo en años.
export function mensualidadCredito(monto, tasaAnual, anios) {
  const M = Number(monto) || 0;
  const n = Math.round((Number(anios) || 0) * 12);
  const r = (Number(tasaAnual) || 0) / 12;
  if (n <= 0 || M <= 0) return 0;
  if (r === 0) return mxn2(M / n);
  const f = Math.pow(1 + r, n);
  return mxn2((M * r * f) / (f - 1));
}

// Costo total y total de intereses del crédito a lo largo del plazo.
export function resumenCredito(monto, tasaAnual, anios) {
  const pago = mensualidadCredito(monto, tasaAnual, anios);
  const n = Math.round((Number(anios) || 0) * 12);
  const totalPagado = mxn2(pago * n);
  return {
    mensualidad: pago,
    meses: n,
    totalPagado,
    intereses: mxn2(totalPagado - (Number(monto) || 0)),
  };
}

// Tasas anuales por defecto por tipo de crédito (editables por el asesor).
// Son referencias aproximadas — Infonavit varía por salario; el asesor ajusta.
export const TASAS_DEFAULT = {
  Infonavit: 0.0900,
  FOVISSSTE: 0.0990,
  Bancario: 0.1150,
};
