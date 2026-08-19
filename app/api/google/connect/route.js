import { NextResponse } from 'next/server';
import { G, svc, googleConfigured, userFromToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paso 1 (POST, con el token de sesión en el HEADER, no en la URL): genera un nonce de un
// solo uso ligado al usuario y lo guarda. Así el JWT nunca viaja en la query string.
export async function POST(req) {
  if (!googleConfigured()) return NextResponse.json({ error: 'Google Calendar no está configurado.' }, { status: 500 });
  const uid = await userFromToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: 'config' }, { status: 500 }); }
  const n = crypto.randomUUID();
  await db.from('google_tokens').upsert({ user_id: uid, state: 'start:' + n });
  return NextResponse.json({ n });
}

// Paso 2 (GET con ?n=nonce): resuelve el usuario del nonce server-side y arranca OAuth.
export async function GET(req) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google Calendar no está configurado (faltan variables de entorno en Vercel).' }, { status: 500 });
  }
  const n = new URL(req.url).searchParams.get('n');
  if (!n) return NextResponse.json({ error: 'enlace inválido' }, { status: 400 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 500 }); }

  const { data: row } = await db.from('google_tokens').select('user_id').eq('state', 'start:' + n).maybeSingle();
  const uid = row?.user_id;
  if (!uid) return NextResponse.json({ error: 'Enlace vencido. Vuelve a iniciar la conexión con Google desde la app.' }, { status: 401 });

  const nonce = crypto.randomUUID();
  await db.from('google_tokens').upsert({ user_id: uid, state: nonce });

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', G.clientId);
  auth.searchParams.set('redirect_uri', G.redirect);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email');
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  auth.searchParams.set('state', nonce);
  return NextResponse.redirect(auth.toString());
}
