import { tituloDev } from '../../../../lib/nombre';
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { llamarIA, resolverIA } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

// Briefing pre-cita: una pantalla con quién es, qué resaltar, objeciones y preguntas (BYOK).
export async function POST(req) {
  const uid = await userFromToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: prof } = await db.from('profiles').select('org_id').eq('id', uid).maybeSingle();

  const ia = await resolverIA(db, uid);
  if (!ia) return NextResponse.json({ disabled: true, briefing: 'Conecta tu llave de IA en Conexiones para generar briefings automáticos.' }, { status: 200 });

  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  let { leadId, citaId } = body;

  let cita = null, lead = null, devSku = null, nombre = null;
  if (citaId) {
    const { data: c } = await db.from('citas').select('*').eq('id', citaId).maybeSingle();
    if (!c) return NextResponse.json({ error: 'cita no encontrada' }, { status: 404 });
    if (c.asesor_id !== uid && c.org_id !== prof?.org_id) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
    cita = c; leadId = c.lead_id; devSku = c.dev_sku; nombre = c.nombre;
  }
  if (leadId) {
    const { data: l } = await db.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (l) {
      if (l.asesor_id !== uid && l.org_id !== prof?.org_id) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
      lead = l; devSku = devSku || l.dev_sku; nombre = nombre || l.nombre;
    }
  }
  if (!lead && !cita) return NextResponse.json({ error: 'falta leadId o citaId' }, { status: 400 });

  let dev = null;
  if (devSku) { const { data: d } = await db.from('desarrollos').select('nombre,direccion,colonia,alcaldia,precio_min,precio_max,rec_min,rec_max,etapa,fecha_entrega,amenidades,comision_broker,credito_ion,credito_hir,credito_bancario').eq('sku', devSku).maybeSingle(); dev = d; }

  const presu = lead?.presupuesto_max || lead?.presupuesto || null;
  const perfil = [
    nombre && `Nombre: ${nombre}`,
    lead?.rec_interes != null && `Busca: ${lead.rec_interes === 0 ? 'loft' : lead.rec_interes + ' recámaras'}`,
    lead?.banos_interes != null && `Baños: ${lead.banos_interes}`,
    lead?.zona_interes && `Zona: ${lead.zona_interes}`,
    presu && `Presupuesto: ${MXN(presu)}`,
    lead?.forma_pago && !/por definir/i.test(lead.forma_pago) && `Pago: ${lead.forma_pago}`,
    lead?.urgencia && `Urgencia: ${lead.urgencia}`,
    lead?.mensaje && `Comentó: "${String(lead.mensaje).slice(0, 240)}"`,
    cita && `Cita: ${cita.fecha} ${cita.hora || ''} (${cita.modalidad || 'presencial'}).`,
  ].filter(Boolean).join('\n');
  const ctxDev = dev ? `DESARROLLO DE LA CITA: ${tituloDev(dev)} (${[dev.colonia, dev.alcaldia].filter(Boolean).join(', ')}). Precios ${MXN(dev.precio_min)}–${MXN(dev.precio_max)}, ${dev.rec_min}–${dev.rec_max} rec, ${dev.etapa}${dev.fecha_entrega ? `, entrega ${dev.fecha_entrega}` : ''}. Amenidades: ${dev.amenidades || '—'}. Créditos: ${[dev.credito_bancario && 'Bancario', dev.credito_ion && 'ION', dev.credito_hir && 'HIR'].filter(Boolean).join(', ') || '—'}.` : 'Sin desarrollo asociado.';

  const system = `Eres un coach de ventas inmobiliarias en México. Prepara a un asesor para una cita con un cliente. Devuelve un briefing BREVE y accionable de UNA pantalla, en español de México, sin markdown pesado (usa títulos cortos en mayúscula y guiones). Estructura EXACTA:
QUIÉN ES: 1-2 líneas.
QUÉ RESALTAR: 3 puntos del desarrollo alineados a lo que busca.
OBJECIONES PROBABLES: 2-3, con una respuesta corta cada una.
PREGUNTAS PARA CALIFICAR: 3 preguntas.
No inventes datos que no estén en el contexto.`;
  const prompt = `PERFIL DEL CLIENTE:\n${perfil || 'Datos mínimos.'}\n\n${ctxDev}\n\nGenera el briefing.`;

  try {
    const briefing = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [{ role: 'user', content: prompt }], maxTokens: 700 });
    return NextResponse.json({ briefing });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'error de IA' }, { status: 200 });
  }
}
