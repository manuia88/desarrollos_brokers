// Mapea las columnas del Excel del desarrollador (estructura v6, 122 columnas)
// a las llaves de la ficha que lee el portal, y da formato a los valores.
// Extracción determinista para el Excel estructurado (más confiable que IA).

// Encabezado del Excel -> llave que usa la ficha del portal (solo los que difieren).
const RENAME = {
  'No. de niveles del edificio': 'Niveles del edificio',
  'Suministro (municipal/pozo/pipa)': 'Agua (suministro)',
  'Agua caliente (boiler ind./central)': 'Agua caliente',
  'Tipo (Natural / Estacionario)': 'Gas (tipo)',
  'Suministro (CFE)': 'Luz (CFE)',
  'Tipo de suelo / cimentación': 'Suelo / cimentación',
  'Comisión al broker (%)': 'Comisión al broker',
  'Contacto del desarrollador (tel/WhatsApp)': 'Contacto del desarrollador',
  'Descuentos disponibles (sí/no)': 'Descuentos disponibles',
  'Seguridad 24h (sí/no)': 'Seguridad 24h',
  'Acceso controlado (sí/no)': 'Acceso controlado',
  'Elevadores (número)': 'Elevadores',
  'Permite Airbnb (sí/no)': 'Permite Airbnb',
  'Permite mascotas (sí/no)': 'Permite mascotas',
  'Escrituras listas (sí/no)': 'Escrituras listas',
  'Estacionamiento a la venta (sí/no)': 'Estacionamiento a la venta',
  'Bodega a la venta (sí/no)': 'Bodega a la venta',
  'Altura piso a techo (libre)': 'Altura piso a techo',
  'Meses para entrega (auto)': 'Meses para entrega',
  'Mensualidad estimada (auto)': 'Mensualidad estimada',
  'M2 habitables (–)': 'M² habitables (mín)',
  'M2 habitables (+)': 'M² habitables (máx)',
  'M2 terreno': 'M² terreno',
  'Recámaras (–)': 'Recámaras (mín)',
  'Recámaras (+)': 'Recámaras (máx)',
  'Baños (–)': 'Baños (mín)',
  'Baños (+)': 'Baños (máx)',
  'Estacionamientos (–)': 'Estacionamientos (mín)',
  'Estacionamientos (+)': 'Estacionamientos (máx)',
  'Precio (–)': 'Precio (mín)',
  'Precio (+)': 'Precio (máx)',
};

// Columnas que NO se importan (ligas/auto/identificadores; las ligas ya no se usan).
const SKIP = new Set([
  '#', 'Código / SKU', 'Desarrollo',
  'Inventario (liga a lista de precios)', 'Disponibilidad en línea (liga)', 'Mapa (auto)',
  'Acabados a la entrega (liga)', 'Memoria de acabados (liga)',
  'Liga Drive', 'Liga EasyBroker', 'Liga brochure', 'Liga recorrido 360 / video',
]);

// Tipo de formato por encabezado del Excel.
const MONEY = new Set(['Precio a partir de', 'Precio (–)', 'Precio (+)', 'Apartado', 'Precio por m²',
  'Mantenimiento mensual', 'Mantenimiento anticipado', 'Cuota de equipamiento', 'Predial estimado',
  'Gastos de escrituración estimados', 'Precio por cajón', 'Precio de bodega']);
const PCT = new Set(['% vendido', '% avance de obra']);            // fracción 0-1 -> "X%"
const PCTF = new Set(['Comisión al broker (%)', 'Enganche', 'Mensualidades', 'Escrituración']); // 0.03 -> "3%"
const DATE = new Set(['Fecha de entrega', 'Fecha de inicio de ventas', 'Fecha de actualización del dato']);

const mx = n => '$' + Math.round(n).toLocaleString('es-MX');
function fmtFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Serial de Excel (sistema 1900): días desde 1899-12-30. 25569 = 1970-01-01.
  const n = Number(v);
  if (!isNaN(n) && n > 20000 && n < 80000) {
    const d = new Date(Math.round((n - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}
function fmtValor(header, raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
  if (MONEY.has(header) && !isNaN(n) && /[0-9]/.test(s)) return mx(n);
  if (PCT.has(header) && !isNaN(n)) return (n <= 1 ? Math.round(n * 100) : Math.round(n)) + '%';
  if (PCTF.has(header) && !isNaN(n)) return (n <= 1 ? Math.round(n * 100) : Math.round(n)) + '%';
  if (DATE.has(header)) return fmtFecha(raw);
  return s;
}

// Encuentra la fila de encabezados (la que trae 'Código / SKU').
export function encontrarEncabezado(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = (rows[i] || []).map(x => (x == null ? '' : String(x).trim()));
    if (r.includes('Código / SKU')) return i;
  }
  return -1;
}

// Construye los items a importar: [{ sku, nombre, ficha:{...}, campos }]
export function construirImport(rows) {
  const hi = encontrarEncabezado(rows);
  if (hi < 0) return { error: 'No encontré la columna "Código / SKU". Usa la hoja con la estructura de columnas (Concentrado).', items: [] };
  const hdr = (rows[hi] || []).map(x => (x == null ? '' : String(x).trim()));
  const iSku = hdr.indexOf('Código / SKU');
  const iNom = hdr.indexOf('Desarrollo');
  const items = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const sku = row[iSku] == null ? '' : String(row[iSku]).trim();
    if (!sku || sku.toLowerCase() === 'código / sku') continue;
    const ficha = {};
    hdr.forEach((h, c) => {
      if (!h || SKIP.has(h)) return;
      const key = RENAME[h] || h;
      const val = fmtValor(h, row[c]);
      if (val != null) ficha[key] = val;
    });
    if (Object.keys(ficha).length === 0) continue;
    items.push({ sku, nombre: (iNom >= 0 && row[iNom]) ? String(row[iNom]).trim() : sku, ficha, campos: Object.keys(ficha).length });
  }
  return { items };
}

// Diff contra la ficha actual: cuántos campos nuevos vs. cambian vs. iguales.
export function diffContra(item, fichaActual) {
  const cur = fichaActual || {};
  let nuevos = 0, cambian = 0, iguales = 0;
  const detalle = [];
  Object.entries(item.ficha).forEach(([k, v]) => {
    const a = cur[k];
    if (a == null || a === '') { nuevos++; detalle.push({ k, de: null, a: v, tipo: 'nuevo' }); }
    else if (String(a) !== String(v)) { cambian++; detalle.push({ k, de: a, a: v, tipo: 'cambia' }); }
    else iguales++;
  });
  return { nuevos, cambian, iguales, detalle };
}
