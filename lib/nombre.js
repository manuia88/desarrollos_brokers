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

// Título del desarrollo para las tarjetas: la DIRECCIÓN (calle) como nombre,
// más marca comercial y/o Torre/Fase cuando aplica. Evita duplicar nombre + dirección.
// Mapa curado por los 27 desarrollos actuales; cualquiera nuevo cae al derivado.
const TITULOS = {
  'Agatha Del Valle Torre A': 'Agatha Del Valle · Cda Mayorazgo de Solís 17 · Torre A',
  'Agatha Del Valle Torre B': 'Agatha Del Valle · Cda Mayorazgo de Solís 17 · Torre B',
  'Agreda 229': 'Agreda 229',
  'Antonio Caso 61': 'Antonio Caso 61',
  'Av México Coyoacán 350': 'Av. México Coyoacán 350',
  'Camarones Torre C': 'Calzada Camarones 134 · Torre C',
  'Camarones Torre D': 'Calzada Camarones 134 · Torre D',
  'Comunal 50': 'Comunal 50',
  'Industria 3': 'Av. Industria 42 · Fase 3',
  'Insurgentes Centro 18': 'Av. Insurgentes Centro 18',
  'Insurgentes Centro 27': 'Av. Insurgentes Centro 27',
  'Insurgentes Norte 1471': 'Insurgentes Norte 1471',
  'La Viga 2': 'Calzada de la Viga 222',
  'Lomas Verdes': 'Lomas Verdes · Valle de Jilotepec 73',
  'Lomas Verdes D': 'Lomas Verdes · Valle de Jilotepec 73 · Torre D',
  'Lomas Verdes Torres E y F': 'Lomas Verdes · Valle de Jilotepec 73 · Torres E y F',
  'Monolith Torre A': 'Monolith · Desierto de los Leones 5547 · Torre A',
  'Monolith Torre C': 'Monolith · Desierto de los Leones 5547 · Torre C',
  'Periferico Sur 5134 Torre A': 'Periférico Sur 5134 · Torre A',
  'Puente Alvarado 37': 'Puente de Alvarado 37',
  'Río Churubusco': 'Av. Río Churubusco 213',
  'Río Churubusco II': 'Av. Río Churubusco 213 · Fase II',
  'Río Consulado': 'Río Consulado 1483',
  'Rio de la Loza 250': 'Dr. Río de la Loza 250',
  'SARA': 'SARA · Sara 4563',
  'Tlalnepantla': 'Emiliano Zapata 212',
  'Tlalnepantla 4': 'Emiliano Zapata 212 · Fase 4',
};

function derivarTitulo(d) {
  const base = String(d.direccion || '').replace(/^Circuito Interior\s+/i, '').replace(/^Avenida\s+/i, 'Av. ').trim() || d.nombre || '';
  const m = String(d.nombre || '').match(/(Torres?\s+[A-Z](?:\s+y\s+[A-Z])?|Fase\s+[\wII]+)/i);
  return m ? `${base} · ${m[0]}` : base;
}

// Título a mostrar para un desarrollo (usa el mapa curado; deriva si no está).
export function tituloDev(d) {
  if (!d) return '';
  return TITULOS[d.nombre] || derivarTitulo(d) || d.nombre || '';
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
