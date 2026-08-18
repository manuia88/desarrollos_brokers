import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://toqgeimczebtndkatczn.supabase.co';

// Anon key (pública por diseño) para VALIDAR el JWT del usuario sin depender de la service key.
// Igual que el cliente del navegador, viene embebida para que la validación no falle si falta el env.
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ',
  'pc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWdlaW1',
  'jemVidG5ka2F0Y3puIiwicm9sZSI6ImFub24iLCJ',
  'pYXQiOjE3ODY4MTgyMjEsImV4cCI6MjEwMjM5NDI',
  'yMX0.EA9NVKBbJnWI_0_4HYFM-QaRoW4umduFysJ',
  'RPj0VnTA',
].join('');

export const G = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI,
};

export function googleConfigured() { return !!(G.clientId && G.clientSecret && G.redirect); }

// Cliente con service role (escribe saltándose RLS). REQUIERE la variable en Vercel.
export function svc() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (Settings → Environment Variables). Es necesaria para guardar la conexión de Google.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

// Verifica un JWT de Supabase y devuelve el user id. Usa la ANON key -> no depende de la service key.
export async function userFromToken(token) {
  if (!token) return null;
  try {
    const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { data } = await c.auth.getUser(token);
    return data?.user?.id || null;
  } catch { return null; }
}

// Devuelve un access_token fresco para un usuario conectado (o null).
export async function googleAccessToken(db, userId) {
  const { data: tk } = await db.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!tk?.refresh_token) return null;
  const rt = await refreshAccess(tk.refresh_token);
  return rt?.access_token || null;
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

// Super-admin con Google conectado = calendario maestro (recibe todas las citas).
export async function masterUserId(db) {
  const { data } = await db.from('profiles').select('id').eq('rol', 'super_admin');
  for (const p of (data || [])) {
    const { data: tk } = await db.from('google_tokens').select('user_id').eq('user_id', p.id).not('refresh_token', 'is', null).maybeSingle();
    if (tk) return p.id;
  }
  return null;
}

export async function createGoogleEvent(db, userId, eventBody) {
  const { data: tk } = await db.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!tk?.refresh_token) return null;
  const rt = await refreshAccess(tk.refresh_token);
  if (!rt.access_token) return null;
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST', headers: { Authorization: 'Bearer ' + rt.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody),
  });
  const j = await r.json();
  return j.id || null;
}

export async function deleteGoogleEvent(db, userId, eventId) {
  if (!eventId || !userId) return;
  const { data: tk } = await db.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!tk?.refresh_token) return;
  const rt = await refreshAccess(tk.refresh_token);
  if (!rt.access_token) return;
  await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + eventId + '?sendUpdates=all', {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + rt.access_token },
  });
}
