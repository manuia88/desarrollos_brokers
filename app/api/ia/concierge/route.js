import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { llamarIA, iaConfigurada, contextoDesarrollo } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { sku, pregunta, historial } = body;
  if (!pregunta || !sku) return NextResponse.json({ error: 'falta pregunta o sku' }, { status: 400 });

  if (!iaConfigurada()) {
    return NextResponse.json({ answer: 'El asistente todavía no está activado. Deja tus datos abajo y tu asesor te responde cualquier duda al instante. 🙂', disabled: true });
  }

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: d } = await db.from('desarrollos')
    .select('nombre,alcaldia,colonia,estado,direccion,precio_min,precio_max,rec_min,rec_max,banos_min,banos_max,estac_min,estac_max,m2_min,m2_max,amenidades,fecha_entrega,etapa,apartado,esq_enganche,esq_mensualidades,esq_escritura,credito_ion,credito_hir,credito_bancario,ficha')
    .eq('sku', sku).single();
  if (!d) return NextResponse.json({ error: 'desarrollo no encontrado' }, { status: 404 });
  const { data: us } = await db.from('unidades').select('rec,precio,m2_hab').eq('dev_sku', sku).eq('estatus', 'Disponible');

  const system = `Eres el asistente virtual de ventas del desarrollo inmobiliario "${d.nombre}" en México. Respondes a clientes interesados.
REGLAS:
- Responde SOLO con la información de abajo. Si te preguntan algo que no está, dilo con honestidad e invita a agendar una visita con el asesor.
- Sé cálido, claro y breve (2-4 frases). Español de México. Sin markdown ni listas largas.
- Puedes estimar mensualidades: el 75% (monto a escriturar) se financia con crédito bancario a ~11.5% anual; calcula el pago mensual aproximado si te lo piden y aclara que es referencial.
- Cuando tenga sentido, cierra invitando a agendar una visita.
- Nunca inventes precios, fechas ni promociones.

DATOS DEL DESARROLLO:
${contextoDesarrollo(d, us)}`;

  const previos = Array.isArray(historial) ? historial.filter(m => m && m.role && m.content).slice(-6) : [];
  try {
    const answer = await llamarIA({ system, mensajes: [...previos, { role: 'user', content: String(pregunta).slice(0, 500) }], maxTokens: 400 });
    return NextResponse.json({ answer });
  } catch (e) {
    return NextResponse.json({ answer: 'Ahorita no puedo responder, pero tu asesor te ayuda enseguida. Deja tus datos abajo. 🙂', error: e.message }, { status: 200 });
  }
}
