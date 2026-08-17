import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { estadoIntegraciones } from '../../../../lib/integraciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reporta qué integraciones están configuradas (solo booleanos; nunca expone llaves).
// Requiere un token de un super-admin.
export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token);
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  const db = svc();
  const { data: prof } = await db.from('profiles').select('rol').eq('id', uid).maybeSingle();
  if (prof?.rol !== 'super_admin') return NextResponse.json({ error: 'solo super-admin' }, { status: 403 });
  return NextResponse.json({
    estado: estadoIntegraciones(),
    default_org_set: !!process.env.DEFAULT_ORG_ID,
  });
}
