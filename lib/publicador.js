// Motor de selección para publicar inventario en portales. Puro y compartido
// entre la UI (vista previa) y el endpoint (publicación real).
//
// base:  filtros globales { devs[], prototipos[], zona, precioMin, precioMax }
// reglas: lista de recetas. Cada regla:
//   { ambito: 'dev' | 'prototipo' | 'global', rec: ''|'0'|'1'|'2'|'3', puntos: ['min','mid','max'|'todas'] }
// La UNIÓN de las reglas (sin duplicar unidades) es lo que se publica.

const recMatch = (u, rec) => rec === '' || rec == null ? true : (rec === '3' ? u.rec >= 3 : u.rec === +rec);

function pickPuntos(us, puntos) {
  const s = us.slice().sort((a, b) => (a.precio || 0) - (b.precio || 0));
  if (!puntos || !puntos.length || puntos.includes('todas')) return s;
  const out = new Set();
  if (puntos.includes('min')) out.add(s[0]);
  if (puntos.includes('max')) out.add(s[s.length - 1]);
  if (puntos.includes('mid')) out.add(s[Math.floor((s.length - 1) / 2)]);
  return [...out].filter(Boolean);
}

export function baseFilter(units, byId, base = {}) {
  return units.filter(u => {
    const d = byId[u.dev_sku]; if (!d) return false;
    if (base.devs?.length && !base.devs.includes(u.dev_sku)) return false;
    if (base.prototipos?.length && !base.prototipos.includes(u.prototipo)) return false;
    if (base.zona && d.alcaldia !== base.zona) return false;
    if (base.precioMin && u.precio < +base.precioMin) return false;
    if (base.precioMax && u.precio > +base.precioMax) return false;
    if (base.etapa && d.etapa !== base.etapa) return false;
    if (base.descuento && !(d.descuentos && String(d.descuentos).trim())) return false;
    return true;
  });
}

// Prioriza qué unidades ocupan los slots limitados según el objetivo.
export function ordenar(units, byId, orden) {
  const dias = u => u.creado ? Math.floor((Date.now() - new Date(u.creado).getTime()) / 86400000) : 0;
  const arr = units.slice();
  if (orden === 'comision') arr.sort((a, b) => ((byId[b.dev_sku]?.comision_broker || 0) - (byId[a.dev_sku]?.comision_broker || 0)) || (a.precio - b.precio));
  else if (orden === 'dias') arr.sort((a, b) => dias(b) - dias(a));
  else arr.sort((a, b) => (a.precio || 0) - (b.precio || 0));
  return arr;
}

function groupKey(u, ambito) {
  if (ambito === 'dev') return u.dev_sku;
  if (ambito === 'prototipo') return u.dev_sku + '§' + (u.prototipo || '-');
  return 'ALL';
}

// Devuelve las unidades elegidas (sin duplicados), cada una con su etiqueta de regla.
export function resolverReglas(units, byId, base, reglas) {
  const pool = baseFilter(units, byId, base);
  const chosen = new Map();
  const rs = (reglas && reglas.length) ? reglas : [{ ambito: 'global', rec: '', puntos: ['todas'] }];
  rs.forEach(r => {
    const sub = pool.filter(u => recMatch(u, r.rec));
    const groups = {};
    sub.forEach(u => { const k = groupKey(u, r.ambito || 'global'); (groups[k] = groups[k] || []).push(u); });
    Object.values(groups).forEach(us => pickPuntos(us, r.puntos).forEach(u => { if (u && !chosen.has(u.sku)) chosen.set(u.sku, u); }));
  });
  return [...chosen.values()];
}

// Etiqueta legible de una regla, para la UI.
export function etiquetaRegla(r) {
  const amb = { dev: 'por desarrollo', prototipo: 'por prototipo', global: 'global' }[r.ambito || 'global'];
  const rec = r.rec === '' || r.rec == null ? 'todas las rec' : (r.rec === '0' ? 'loft' : r.rec === '3' ? '3+ rec' : r.rec + ' rec');
  const pts = (!r.puntos || r.puntos.includes('todas')) ? 'todas las unidades'
    : r.puntos.map(p => ({ min: 'mínimo', mid: 'medio', max: 'máximo' }[p])).filter(Boolean).join(' y ');
  return `${rec} · ${pts} · ${amb}`;
}
