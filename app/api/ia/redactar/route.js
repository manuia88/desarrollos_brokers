import { tituloDev } from '../../../../lib/nombre';
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { llamarIA, resolverIA } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

// Redacta un mensaje de WhatsApp listo para enviar a un lead (BYOK).
export async function POST(req) {
  const uid = await userFromToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: prof } = await db.from('profiles').select('org_id,nombre').eq('id', uid).maybeSingle();

  const ia = await resolverIA(db, uid);
  if (!ia) return NextResponse.json({ disabled: true, mensaje: 'Conecta tu llave de IA en Conexiones para redactar mensajes automáticamente.' }, { status: 200 });

  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { leadId, objetivo, tono } = body;
  if (!leadId) return NextResponse.json({ error: 'falta leadId' }, { status: 400 });

  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'lead no encontrado' }, { status: 404 });
  // Solo su lead o de su inmobiliaria.
  if (lead.asesor_id !== uid && lead.org_id !== prof?.org_id) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });

  let dev = null;
  if (lead.dev_sku) { const { data: d } = await db.from('desarrollos').select('nombre,direccion,colonia,alcaldia,precio_min,precio_max,rec_min,rec_max,etapa,fecha_entrega,amenidades').eq('sku', lead.dev_sku).maybeSingle(); dev = d; }

  const presu = lead.presupuesto_max || lead.presupuesto || null;
  const perfil = [
    lead.nombre && `Nombre: ${lead.nombre}`,
    lead.rec_interes != null && `Busca: ${lead.rec_interes === 0 ? 'loft' : lead.rec_interes + ' recámaras'}`,
    lead.zona_interes && `Zona: ${lead.zona_interes}`,
    presu && `Presupuesto: ${MXN(presu)}`,
    lead.forma_pago && !/por definir/i.test(lead.forma_pago) && `Pago: ${lead.forma_pago}`,
    lead.urgencia && `Urgencia: ${lead.urgencia}`,
    lead.mensaje && `Comentó: "${String(lead.mensaje).slice(0, 200)}"`,
    lead.etapa && `Etapa en el CRM: ${lead.etapa}`,
  ].filter(Boolean).join('\n');
  const ctxDev = dev ? `Desarrollo de interés: ${tituloDev(dev)} (${[dev.colonia, dev.alcaldia].filter(Boolean).join(', ')}), desde ${MXN(dev.precio_min)}, ${dev.rec_min}–${dev.rec_max} rec, ${dev.etapa}${dev.amenidades ? `. Amenidades: ${dev.amenidades}` : ''}.` : 'Sin desarrollo específico asociado.';

  const system = `Eres asesor inmobiliario en México y escribes un mensaje de WhatsApp para un cliente. Reglas:
- Español de México, cálido y natural, de tú, SIN markdown ni asteriscos.
- Corto: 3 a 5 líneas máximo. Una sola idea + una llamada a la acción clara (agendar visita o responder).
- Personalízalo con lo que sabemos del cliente y del desarrollo. No inventes precios, fechas ni promociones que no estén en el contexto.
- No uses "Estimado". Empieza con el nombre si lo hay.
- Firma simple con el nombre del asesor (${prof?.nombre || 'tu asesor'}).
- Objetivo del mensaje: ${objetivo || 'reactivar el interés y proponer una visita'}. Tono: ${tono || 'amigable y profesional'}.
Devuelve SOLO el texto del mensaje, sin comillas ni explicaciones.`;

  const prompt = `PERFIL DEL CLIENTE:\n${perfil || 'Datos mínimos.'}\n\n${ctxDev}\n\nEscribe el mensaje de WhatsApp.`;

  try {
    const mensaje = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [{ role: 'user', content: prompt }], maxTokens: 400 });
    return NextResponse.json({ mensaje: (mensaje || '').replace(/^["“]|["”]$/g, '').trim() });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'error de IA' }, { status: 200 });
  }
}
