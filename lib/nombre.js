// Title case inteligente para nombres de personas y organizaciones.
// Objetivo: que "PulPPo", "INMOBILIARIA pulppo", "JosEEEE" se guarden bonitos y consistentes.
//  - baja todo y capitaliza cada palabra
//  - deja en minúscula los conectores (de, del, la, y, en...) salvo al inicio
//  - deja en MAYÚSCULA siglas legales (SA, CV, SC, RL, SAPI...)
//  - respeta números (5134, 50) y numerales romanos (II, III, IV)
//  - colapsa 3+ letras iguales seguidas a 2 (el español no tiene 3 iguales),
//    sin tocar dobles legítimas (la "pp" de Pulppo, la "ll", la "rr")

const MINUS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'con', 'o', 'u', 'al']);
const MAYUS = new Set(['sa', 'cv', 'sc', 'rl', 'sapi', 'sofom', 'sab', 'ac', 'spr']);
const ROMANO = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

// Capitaliza una palabra respetando guiones internos (p. ej. "coto-sur" -> "Coto-Sur").
function capPalabra(w) {
  return w.split('-').map((p) => {
    const limpio = p.replace(/\./g, '');
    if (MAYUS.has(limpio)) return p.toUpperCase();
    if (/^\d+$/.test(p)) return p;
    return cap(p);
  }).join('-');
}

export function tituloInteligente(raw) {
  if (!raw) return '';
  let s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  // 3+ letras idénticas seguidas -> 2 (protege "pp", "ll", "rr"; arregla "joseee" -> "josee")
  s = s.replace(/([a-záéíóúñü])\1{2,}/g, '$1$1');
  const palabras = s.split(' ');
  return palabras.map((w, i) => {
    const limpio = w.replace(/\./g, '');
    if (MAYUS.has(limpio)) return limpio.toUpperCase();               // SA, CV, SC...
    if (/^\d+$/.test(w)) return w;                                    // 350, 5134
    if (w && ROMANO.test(w) && /[ivxlcdm]/i.test(w)) return w.toUpperCase(); // II, III, IV
    if (i > 0 && MINUS.has(w)) return w;                              // conector (no al inicio)
    return capPalabra(w);
  }).join(' ');
}
