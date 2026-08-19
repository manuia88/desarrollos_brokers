// ============================================================
// Score de lead — función PURA (sin estado, sin DOM).
// Pondera qué tan "trabajable" está un lead HOY para priorizar el seguimiento.
// No necesita datos de cierre: mide calidad + engagement + calce con inventario.
// Se puede recalibrar con tasas de cierre reales más adelante.
// ============================================================

const DAY = 86400000;

// Días desde la última actividad del lead (actualizado o, si no, creado).
export function diasSin(lead, ahora = Date.now()) {
  const t = lead?.actualizado || lead?.creado;
  if (!t) return null;
  const ms = ahora - new Date(t).getTime();
  return ms < 0 ? 0 : Math.floor(ms / DAY);
}

const num = v => { if (v == null || v === '') return null; const n = +String(v).replace(/[^0-9.]/g, ''); return isNaN(n) ? null : n; };

// Etapas del pipeline y el "peso" que aporta llegar a cada una.
const ETAPA_PESO = {
  nuevo: 0, contactado: 6, calificado: 10, 'en seguimiento': 10,
  cita: 16, visita: 16, apartado: 22, oferta: 22, escritura: 24, cerrado: 24,
};
function pesoEtapa(lead) {
  const e = String(lead?.etapa || lead?.estatus || '').toLowerCase().trim();
  if (!e) return 0;
  for (const [k, w] of Object.entries(ETAPA_PESO)) if (e.includes(k)) return w;
  return 0;
}

// ¿Hay al menos una unidad de inventario que le calce al lead?
// devById: mapa sku->desarrollo (con alcaldia). units: unidades disponibles.
function calzaInventario(lead, devById, units) {
  if (!units || !units.length) return false;
  const rec = lead.rec_interes != null ? +lead.rec_interes : null;
  const zona = (lead.zona_interes || '').toLowerCase().trim();
  const presMax = num(lead.presupuesto_max) || num(lead.presupuesto) || null;
  return units.some(u => {
    const d = devById?.[u.dev_sku];
    if (zona && d && !String(d.alcaldia || '').toLowerCase().includes(zona)) return false;
    if (rec != null && !(rec >= 3 ? u.rec >= 3 : u.rec === rec)) return false;
    if (presMax && (u.precio || 0) > presMax * 1.05) return false;
    return true;
  });
}

// Forma de pago: entre más resuelta/líquida, más caliente.
function pesoFormaPago(fp) {
  const s = String(fp || '').toLowerCase();
  if (/contado|recursos propios|inversion/.test(s)) return 12;
  if (/preaprob|autoriz|carta/.test(s)) return 12;
  if (/infonavit|fovissste|bancario|cr[eé]dito|mixto/.test(s)) return 8;
  return 0; // "por definir" / vacío
}

// Score 0..100 + temperatura + factores explicables.
export function scoreLead(lead, ctx = {}) {
  const { devById = {}, units = [], ahora = Date.now() } = ctx;
  const factores = [];
  let s = 0;
  const add = (pts, label) => { if (pts) { s += pts; factores.push({ pts, label }); } };

  // 1) Recencia de actividad (máx 25)
  const dias = diasSin(lead, ahora);
  if (dias != null) {
    if (dias <= 1) add(25, 'Actividad hoy/ayer');
    else if (dias <= 3) add(18, `Activo hace ${dias} días`);
    else if (dias <= 7) add(12, 'Activo esta semana');
    else if (dias <= 14) add(6, 'Activo hace <2 semanas');
    else if (dias <= 30) add(2, 'Activo este mes');
    else add(-6, `Sin contacto ${dias} días`);
  }

  // 2) Urgencia declarada (máx 15)
  const urg = String(lead.urgencia || '').toLowerCase();
  if (/inmediat|ya|urgente|alta|1[-\s]?3|este mes/.test(urg)) add(15, 'Urgencia alta');
  else if (/media|3[-\s]?6|pr[oó]xim/.test(urg)) add(8, 'Urgencia media');

  // 3) Presupuesto definido (máx 10)
  if (num(lead.presupuesto_max) || num(lead.presupuesto)) add(10, 'Presupuesto definido');

  // 4) Forma de pago (máx 12)
  add(pesoFormaPago(lead.forma_pago), lead.forma_pago && !/por definir/i.test(lead.forma_pago) ? `Pago: ${lead.forma_pago}` : null);

  // 5) Completitud de perfil (máx 12)
  let perfil = 0;
  if (lead.rec_interes != null) perfil += 4;
  if (lead.zona_interes) perfil += 4;
  if (lead.banos_interes != null || lead.estac_interes != null) perfil += 2;
  if (lead.email) perfil += 2;
  add(perfil, perfil >= 8 ? 'Perfil completo' : perfil ? 'Perfil parcial' : null);

  // 6) Avance en el pipeline (máx 24)
  add(pesoEtapa(lead), (lead.etapa || lead.estatus) ? `Etapa: ${lead.etapa || lead.estatus}` : null);

  // 7) Calce con inventario en vivo (máx 12)
  if (calzaInventario(lead, devById, units)) add(12, 'Hay inventario que le calza');

  const score = Math.max(0, Math.min(100, Math.round(s)));
  const temp = score >= 66 ? 'caliente' : score >= 40 ? 'tibio' : 'frio';
  factores.sort((a, b) => b.pts - a.pts);
  return { score, temp, dias, factores };
}

// Acción sugerida según score + días sin contacto (para el agente de seguimiento).
export function accionSugerida(lead, sc) {
  const d = sc.dias;
  const e = String(lead.etapa || lead.estatus || '').toLowerCase();
  if (/cita|visita/.test(e)) return 'Confirma la cita y manda un recordatorio.';
  if (/apartado|oferta|escritura/.test(e)) return 'Empuja el cierre: documentos y siguiente paso.';
  if (sc.temp === 'caliente') return 'Llámalo hoy: está caliente y con calce de inventario.';
  if (d != null && d >= 14) return 'Reactívalo con una novedad (precio, disponibilidad o promo).';
  if (d != null && d >= 5) return 'Dale seguimiento por WhatsApp con una opción concreta.';
  return 'Mantén el contacto: comparte una unidad que le quede.';
}
