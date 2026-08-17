import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { fetchEasyBroker } from '../../../../lib/integraciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function permitido(req) {
  const secret = process.env.INTEGRACIONES_WEBHOOK_SECRET;
  if (secret && req.headers.get('x-webhook-secret') === secret) return true;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token);
  if (!uid) return false;
  const { data: prof } = await svc().from('profiles').select('rol').eq('id', uid).maybeSingle();
  return prof?.rol === 'super_admin';
}

// Importa listados de EasyBroker como desarrollos en borrador (publicado=false) para revisión.
export async function POST(req) {
  if (!(await permitido(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { propiedades, skipped, ok, status } = await fetchEasyBroker(1, 50);
  if (skipped) return NextResponse.json({ error: 'EasyBroker no configurado (falta EASYBROKER_API_KEY)' }, { status: 200 });
  if (ok === false) return NextResponse.json({ error: 'EasyBroker respondió ' + status }, { status: 200 });
  const db = svc();
  let upsert = 0;
  for (const p of propiedades) {
    const precio = (p.operations || []).map(o => o.amount).filter(Boolean).sort((a, b) => a - b)[0] || null;
    const row = {
      sku: 'EB-' + (p.public_id || p.id),
      nombre: p.title || 'Listado EasyBroker',
      colonia: p.location?.name || null,
      alcaldia: p.location?.name || null,
      precio_min: precio, precio_max: precio,
      publicado: false,
    };
    const { error } = await db.from('desarrollos').upsert(row, { onConflict: 'sku' });
    if (!error) upsert++;
  }
  return NextResponse.json({ ok: true, importados: upsert, total: propiedades.length });
}
