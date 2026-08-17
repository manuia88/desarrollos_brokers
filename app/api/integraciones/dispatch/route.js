import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { dispatchLead } from '../../../../lib/integraciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Empuja un lead a los CRMs de salida (Salesforce / HubSpot / GHL).
// Pensado para llamarse desde un Database Webhook de Supabase al insertar un lead,
// o manualmente. Se protege con x-webhook-secret.
function autorizado(req) {
  const secret = process.env.INTEGRACIONES_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get('x-webhook-secret') === secret;
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  // Supabase DB webhook manda { record: {...} }; también aceptamos { lead_id } o el lead directo.
  const rec = body.record || body;
  const db = svc();
  let lead = rec;
  if (rec.lead_id && !rec.nombre) { const { data } = await db.from('leads').select('*').eq('id', rec.lead_id).maybeSingle(); lead = data || rec; }
  // No reenviar lo que entró por integración (evita bucles).
  if (/integraci|meta lead|sync/i.test(lead.fuente || '')) return NextResponse.json({ skipped: 'origen integración' });
  if (lead.org_id) { const { data: o } = await db.from('orgs').select('nombre').eq('id', lead.org_id).maybeSingle(); lead.org_nombre = o?.nombre; }
  try { return NextResponse.json({ ok: true, resultado: await dispatchLead(lead) }); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
