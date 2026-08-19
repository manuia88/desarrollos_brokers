import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { resolverIA, llamarIA } from '../../../../lib/ia';
import { enviarWhatsAppCloud, resolverWhatsAppOrg } from '../../../../lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const dig = s => String(s || '').replace(/[^0-9]/g, '');

// Verificación del webhook (Meta / WhatsApp Cloud).
export async function GET(req) {
  const u = new URL(req.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || 'quierocasa';
  if (mode === 'subscribe' && token === verify) return new Response(challenge || '', { status: 200 });
  return new Response('forbidden', { status: 403 });
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  // Siempre responder 200 rápido; Meta reintenta si no.
  try { await procesar(body); } catch { /* no romper el webhook */ }
  return NextResponse.json({ ok: true });
}

async function procesar(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg || msg.type !== 'text') return;
  const from = msg.from;
  const texto = (msg.text?.body || '').trim();
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!from || !texto) return;

  const db = svc();
  const wa = await resolverWhatsAppOrg(db, phoneNumberId);
  if (!wa) return;                       // número no conectado a ninguna org
  const orgId = wa.orgId;

  // Historial reciente de la conversación.
  const { data: hist } = await db.from('wa_mensajes').select('rol,texto')
    .eq('org_id', orgId).eq('telefono', from).order('creado', { ascending: false }).limit(10);
  const previos = (hist || []).reverse().map(m => ({ role: m.rol === 'cliente' ? 'user' : 'assistant', content: m.texto || '' }));

  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'cliente', texto });

  // Lead de este cliente (para contexto y a qué asesor escalar).
  const tel10 = dig(from).slice(-10);
  const { data: leads } = await db.from('leads').select('id,asesor_id,dev_sku,nombre,telefono').eq('org_id', orgId).limit(500);
  const lead = (leads || []).find(l => dig(l.telefono).slice(-10) === tel10) || null;

  // Inventario resumido como contexto.
  const { data: devs } = await db.from('desarrollos').select('nombre,alcaldia,precio_min,precio_max,rec_min,rec_max,etapa').limit(40);
  const inv = (devs || []).map(d => `${d.nombre} (${d.alcaldia}): ${MXN(d.precio_min)}–${MXN(d.precio_max)}, ${d.rec_min}–${d.rec_max} rec, ${d.etapa}`).join('\n');

  const ia = await resolverIA(db, lead?.asesor_id || null);
  if (!ia) {
    await enviarWhatsAppCloud(wa, from, `Hola${lead?.nombre ? ' ' + String(lead.nombre).split(' ')[0] : ''}, gracias por tu mensaje. En un momento te contacta un asesor. 🙂`);
    return;
  }

  const system = `Eres el asistente de una inmobiliaria en México que atiende a clientes por WhatsApp. Reglas:
- Responde breve, cálido y útil, en español de México, sin markdown.
- Usa SOLO el inventario de abajo; nunca inventes precios, fechas ni promociones.
- Si el cliente quiere hablar con una persona, se molesta, o pide algo que no puedes resolver con el inventario, empieza tu respuesta EXACTAMENTE con "HANDOFF:" seguido de una frase amable diciéndole que un asesor lo contacta.
- Cuando tenga sentido, invita a agendar una visita.
${lead?.dev_sku ? `El cliente ha mostrado interés en el desarrollo con clave ${lead.dev_sku}.` : ''}

INVENTARIO:
${inv}`;

  let reply = '';
  try {
    reply = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [...previos, { role: 'user', content: texto.slice(0, 700) }], maxTokens: 350 });
  } catch {
    reply = 'Con gusto te ayudo. ¿Me confirmas qué buscas: zona, recámaras y presupuesto?';
  }

  const handoff = /^\s*handoff\s*:/i.test(reply);
  if (handoff) reply = reply.replace(/^\s*handoff\s*:/i, '').trim() || 'Con gusto te paso con un asesor, en un momento te contacta.';

  await enviarWhatsAppCloud(wa, from, reply);
  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'agente', texto: reply, dev_sku: lead?.dev_sku || null, handoff });

  // Escalar: avisar al asesor por el mismo número de la org.
  if (handoff && lead?.asesor_id) {
    const { data: ase } = await db.from('profiles').select('telefono,nombre').eq('id', lead.asesor_id).maybeSingle();
    if (ase?.telefono) {
      await enviarWhatsAppCloud(wa, ase.telefono, `🔔 ${lead.nombre || 'Un cliente'} (${from}) pide atención humana por WhatsApp. Último mensaje: "${texto.slice(0, 160)}"`);
    }
  }
}
