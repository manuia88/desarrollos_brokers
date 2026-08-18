'use client';
import { supabase } from './supabase';

// Medios del inventario (bucket público 'medios'): fotos, renders, planos, portada.
// Escritura solo super (RLS). Lectura pública por URL.

export const TIPOS_MEDIO = [
  ['portada', 'Portada'],
  ['render', 'Render'],
  ['foto', 'Foto'],
  ['amenidad', 'Amenidad'],
  ['plano', 'Plano'],
  ['planta', 'Planta ambientada'],
];

// Ambientes para segmentar fotos/renders (control interno).
export const AREAS = [
  'Fachada', 'Lobby / acceso', 'Sala / comedor', 'Cocina', 'Recámara principal',
  'Recámara 2', 'Recámara 3', 'Baño', 'Estudio', 'Balcón / terraza', 'Roof garden',
  'Amenidades', 'Alberca', 'Gym', 'Estacionamiento', 'Áreas verdes', 'Otro',
];

// Tipos que llevan área (ambiente). Planos/planta llevan prototipo en su lugar.
export const TIPOS_CON_AREA = ['render', 'foto', 'amenidad', 'portada'];
export const TIPOS_CON_PROTO = ['plano', 'planta'];

export const TIPO_LABEL = { portada: 'Portada', render: 'Render', foto: 'Foto', amenidad: 'Amenidad', plano: 'Plano', planta: 'Planta', brochure: 'Brochure', video: 'Video' };

const GENERICO = /^(captura de pantalla|screen ?shot|whats ?app image|img[-_ ]?\d|image$|imagen$|foto$|photo|dsc[-_ ]?\d|screen|sin t[ií]tulo|untitled|unnamed)/i;

// Etiqueta legible para un medio: ambiente real > prototipo > título propio > tipo.
// Ignora nombres genéricos (capturas de pantalla, IMG_1234, etc.) para no mostrar basura.
export function etiquetaMedio(m) {
  if (m?.area) return m.area;
  if (m?.prototipo) return m.prototipo;
  const t = (m?.titulo || '').trim();
  if (t && !GENERICO.test(t)) return t;
  return TIPO_LABEL[m?.tipo] || m?.tipo || 'Imagen';
}

// Etiqueta SOLO si es significativa (área/prototipo/título real). Si no, null -> sin chip.
export function etiquetaOpcional(m) {
  if (m?.area) return m.area;
  if (m?.prototipo) return m.prototipo;
  const t = (m?.titulo || '').trim();
  if (t && !GENERICO.test(t)) return t;
  return null;
}

// Comprime a WebP en el navegador antes de subir (los planos conservan más resolución).
export async function comprimir(file, maxW = 1600, quality = 0.82) {
  if (!file.type || !file.type.startsWith('image/')) return file;      // pdf, etc.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
}

function nuevoPath(dev_sku, tipo, file) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const rnd = Math.floor(Math.random() * 1e6);
  return `${dev_sku}/${tipo}-${Date.now()}-${rnd}-${safe}`;
}

// Sube un archivo (con compresión) y registra la metadata.
export async function subirMedio({ file, dev_sku, unidad_sku = null, prototipo = null, tipo, area = null, titulo = null, orden = 0 }) {
  if (!file || !dev_sku || !tipo) return { error: { message: 'Faltan datos para subir el medio.' } };
  const esPlano = TIPOS_CON_PROTO.includes(tipo);
  const comp = await comprimir(file, esPlano ? 2200 : 1600, esPlano ? 0.9 : 0.82);
  const path = nuevoPath(dev_sku, tipo, comp);
  const up = await supabase.storage.from('medios').upload(path, comp, { upsert: false });
  if (up.error) return { error: up.error };
  const { data: pub } = supabase.storage.from('medios').getPublicUrl(path);
  const ins = await supabase.from('media').insert({
    dev_sku, unidad_sku, prototipo, tipo, area, url: pub.publicUrl, titulo, orden,
  });
  if (ins.error) return { error: ins.error };
  return { url: pub.publicUrl };
}

// Convierte un link de Google Drive a una URL de imagen que sí carga en <img>.
// Detecta carpetas (esas van por el importador, no por URL suelta).
export function normalizarUrlImagen(raw) {
  const u = String(raw || '').trim();
  if (/\/folders\//.test(u)) return { carpeta: true, url: u };
  let m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && /drive\.google\.com|docs\.google\.com/.test(u)) return { url: `https://drive.google.com/uc?export=view&id=${m[1]}` };
  return { url: u };
}

// Agrega por URL externa (sin re-hospedar): útil para brochures/Drive.
export async function agregarPorUrl({ dev_sku, url, tipo, area = null, prototipo = null, titulo = null, orden = 0 }) {
  if (!dev_sku || !url || !tipo) return { error: { message: 'Faltan datos.' } };
  const norm = normalizarUrlImagen(url);
  if (norm.carpeta) return { error: { message: 'Eso es una CARPETA de Drive. Usa “Importar carpeta de Drive” abajo para traer todas las imágenes.' } };
  const ins = await supabase.from('media').insert({ dev_sku, url: norm.url, tipo, area, prototipo, titulo, orden });
  if (ins.error) return { error: ins.error };
  return { url: norm.url };
}

export async function listarMedios(dev_sku) {
  const { data } = await supabase.from('media').select('*').eq('dev_sku', dev_sku).order('orden').order('creado');
  return data || [];
}

export async function actualizarMedio(id, fields) {
  const { error } = await supabase.from('media').update(fields).eq('id', id);
  return { error };
}

// Marca un medio como portada (degrada las portadas previas a 'foto').
export async function hacerPortada(dev_sku, id) {
  await supabase.from('media').update({ tipo: 'foto' }).eq('dev_sku', dev_sku).eq('tipo', 'portada');
  const { error } = await supabase.from('media').update({ tipo: 'portada' }).eq('id', id);
  return { error };
}

export async function borrarMedio(medio) {
  const { error } = await supabase.from('media').delete().eq('id', medio.id);
  if (error) return { error };
  const parte = (medio.url || '').split('/medios/')[1];
  if (parte) await supabase.storage.from('medios').remove([decodeURIComponent(parte)]);
  return {};
}
