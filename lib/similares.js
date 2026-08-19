// ============================================================
// "Si este no le cuadra, muéstrale…" — desarrollos parecidos/cercanos.
// Función PURA. Rankea otros desarrollos contra uno base por zona,
// precio, recámaras, entrega y amenidades. Sirve para el broker
// (alternativas para su cliente) sin exponer nada sensible.
// ============================================================

const overlap = (aMin, aMax, bMin, bMax) => {
  const lo = Math.max(aMin, bMin), hi = Math.min(aMax, bMax);
  return hi >= lo;
};
const amenSet = d => new Set(String(d.amenidades || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));

// Devuelve los N desarrollos más parecidos al `base` dentro de `devs`.
// Cada resultado: { dev, score 0..100, razones:[...] }.
export function similares(base, devs, n = 4) {
  if (!base || !Array.isArray(devs)) return [];
  const baseAmen = amenSet(base);
  const out = [];
  for (const d of devs) {
    if (!d || d.sku === base.sku) continue;
    if (d.publicado === false) continue;
    let s = 0; const razones = [];

    // Zona (lo más importante para "cercano")
    if (base.alcaldia && d.alcaldia === base.alcaldia) { s += 34; razones.push('Misma zona'); }
    else if (base.estado && d.estado === base.estado) { s += 10; razones.push('Mismo estado'); }

    // Precio: solapamiento de rango + cercanía del "desde"
    const bMin = base.precio_min || 0, bMax = base.precio_max || bMin || 0;
    const dMin = d.precio_min || 0, dMax = d.precio_max || dMin || 0;
    if (bMin && dMin && overlap(bMin, bMax || bMin, dMin, dMax || dMin)) { s += 20; razones.push('Rango de precio similar'); }
    else if (bMin && dMin) {
      const diff = Math.abs(dMin - bMin) / bMin;
      if (diff <= 0.15) { s += 16; razones.push('Precio parecido'); }
      else if (diff <= 0.30) { s += 8; }
    }

    // Recámaras: solapamiento de rango
    if (base.rec_min != null && d.rec_min != null && overlap(base.rec_min, base.rec_max ?? base.rec_min, d.rec_min, d.rec_max ?? d.rec_min)) {
      s += 16; razones.push('Mismas recámaras');
    }

    // Entrega: misma etapa
    if (base.etapa && d.etapa === base.etapa) { s += 8; razones.push(d.etapa === 'Entrega inmediata' ? 'También entrega inmediata' : 'Misma etapa'); }

    // Amenidades compartidas
    if (baseAmen.size) {
      const dAmen = amenSet(d);
      let comp = 0; baseAmen.forEach(a => { if (dAmen.has(a)) comp++; });
      if (comp >= 3) { s += 8; razones.push('Amenidades parecidas'); }
      else if (comp >= 1) s += 4;
    }

    if (s > 0) out.push({ dev: d, score: Math.min(100, s), razones: razones.slice(0, 3) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
