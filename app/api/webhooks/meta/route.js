import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { fetchMetaLead } from '../../../../lib/integraciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verificación del webhook (Meta manda un GET con hub.challenge al configurarlo).
export async function GET(req) {
  const u = new URL(req.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 });
  }
  return NextResponse.json({ error: 'verify token no coincide' }, { status: 403 });
}

// Recepción de leads (leadgen) de Facebook / Instagram.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const db = svc();
  let creados = 0;
  try {
    for (const entry of (body.entry || [])) {
      for (const ch of (entry.changes || [])) {
        if (ch.field !== 'leadgen') continue;
        const leadgenId = ch.value?.leadgen_id;
        const info = leadgenId ? await fetchMetaLead(leadgenId) : null;
        if (!info) continue;
        let org_id = process.env.DEFAULT_ORG_ID || null;
        if (!org_id) { const { data: o } = await db.from('orgs').select('id').order('creado').limit(1).maybeSingle(); org_id = o?.id || null; }
        if (!org_id) continue;
        const { data } = await db.from('leads').insert({
          org_id, nombre: info.nombre, telefono: info.telefono, email: info.email,
          etapa: 'Nuevo', fuente: 'Meta Lead Ads', estatus: 'ok', consentimiento: true,
        }).select('id').single();
        if (data) { creados++; try { await db.from('eventos').insert({ tipo: 'lead_integracion', entidad: 'lead', entidad_id: String(data.id), org_id, meta: { fuente: 'Meta Lead Ads' } }); } catch { /* noop */ } }
      }
    }
  } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
  return NextResponse.json({ ok: true, creados });
}
