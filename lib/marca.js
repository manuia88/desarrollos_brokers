'use client';
import { supabase } from './supabase';

function ext(f) { const m = (f.name || '').match(/\.([a-zA-Z0-9]+)$/); return m ? m[1].toLowerCase() : 'png'; }

export async function subirLogo({ file, org_id }) {
  if (!file || !org_id) return { error: { message: 'Faltan datos.' } };
  const path = `orgs/${org_id}/logo-${Date.now()}.${ext(file)}`;
  const up = await supabase.storage.from('marca').upload(path, file, { upsert: true });
  if (up.error) return { error: up.error };
  const { data } = supabase.storage.from('marca').getPublicUrl(path);
  const { error } = await supabase.from('orgs').update({ logo_url: data.publicUrl }).eq('id', org_id);
  if (error) return { error };
  return { url: data.publicUrl };
}

export async function subirFotoAsesor({ file, user_id }) {
  if (!file || !user_id) return { error: { message: 'Faltan datos.' } };
  const path = `asesores/${user_id}/foto-${Date.now()}.${ext(file)}`;
  const up = await supabase.storage.from('marca').upload(path, file, { upsert: true });
  if (up.error) return { error: up.error };
  const { data } = supabase.storage.from('marca').getPublicUrl(path);
  const { error } = await supabase.from('profiles').update({ foto_url: data.publicUrl }).eq('id', user_id);
  if (error) return { error };
  return { url: data.publicUrl };
}

export async function guardarTelefono(user_id, telefono) {
  const { error } = await supabase.from('profiles').update({ telefono }).eq('id', user_id);
  return { error };
}
