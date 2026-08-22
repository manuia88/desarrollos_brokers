// Canal Telegram: mismo cerebro que WhatsApp. La org se identifica por ?k=<hash del token>
// (el hash viaja en la URL que registró setWebhook; el token nunca sale de conexiones).
import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { resolverIA } from '../../../../lib/ia';
import { responderAgente } from '../../../../lib/agente';
import { resolverTelegramPorHash, enviarTelegram } from '../../../../lib/telegram';
import { rateLimit, cuotaIA } from '../../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const IA_MAX_DIA = Number(process.env.IA_MAX_DIA || 500);

export async function POST(req) {
  let ok = { ok: true };
  try { await procesar(req); } catch { /* nunca romper el webhook */ }
  return NextResponse.json(ok);
}

async function procesar(req) {
  const k = new URL(req.url).searchParams.get('k');
  const db = svc();
  const tg = await resolverTelegramPorHash(db, k);
  if (!tg) return;
  const body = await req.json().catch(() => ({}));
  const msg = body?.message;
  const texto = (msg?.text || '').trim();
  const chatId = String(msg?.chat?.id || '');
  if (!texto || !chatId) return;
  const orgId = tg.orgId;
  if (!rateLimit('tg:' + orgId + ':' + chatId, 8, 60 * 1000)) return;

  const { data: org } = await db.from('orgs').select('nombre,agente_modo').eq('id', orgId).maybeSingle();
  const modo = org?.agente_modo || 'auto';

  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: chatId, rol: 'cliente', texto, canal: 'telegram' });
  const { data: conv } = await db.from('agente_conversaciones').select('id,estado,pausado_hasta,no_leidos,lead_id')
    .eq('org_id', orgId).eq('canal', 'telegram').eq('contacto', chatId).maybeSingle();
  if (conv) {
    await db.from('agente_conversaciones').update({ ultimo: texto.slice(0, 200), ultimo_rol: 'cliente', no_leidos: (conv.no_leidos || 0) + 1, actualizado: new Date().toISOString() }).eq('id', conv.id);
  } else {
    await db.from('agente_conversaciones').insert({ org_id: orgId, canal: 'telegram', contacto: chatId, ultimo: texto.slice(0, 200), ultimo_rol: 'cliente', no_leidos: 1 });
  }
  const pausado = conv?.estado === 'pausado' && (!conv.pausado_hasta || new Date(conv.pausado_hasta) > new Date());
  if (pausado || modo === 'off') return;

  let lead = null;
  if (conv?.lead_id) { const { data } = await db.from('leads').select('id,asesor_id,dev_sku,nombre').eq('id', conv.lead_id).maybeSingle(); lead = data; }
  const ia = await resolverIA(db, lead?.asesor_id || null, { permitirPlataforma: false });
  if (!ia) { await enviarTelegram(tg, chatId, 'Gracias por tu mensaje, en un momento te contacta un asesor. 🙂'); return; }
  if (!(await cuotaIA(db, 'org:' + orgId, IA_MAX_DIA))) { await enviarTelegram(tg, chatId, 'Gracias por tu mensaje, en un momento te contacta un asesor. 🙂'); return; }

  const { data: hist } = await db.from('wa_mensajes').select('rol,texto').eq('org_id', orgId).eq('telefono', chatId)
    .eq('canal', 'telegram').eq('estado', 'enviado').order('creado', { ascending: false }).limit(10);
  const historial = (hist || []).slice(1).reverse().map(m => ({ role: m.rol === 'cliente' ? 'user' : 'assistant', content: m.texto || '' })).filter(m => m.content);

  const r = await responderAgente({ db, ia, orgId, nombreOrg: org?.nombre, canal: 'telegram', contacto: chatId, texto, historial, lead, asesorId: lead?.asesor_id || null });
  await db.rpc('ia_registrar_tokens', { p_clave: 'org:' + orgId, p_in: r.tokens_in, p_out: r.tokens_out });

  if (modo === 'sugerir') {
    await db.from('wa_mensajes').insert({ org_id: orgId, telefono: chatId, rol: 'agente', texto: r.texto, canal: 'telegram', estado: 'borrador', handoff: r.handoff, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
    return;
  }
  await enviarTelegram(tg, chatId, r.texto);
  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: chatId, rol: 'agente', texto: r.texto, canal: 'telegram', handoff: r.handoff, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
  const patchLead = r.leadCreado ? { lead_id: r.leadCreado } : {};
  await db.from('agente_conversaciones').update({ ultimo: r.texto.slice(0, 200), ultimo_rol: 'agente', actualizado: new Date().toISOString(), ...patchLead })
    .eq('org_id', orgId).eq('canal', 'telegram').eq('contacto', chatId);
}
