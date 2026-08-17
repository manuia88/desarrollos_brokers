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

export async function subirMedio({ file, dev_sku, unidad_sku = null, tipo, titulo = null, orden = 0 }) {
  if (!file || !dev_sku || !tipo) return { error: { message: 'Faltan datos para subir el medio.' } };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now();
  const path = `${dev_sku}/${tipo}-${stamp}-${safe}`;
  const up = await supabase.storage.from('medios').upload(path, file, { upsert: false });
  if (up.error) return { error: up.error };
  const { data: pub } = supabase.storage.from('medios').getPublicUrl(path);
  const ins = await supabase.from('media').insert({
    dev_sku, unidad_sku, tipo, url: pub.publicUrl, titulo, orden,
  });
  if (ins.error) return { error: ins.error };
  return { url: pub.publicUrl };
}

export async function listarMedios(dev_sku) {
  const { data } = await supabase.from('media').select('*').eq('dev_sku', dev_sku).order('orden').order('creado');
  return data || [];
}

export async function borrarMedio(medio) {
  const { error } = await supabase.from('media').delete().eq('id', medio.id);
  if (error) return { error };
  const parte = (medio.url || '').split('/medios/')[1];
  if (parte) await supabase.storage.from('medios').remove([decodeURIComponent(parte)]);
  return {};
}
