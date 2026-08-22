// Acciones del panel /conversaciones: enviar como asesor, aprobar/descartar borradores,
// pausar/reanudar el bot, marcar leído, cambiar el modo del agente y conectar Telegram.
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { enviarWhatsAppCloud, resolverWhatsAppPorOrg } from '../../../../lib/whatsapp';
import { enviarTelegram, resolverTelegramPorOrg, hashToken } from '../../../../lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof ? { uid, ...prof } : null;
}

async function enviarPorCanal(db, orgId, canal, contacto, texto) {
  if (canal === 'telegram') {
    const tg = await resolverTelegramPorOrg(db, orgId);
    return tg ? enviarTelegram(tg, contacto, texto) : false;
  }
  const wa = await resolverWhatsAppPorOrg(db, orgId);
  return wa ? enviarWhatsAppCloud(wa, contacto, texto) : false;
}

export async function POST(req) {
  const p = await quien(req);
  if (!p) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const db = svc();
  const esSuper = p.rol === 'super_admin';

  // Toda acción sobre una conversación valida que sea de la org del usuario.
  const esGestor = esSuper || ['director', 'gerente'].includes(p.rol);
  async function conv(id) {
    const { data } = await db.from('agente_conversaciones').select('*').eq('id', id).maybeSingle();
    if (!data || (!esSuper && data.org_id !== p.org_id)) return null;
    // Aislamiento por asesor: fuera de gestores, solo las propias o sin asignar.
    if (!esGestor && data.lead_id) {
      const { data: l } = await db.from('leads').select('asesor_id').eq('id', data.lead_id).maybeSingle();
      if (l && l.asesor_id && l.asesor_id !== p.uid) return null;
    }
    return data;
  }

  if (b.accion === 'enviar') {
    const c = await conv(b.conv_id);
    if (!c || !b.texto?.trim()) return NextResponse.json({ error: 'conversación o texto inválido' }, { status: 400 });
    const ok = await enviarPorCanal(db, c.org_id, c.canal, c.contacto, b.texto.trim());
    if (!ok) return NextResponse.json({ error: 'No se pudo enviar (¿canal conectado?)' }, { status: 200 });
    await db.from('wa_mensajes').insert({ org_id: c.org_id, telefono: c.contacto, rol: 'asesor', texto: b.texto.trim(), canal: c.canal });
    // Al intervenir un humano, el bot se pausa 1 hora para no contestarle encima.
    await db.from('agente_conversaciones').update({ estado: 'pausado', pausado_hasta: new Date(Date.now() + 3600e3).toISOString(), no_leidos: 0, ultimo: b.texto.trim().slice(0, 200), ultimo_rol: 'asesor', actualizado: new Date().toISOString() }).eq('id', c.id);
    return NextResponse.json({ ok: true });
  }

  if (b.accion === 'aprobar' || b.accion === 'descartar') {
    const { data: m } = await db.from('wa_mensajes').select('*').eq('id', b.msg_id).eq('estado', 'borrador').maybeSingle();
    if (!m || (!esSuper && m.org_id !== p.org_id)) return NextResponse.json({ error: 'borrador no encontrado' }, { status: 404 });
    if (!esGestor) {
      const { data: c0 } = await db.from('agente_conversaciones').select('lead_id').eq('org_id', m.org_id).eq('canal', m.canal).eq('contacto', m.telefono).maybeSingle();
      if (c0?.lead_id) { const { data: l } = await db.from('leads').select('asesor_id').eq('id', c0.lead_id).maybeSingle(); if (l?.asesor_id && l.asesor_id !== p.uid) return NextResponse.json({ error: 'borrador no encontrado' }, { status: 404 }); }
    }
    if (b.accion === 'descartar') {
      await db.from('wa_mensajes').update({ estado: 'descartado' }).eq('id', m.id);
      return NextResponse.json({ ok: true });
    }
    const texto = (b.texto || m.texto || '').trim();
    const ok = await enviarPorCanal(db, m.org_id, m.canal, m.telefono, texto);
    if (!ok) return NextResponse.json({ error: 'No se pudo enviar (¿canal conectado?)' }, { status: 200 });
    await db.from('wa_mensajes').update({ estado: 'enviado', texto }).eq('id', m.id);
    await db.from('agente_conversaciones').update({ ultimo: texto.slice(0, 200), ultimo_rol: 'agente', actualizado: new Date().toISOString() })
      .eq('org_id', m.org_id).eq('canal', m.canal).eq('contacto', m.telefono);
    return NextResponse.json({ ok: true });
  }

  if (b.accion === 'pausar' || b.accion === 'reanudar') {
    const c = await conv(b.conv_id);
    if (!c) return NextResponse.json({ error: 'conversación no encontrada' }, { status: 404 });
    const patch = b.accion === 'reanudar'
      ? { estado: 'bot', pausado_hasta: null }
      : { estado: 'pausado', pausado_hasta: b.horas ? new Date(Date.now() + b.horas * 3600e3).toISOString() : null };
    await db.from('agente_conversaciones').update(patch).eq('id', c.id);
    return NextResponse.json({ ok: true });
  }

  if (b.accion === 'leido') {
    const c = await conv(b.conv_id);
    if (c) await db.from('agente_conversaciones').update({ no_leidos: 0 }).eq('id', c.id);
    return NextResponse.json({ ok: true });
  }

  if (b.accion === 'modo') {
    if (!esSuper && !['director', 'gerente'].includes(p.rol)) return NextResponse.json({ error: 'solo el director cambia el modo' }, { status: 403 });
    if (!['off', 'sugerir', 'auto'].includes(b.modo)) return NextResponse.json({ error: 'modo inválido' }, { status: 400 });
    const orgId = esSuper && b.org_id ? b.org_id : p.org_id;
    await db.from('orgs').update({ agente_modo: b.modo }).eq('id', orgId);
    return NextResponse.json({ ok: true });
  }

  if (b.accion === 'telegram_webhook') {
    // Registra el webhook del bot de Telegram de la org (tras guardar el token en /conexiones).
    if (!esSuper && !['director', 'gerente'].includes(p.rol)) return NextResponse.json({ error: 'solo el director' }, { status: 403 });
    const tg = await resolverTelegramPorOrg(db, esSuper && b.org_id ? b.org_id : p.org_id);
    if (!tg) return NextResponse.json({ error: 'Primero guarda el token del bot en Conexiones.' }, { status: 200 });
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://desarrollos-brokers-portal.vercel.app';
    const url = `${base}/api/telegram/webhook?k=${hashToken(tg.token)}`;
    const r = await fetch(`https://api.telegram.org/bot${tg.token}/setWebhook`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message'] }),
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: !!j.ok, detalle: j.description || null });
  }

  return NextResponse.json({ error: 'acción desconocida' }, { status: 400 });
}
