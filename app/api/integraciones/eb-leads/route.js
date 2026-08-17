import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { fetchEBContactRequests } from '../../../../lib/integraciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return true;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return false;
  const { data: prof } = await svc().from('profiles').select('rol').eq('id', uid).maybeSingle();
  return prof?.rol === 'super_admin';
}

async function correr() {
  const db = svc();
  // Mapa external_id -> dev_sku (para ligar el lead a su desarrollo).
  const { data: pubs } = await db.from('publicaciones').select('external_id,dev_sku');
  const devDe = Object.fromEntries((pubs || []).filter(p => p.external_id).map(p => [String(p.external_id), p.dev_sku]));

  // Fuentes: cada conexión EB activa (por cuenta) + la env global (desarrollador).
  const { data: conns } = await db.from('conexiones').select('*').eq('proveedor', 'easybroker').eq('activa', true);
  const fuentes = (conns || []).map(c => ({ org_id: c.org_id, key: c.api_key, ambiente: c.ambiente, tag: 'c' + c.id }));
  if (process.env.EASYBROKER_API_KEY) {
    let og = process.env.DEFAULT_ORG_ID || null;
    if (!og) { const { data: o } = await db.from('orgs').select('id').order('creado').limit(1).maybeSingle(); og = o?.id || null; }
    if (og) fuentes.push({ org_id: og, key: process.env.EASYBROKER_API_KEY, ambiente: 'produccion', tag: 'env' });
  }
  if (!fuentes.length) return { skipped: 'sin cuentas EB conectadas' };

  let creados = 0, revisados = 0;
  for (const f of fuentes) {
    const { leads, skipped, ok } = await fetchEBContactRequests(1, { key: f.key, ambiente: f.ambiente });
    if (skipped || ok === false) continue;
    revisados += leads.length;
    for (const cr of leads) {
      const rawId = String(cr.id ?? cr.public_id ?? '');
      if (!rawId) continue;
      const extId = f.tag + ':' + rawId;    // evita choques entre cuentas
      const { data: ya } = await db.from('eventos').select('id').eq('tipo', 'eb_lead').eq('entidad_id', extId).maybeSingle();
      if (ya) continue;
      const propId = cr.property_id || cr.property?.id || cr.source_id || null;
      const dev_sku = propId ? devDe[String(propId)] : null;
      const { data: nl } = await db.from('leads').insert({
        org_id: f.org_id,
        nombre: cr.name || cr.contact?.name || 'Lead de EasyBroker',
        telefono: cr.phone || cr.contact?.phone || null,
        email: cr.email || cr.contact?.email || null,
        dev_sku: dev_sku || null, mensaje: cr.message || null,
        etapa: 'Nuevo', fuente: 'EasyBroker', estatus: 'ok', consentimiento: true,
      }).select('id').single();
      if (nl) { creados++; try { await db.from('eventos').insert({ tipo: 'eb_lead', entidad: 'lead', entidad_id: extId, org_id: f.org_id, meta: { lead_id: nl.id, property: propId } }); } catch { /* noop */ } }
    }
  }
  return { ok: true, fuentes: fuentes.length, revisados, creados };
}

export async function POST(req) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
export async function GET(req) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
