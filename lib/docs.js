'use client';
import { supabase } from './supabase';

// Sube un archivo al bucket privado 'documentos' y registra su metadata.
// ambito: 'cliente' (bajo clientes/{org}/{lead}/) o 'broker' (bajo brokers/{org}/).
export async function subirDocumento({ file, ambito, org_id, lead_id = null, tipo }) {
  if (!file || !org_id) return { error: { message: 'Faltan datos para subir el archivo.' } };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now();
  const base = ambito === 'cliente' ? `clientes/${org_id}/${lead_id}` : `brokers/${org_id}`;
  const path = `${base}/${tipo}-${stamp}-${safe}`;
  const up = await supabase.storage.from('documentos').upload(path, file, { upsert: false });
  if (up.error) return { error: up.error };
  const { data: u } = await supabase.auth.getUser();
  const ins = await supabase.from('documentos').insert({
    org_id, ambito, lead_id, tipo, nombre_archivo: file.name, path, subido_por: u?.user?.id || null,
  });
  if (ins.error) return { error: ins.error };
  return { path };
}

export async function listarDocumentos({ ambito, lead_id = null, org_id = null }) {
  let q = supabase.from('documentos').select('*').eq('ambito', ambito).order('creado', { ascending: false });
  if (lead_id != null) q = q.eq('lead_id', lead_id);
  if (org_id != null) q = q.eq('org_id', org_id);
  const { data } = await q;
  return data || [];
}

export async function urlFirmada(path) {
  const { data } = await supabase.storage.from('documentos').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

export async function abrirDocumento(path) {
  const url = await urlFirmada(path);
  if (url) window.open(url, '_blank', 'noopener');
}
