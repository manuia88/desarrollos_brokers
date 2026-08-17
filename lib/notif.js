import { supabase } from './supabase';

export async function listarAvisos() {
  const { data } = await supabase.from('notificaciones').select('*').order('creado', { ascending: false }).limit(60);
  return data || [];
}
export async function contarNoLeidos() {
  const { count } = await supabase.from('notificaciones').select('id', { count: 'exact', head: true }).eq('leido', false);
  return count || 0;
}
export async function marcarLeido(id) { return supabase.from('notificaciones').update({ leido: true }).eq('id', id); }
export async function marcarTodo() { return supabase.from('notificaciones').update({ leido: true }).eq('leido', false); }
// Crear un aviso para cualquier usuario (vía RPC SECURITY DEFINER).
export async function notificar(userId, tipo, titulo, cuerpo, link) {
  return supabase.rpc('notificar', { p_user: userId, p_tipo: tipo, p_titulo: titulo, p_cuerpo: cuerpo, p_link: link || null });
}
