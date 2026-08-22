import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { resolverIAPublica } from '../../../../lib/ia';
import { responderAgente, transcribirAudio } from '../../../../lib/agente';
import { enviarWhatsAppCloud, resolverWhatsAppOrg, descargarMediaWhatsApp } from '../../../../lib/whatsapp';
import { verificarFirmaMeta } from '../../../../lib/webhookseg';
import { rateLimit, cuotaIA } from '../../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const dig = s => String(s || '').replace(/[^0-9]/g, '');
const IA_MAX_DIA = Number(process.env.IA_MAX_DIA || 500);
const IA_TRIAL_DIA = Number(process.env.IA_TRIAL_DIA || 25);

// Verificación del webhook (Meta / WhatsApp Cloud). Sin token por defecto: hay que configurarlo.
export async function GET(req) {
  const u = new URL(req.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  const verify = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && verify && token === verify) return new Response(challenge || '', { status: 200 });
  return new Response('forbidden', { status: 403 });
}

export async function POST(req) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  const sig = req.headers.get('x-hub-signature-256');
  // Fail-closed: sin App Secret configurado o firma inválida, no se procesa (200 para no filtrar).
  if (!secret || !verificarFirmaMeta(raw, sig, secret)) return NextResponse.json({ ok: true });
  let body = {};
  try { body = JSON.parse(raw); } catch { /* noop */ }
  try { await procesar(body); } catch { /* no romper el webhook */ }
  return NextResponse.json({ ok: true });
}

async function procesar(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg || !['text', 'audio'].includes(msg.type)) return;
  const from = msg.from;
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!from) return;

  const db = svc();
  const wa = await resolverWhatsAppOrg(db, phoneNumberId);
  if (!wa) return;                       // número no conectado a ninguna org
  const orgId = wa.orgId;
  if (!rateLimit('wa:' + orgId + ':' + dig(from), 8, 60 * 1000)) return;

  const { data: org } = await db.from('orgs').select('nombre,agente_modo').eq('id', orgId).maybeSingle();
  const modo = org?.agente_modo || 'auto';

  // Lead por teléfono (filtrado en la consulta, no en memoria).
  const tel10 = dig(from).slice(-10);
  const { data: cand } = await db.from('leads').select('id,asesor_id,dev_sku,nombre,telefono')
    .eq('org_id', orgId).ilike('telefono', '%' + tel10.slice(-8) + '%').limit(20);
  const lead = (cand || []).find(l => dig(l.telefono).slice(-10) === tel10) || null;
  const ia = await resolverIAPublica(db, lead?.asesor_id || null, orgId);

  // Texto entrante (nota de voz -> transcripción si hay llave OpenAI).
  let texto = (msg.text?.body || '').trim();
  let esAudio = false;
  if (msg.type === 'audio') {
    esAudio = true;
    const media = msg.audio?.id ? await descargarMediaWhatsApp(wa, msg.audio.id) : null;
    texto = (ia && media) ? (await transcribirAudio({ ia, buffer: media.buffer, mime: media.mime })) || '' : '';
    if (!texto) {
      await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'cliente', texto: '[nota de voz]', canal: 'whatsapp' });
      await tocarConversacion(db, orgId, from, '[nota de voz]', 'cliente', lead);
      await enviarWhatsAppCloud(wa, from, 'Recibí tu nota de voz 🙂 ¿Me lo escribes en un mensaje? Así te ayudo más rápido.');
      return;
    }
  }
  if (!texto) return;

  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'cliente', texto: esAudio ? '🎙️ ' + texto : texto, canal: 'whatsapp' });
  const conv = await tocarConversacion(db, orgId, from, texto, 'cliente', lead);

  // Pausa humana: si un asesor tomó la conversación, el bot NO contesta encima.
  const pausado = conv?.estado === 'pausado' && (!conv.pausado_hasta || new Date(conv.pausado_hasta) > new Date());
  if (pausado || modo === 'off') return;

  if (!ia) {
    await enviarWhatsAppCloud(wa, from, `Hola${lead?.nombre ? ' ' + String(lead.nombre).split(' ')[0] : ''}, gracias por tu mensaje. En un momento te contacta un asesor. 🙂`);
    return;
  }
  const cap = ia.trial ? { clave: 'trial:' + orgId, max: IA_TRIAL_DIA } : { clave: 'org:' + orgId, max: IA_MAX_DIA };
  if (!(await cuotaIA(db, cap.clave, cap.max))) {
    await enviarWhatsAppCloud(wa, from, 'Gracias por tu mensaje. En un momento te contacta un asesor. 🙂');
    if (ia.trial) await avisarAsesor(db, orgId, lead, 'ia_trial', 'Prueba del asistente agotada', 'Conecta tu llave de IA en Conexiones para que el asistente siga respondiendo a tus clientes.');
    return;
  }

  // Historial reciente para contexto (solo enviados, no borradores).
  const { data: hist } = await db.from('wa_mensajes').select('rol,texto')
    .eq('org_id', orgId).eq('telefono', from).eq('estado', 'enviado')
    .order('creado', { ascending: false }).limit(10);
  const historial = (hist || []).slice(1).reverse()
    .map(m => ({ role: m.rol === 'cliente' ? 'user' : 'assistant', content: m.texto || '' }))
    .filter(m => m.content);

  const r = await responderAgente({
    db, ia, orgId, nombreOrg: org?.nombre, canal: 'whatsapp', contacto: from,
    texto, historial, lead, asesorId: lead?.asesor_id || null,
    soloLectura: modo === 'sugerir',   // en sugerir el humano aprueba; nada se escribe solo
  });
  await db.rpc('ia_registrar_tokens', { p_clave: 'org:' + orgId, p_in: r.tokens_in, p_out: r.tokens_out });

  if (modo === 'sugerir') {
    // Borrador: no se envía; el asesor lo aprueba en /conversaciones.
    await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'agente', texto: r.texto, canal: 'whatsapp', estado: 'borrador', dev_sku: lead?.dev_sku || null, handoff: r.handoff, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
    await avisarAsesor(db, orgId, lead, 'agente_borrador', 'Borrador del asistente listo', `Para ${lead?.nombre || from}: "${r.texto.slice(0, 120)}"`);
    return;
  }

  await enviarWhatsAppCloud(wa, from, r.texto);
  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: from, rol: 'agente', texto: r.texto, canal: 'whatsapp', dev_sku: lead?.dev_sku || null, handoff: r.handoff, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
  await tocarConversacion(db, orgId, from, r.texto, 'agente', lead, r.leadCreado);

  // Escalamiento con dedupe (máximo un aviso por hora por teléfono).
  if (r.handoff) {
    const hace1h = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: reciente } = await db.from('wa_mensajes').select('id')
      .eq('org_id', orgId).eq('telefono', from).eq('rol', 'agente').eq('handoff', true)
      .gte('creado', hace1h).limit(2);
    if ((reciente || []).length <= 1) {
      await avisarAsesor(db, orgId, lead, 'wa_handoff', 'Cliente pide atención humana', `${lead?.nombre || from}: "${texto.slice(0, 140)}"`);
      if (lead?.asesor_id) {
        const { data: ase } = await db.from('profiles').select('telefono').eq('id', lead.asesor_id).maybeSingle();
        if (ase?.telefono) await enviarWhatsAppCloud(wa, ase.telefono, `🔔 ${lead?.nombre || 'Un cliente'} (${from}) pide atención humana. Último mensaje: "${texto.slice(0, 160)}"`);
      }
    }
  }
}

// Upsert del estado de conversación; devuelve la fila actual.
async function tocarConversacion(db, orgId, contacto, ultimo, rol, lead, leadNuevo) {
  const patch = {
    ultimo: String(ultimo || '').slice(0, 200), ultimo_rol: rol, actualizado: new Date().toISOString(),
    ...(lead?.id || leadNuevo ? { lead_id: lead?.id || leadNuevo } : {}),
  };
  const { data: cur } = await db.from('agente_conversaciones').select('id,estado,pausado_hasta,no_leidos')
    .eq('org_id', orgId).eq('canal', 'whatsapp').eq('contacto', contacto).maybeSingle();
  if (cur) {
    await db.from('agente_conversaciones').update({ ...patch, no_leidos: rol === 'cliente' ? (cur.no_leidos || 0) + 1 : cur.no_leidos }).eq('id', cur.id);
    return cur;
  }
  const { data: nueva } = await db.from('agente_conversaciones')
    .insert({ org_id: orgId, canal: 'whatsapp', contacto, ...patch, no_leidos: rol === 'cliente' ? 1 : 0 })
    .select('id,estado,pausado_hasta,no_leidos').single();
  return nueva;
}

// Notificación en la campana (y del asesor asignado o el primer director de la org).
async function avisarAsesor(db, orgId, lead, tipo, titulo, cuerpo) {
  let uid = lead?.asesor_id || null;
  if (!uid) {
    const { data: dir } = await db.from('profiles').select('id').eq('org_id', orgId).in('rol', ['director', 'gerente']).limit(1).maybeSingle();
    uid = dir?.id || null;
  }
  if (!uid) return;
  await db.from('notificaciones').insert({ org_id: orgId, user_id: uid, tipo, titulo, cuerpo, link: '/conversaciones' });
}
