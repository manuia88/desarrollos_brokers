import { NextResponse } from 'next/server';
import { G, svc, googleConfigured, userFromToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google Calendar no está configurado (faltan variables de entorno en Vercel).' }, { status: 500 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const uid = await userFromToken(token);
  if (!uid) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const nonce = crypto.randomUUID();
  await svc().from('google_tokens').upsert({ user_id: uid, state: nonce });

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', G.clientId);
  auth.searchParams.set('redirect_uri', G.redirect);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email');
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  auth.searchParams.set('state', nonce);
  return NextResponse.redirect(auth.toString());
}
