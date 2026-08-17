import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://toqgeimczebtndkatczn.supabase.co';

export const G = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI,
};

export function googleConfigured() { return !!(G.clientId && G.clientSecret && G.redirect); }

export function svc() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

// Verifica un JWT de Supabase y devuelve el user id.
export async function userFromToken(token) {
  if (!token) return null;
  try {
    const c = svc();
    const { data } = await c.auth.getUser(token);
    return data?.user?.id || null;
  } catch { return null; }
}

export async function refreshAccess(refresh_token) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: G.clientId, client_secret: G.clientSecret, refresh_token, grant_type: 'refresh_token' }),
  });
  return r.json();
}

// 'YYYY-MM-DD' + 'HH:MM' -> 'YYYY-MM-DDTHH:MM:00' (para dateTime con timeZone)
export function citaDateTime(fecha, hora, addH = 0) {
  let [h, mi] = (hora || '09:00').split(':');
  h = parseInt(h || '9', 10) + addH;
  if (h > 23) h = 23;
  return `${fecha}T${String(h).padStart(2, '0')}:${(mi || '00').padStart(2, '0')}:00`;
}
