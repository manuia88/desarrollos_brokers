// ============================================================
// Motor de matching e inteligencia de inventario — funciones PURAS.
// Convierte "buscar" en "que el inventario encuentre al cliente".
// Reusa lib/finance.js para las dimensiones calculadas.
// ============================================================
import { mensualidadCredito, TASAS_DEFAULT } from './finance';

export const meses = f => {
  if (!f) return null;
  const h = new Date(), x = new Date(f + 'T12:00');
  return Math.max(0, (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth());
};

// ---- Dimensiones calculadas ---------------------------------
// Enganche típico si el desarrollo no lo define (para estimar el monto a financiar).
const ENGANCHE_DEFAULT = 0.20;
// Plazo estándar de referencia.
const PLAZO_ANIOS = 20;
// El pago hipotecario no debería pasar del 30% del ingreso (regla de la banca).
const DTI = 0.30;

// Techos APROXIMADOS de monto financiable por producto (MXN). Referencia, editable.
export const TECHO_CREDITO = { Infonavit: 2300000, FOVISSSTE: 2500000, Bancario: Infinity };

// Monto a financiar de una unidad (precio menos enganche estimado del desarrollo).
export function montoFinanciar(precio, dev) {
  const eng = (dev && (dev.esq_enganche || dev.enganche_pct)) || ENGANCHE_DEFAULT;
  return Math.max(0, Math.round((Number(precio) || 0) * (1 - eng)));
}

// Mensualidad hipotecaria estimada (crédito bancario por defecto).
export function mensualidadHipoteca(precio, dev, tipo = 'Bancario') {
  const monto = montoFinanciar(precio, dev);
  const tasa = TASAS_DEFAULT[tipo] ?? TASAS_DEFAULT.Bancario;
  return mensualidadCredito(monto, tasa, PLAZO_ANIOS);
}

// Ingreso mensual mínimo para calificar (pago / DTI).
export function ingresoMinimo(precio, dev, tipo = 'Bancario') {
  const pago = mensualidadHipoteca(precio, dev, tipo);
  return Math.round(pago / DTI);
}

// ¿La unidad "cabe" en el producto de crédito? (monto a financiar bajo el techo).
export function cabeEnCredito(precio, dev, tipo) {
  return montoFinanciar(precio, dev) <= (TECHO_CREDITO[tipo] ?? Infinity);
}

// Precio por m² habitable.
export function precioM2(u) {
  const m = Number(u.m2_hab) || 0;
  return m > 0 ? Math.round((Number(u.precio) || 0) / m) : null;
}

// ---- Buckets de tiempo a entrega ----------------------------
export const ENTREGA_BUCKETS = [
  ['inmediata', 'Inmediata', (m, dev) => dev.etapa === 'Entrega inmediata' || m === 0],
  ['6', '≤ 6 meses', m => m != null && m <= 6],
  ['12', '≤ 12 meses', m => m != null && m <= 12],
  ['24', '≤ 24 meses', m => m != null && m <= 24],
  ['36', '≤ 36 meses', m => m != null && m <= 36],
];
export function pasaEntrega(bucket, dev) {
  if (!bucket) return true;
  const def = ENTREGA_BUCKETS.find(b => b[0] === bucket);
  if (!def) return true;
  return def[2](meses(dev.fecha_entrega), dev);
}

// ---- Créditos: normalización dev -> set de claves ------------
export const CREDITOS = [
  ['infonavit', 'Infonavit'], ['fovissste', 'FOVISSSTE'], ['bancario', 'Bancario'],
  ['ion', 'ION'], ['hir', 'HIR'], ['yave', 'Yave'],
];
export function creditosDe(dev) {
  const s = new Set();
  const yes = v => v != null && /s[íi]|1|x|acept|true/i.test(String(v));
  if (yes(dev.credito_ion)) s.add('ion');
  if (yes(dev.credito_hir)) s.add('hir');
  if (yes(dev.credito_yave)) s.add('yave');
  if (yes(dev.credito_bancario)) { s.add('bancario'); }
  // Infonavit/FOVISSSTE: si el techo alcanza, se consideran viables (se refina con la ficha).
  const f = dev.ficha || {};
  const fichaYes = k => yes(f[k]);
  if (fichaYes('Crédito Tradicional Infonavit') || fichaYes('Infonavit Total') || fichaYes('Cofinavit')) s.add('infonavit');
  if (fichaYes('Crédito Tradicional FOVISSSTE') || fichaYes('FOVISSSTE para Todos')) s.add('fovissste');
  return s;
}

// ---- Amenidades: lista canónica para facetas ----------------
export function amenidadesDe(dev) {
  return (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
}
export const AMENIDADES_CLAVE = [
  ['alberca', 'Alberca', /alberca|piscina/i], ['gym', 'Gimnasio', /gim|gym|fitness/i],
  ['roof', 'Roof garden', /roof|sky/i], ['cowork', 'Coworking', /cowork|business/i],
  ['seguridad', 'Seguridad 24h', /segur|vigil|cctv/i], ['pet', 'Pet friendly', /mascota|pet/i],
  ['salon', 'Salón de usos', /sal[óo]n|usos|eventos/i], ['asador', 'Asadores', /asador|bbq|parrilla/i],
];

// ---- Fit-score: rankear TODAS las unidades vs un cliente ----
// criterios: { presupuestoMin, presupuestoMax, recs:Set|array, banosMin, zonas:array,
//   entregaBucket, creditos:array, cajonesMin, bodega:bool, amenidades:array }
// Cada criterio presente aporta a un promedio ponderado 0..1; near-miss vale 0.5.
const W = { presupuesto: 3, recs: 2, zona: 2, entrega: 1.5, credito: 1.5, cajones: 1, bodega: 1, amenidades: 1 };

export function fitScore(u, dev, c) {
  let sum = 0, tot = 0;
  const reasons = [];
  const add = (w, m, label) => { sum += w * m; tot += w; reasons.push({ label, m }); };

  if (c.presupuestoMax) {
    const p = u.precio || 0;
    const m = p <= c.presupuestoMax ? 1 : (p <= c.presupuestoMax * 1.1 ? 0.5 : 0);
    add(W.presupuesto, m, m === 1 ? 'Dentro de presupuesto' : (m ? 'Un poco arriba del presupuesto' : 'Arriba del presupuesto'));
  }
  if (c.presupuestoMin && (u.precio || 0) < c.presupuestoMin) { /* barato: no penaliza */ }

  const recs = c.recs && (c.recs.size ? [...c.recs] : (c.recs.length ? c.recs : null));
  if (recs && recs.length) {
    const hit = recs.some(r => r === '3' ? u.rec >= 3 : u.rec === +r);
    add(W.recs, hit ? 1 : 0, hit ? 'Recámaras que pidió' : 'Otras recámaras');
  }
  if (c.zonas && c.zonas.length) {
    const hit = c.zonas.includes(dev.alcaldia);
    add(W.zona, hit ? 1 : 0, hit ? 'En la zona que quiere' : 'Fuera de su zona');
  }
  if (c.entregaBucket) {
    const hit = pasaEntrega(c.entregaBucket, dev);
    add(W.entrega, hit ? 1 : 0, hit ? 'Entrega a tiempo' : 'Entrega más lejana');
  }
  if (c.creditos && c.creditos.length) {
    const cd = creditosDe(dev);
    const hit = c.creditos.some(k => cd.has(k) || cabeEnCredito(u.precio, dev, k === 'infonavit' ? 'Infonavit' : k === 'fovissste' ? 'FOVISSSTE' : 'Bancario'));
    add(W.credito, hit ? 1 : 0, hit ? 'Acepta su crédito' : 'Su crédito no aplica');
  }
  if (c.cajonesMin) {
    const hit = (u.n_estac || 0) >= c.cajonesMin;
    add(W.cajones, hit ? 1 : 0, hit ? `${c.cajonesMin}+ cajón` : 'Menos cajones');
  }
  if (c.bodega) {
    const hit = (u.bodega_m2 || 0) > 0 || !!u.sku_bodega;
    add(W.bodega, hit ? 1 : 0.4, hit ? 'Con bodega' : 'Sin bodega');
  }
  if (c.amenidades && c.amenidades.length) {
    const am = amenidadesDe(dev).join(' ').toLowerCase();
    const got = c.amenidades.filter(a => am.includes(a.toLowerCase())).length;
    add(W.amenidades, got / c.amenidades.length, `${got}/${c.amenidades.length} amenidades`);
  }

  const score = tot > 0 ? Math.round((sum / tot) * 100) : 0;
  return { score, reasons };
}

// ---- Vistas inteligentes prearmadas -------------------------
// patch: valores de faceta a aplicar. sort: criterio de orden.
export const VISTAS = [
  { id: 'inmediata', icon: '⚡', label: 'Entrega inmediata', patch: { entrega: 'inmediata' }, sort: 'precio' },
  { id: 'preventa6', icon: '🏗️', label: 'Preventa próxima (<6m)', patch: { entrega: '6' }, sort: 'entrega' },
  { id: 'preciom2', icon: '📐', label: 'Mejor precio/m²', patch: {}, sort: 'precio_m2' },
  { id: 'comision', icon: '💰', label: 'Mayor comisión', patch: { comisionMin: 4 }, sort: 'comision' },
  { id: 'muestra', icon: '🏠', label: 'Con depa muestra', patch: { depaMuestra: true }, sort: 'precio' },
  { id: 'oportu', icon: '🔻', label: 'Oportunidades / promo', patch: { descuento: true }, sort: 'precio' },
  { id: 'cajonesbod', icon: '🚗', label: '2 cajones + bodega', patch: { cajonesMin: '2', bodega: true }, sort: 'precio' },
  { id: 'infonavit', icon: '🏦', label: 'Para Infonavit', patch: { creditos: ['infonavit'] }, sort: 'precio' },
  { id: 'lujo', icon: '✨', label: 'Premium (3+ rec)', patch: { recs: ['3'] }, sort: 'precio' },
];

// ---- Personas (pitch sugerido) ------------------------------
export const PERSONAS = [
  { id: 'inversion', label: 'Inversionista', pitch: 'Plusvalía y renta: enfócate en precio/m², zona en desarrollo y entrega pronta.' },
  { id: 'primer', label: 'Primer hogar', pitch: 'Mensualidad accesible y crédito Infonavit/FOVISSSTE; resalta enganche bajo.' },
  { id: 'upgrade', label: 'Upgrade familiar', pitch: 'Más recámaras, cajones y bodega; amenidades para niños.' },
  { id: 'airbnb', label: 'Airbnb / rentas', pitch: 'Ubicación, permiso de renta corta y amenidades tipo hotel.' },
];
