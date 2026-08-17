import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook universal de entrada de leads. Lo puede llamar n8n, Make, Zapier,
// GoHighLevel o cualquier formulario. Requiere el header x-webhook-secret.
async function crear(body) {
  const db = svc();
  let org_id = body.org_id || process.env.DEFAULT_ORG_ID || null;
  if (!org_id) {
    const { data: o } = await db.from('orgs').select('id').order('creado').limit(1).maybeSingle();
    org_id = o?.id || null;
  }
  if (!org_id) return { error: 'sin organización destino (define DEFAULT_ORG_ID)' };

  const row = {
    org_id,
    asesor_id: body.asesor_id || null,
    nombre: body.nombre || body.name || 'Lead',
    telefono: body.telefono || body.phone || null,
    email: body.email || null,
    dev_sku: body.dev_sku || null,
    mensaje: body.mensaje || body.message || null,
    presupuesto: body.presupuesto || null,
    etapa: 'Nuevo',
    fuente: body.fuente || body.source || 'Integración',
    estatus: 'ok',
    consentimiento: body.consentimiento ?? false,
  };
  const { data, error } = await db.from('leads').insert(row).select('id').single();
  if (error) return { error: error.message };
  try { await db.from('eventos').insert({ tipo: 'lead_integracion', entidad: 'lead', entidad_id: String(data.id), org_id, meta: { fuente: row.fuente } }); } catch { /* noop */ }
  if (body.asesor_id) { try { await db.rpc('notificar', { p_user: body.asesor_id, p_tipo: 'lead_asignado', p_titulo: 'Nuevo lead de integración', p_cuerpo: `${row.nombre} entró por ${row.fuente}.`, p_link: '/crm' }); } catch { /* noop */ } }
  return { ok: true, lead_id: data.id };
}

function autorizado(req) {
  const secret = process.env.INTEGRACIONES_WEBHOOK_SECRET;
  if (!secret) return false; // debe configurarse para habilitar el webhook
  return req.headers.get('x-webhook-secret') === secret;
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado (falta o no coincide x-webhook-secret)' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch { /* body vacío */ }
  try { return NextResponse.json(await crear(body)); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
