import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { token } = await req.json().catch(() => ({}));
  const uid = await userFromToken(token);
  if (!uid) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const db = svc();
  await db.from('google_tokens').delete().eq('user_id', uid);
  await db.from('profiles').update({ google_email: null }).eq('id', uid);
  return NextResponse.json({ ok: true });
}
