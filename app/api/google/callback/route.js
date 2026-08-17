import { NextResponse } from 'next/server';
import { G, svc, googleConfigured } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !googleConfigured()) return NextResponse.redirect(origin + '/marca?google=error');

  const db = svc();
  const { data: row } = await db.from('google_tokens').select('user_id').eq('state', state).maybeSingle();
  if (!row) return NextResponse.redirect(origin + '/marca?google=error');

  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: G.clientId, client_secret: G.clientSecret, redirect_uri: G.redirect, grant_type: 'authorization_code' }),
  });
  const tok = await tr.json();
  if (!tok.access_token) return NextResponse.redirect(origin + '/marca?google=error');

  let email = null;
  try {
    const ur = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    const u = await ur.json(); email = u.email || null;
  } catch { /* opcional */ }

  const upd = {
    access_token: tok.access_token,
    expiry: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
    email, state: null, connected_at: new Date().toISOString(),
  };
  if (tok.refresh_token) upd.refresh_token = tok.refresh_token;
  await db.from('google_tokens').update(upd).eq('user_id', row.user_id);
  await db.from('profiles').update({ google_email: email }).eq('id', row.user_id);

  return NextResponse.redirect(origin + '/marca?google=ok');
}
