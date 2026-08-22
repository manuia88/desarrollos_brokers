// Canal web público del Asesor Digital: el "Pregúntame" de la ficha pública y el
// widget embebible. Sin login; la identidad de conversación es un cid del navegador.
// La org sale del asesor que compartió (ficha) o del data-org del widget.
import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { resolverIAPublica } from '../../../../lib/ia';
import { responderAgente } from '../../../../lib/agente';
import { tituloDev } from '../../../../lib/nombre';
import { rateLimit, cuotaIA, clientIp } from '../../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const IA_MAX_DIA = Number(process.env.IA_MAX_DIA || 500);
const IA_TRIAL_DIA = Number(process.env.IA_TRIAL_DIA || 25);
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req) {
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const texto = String(b.texto || '').trim().slice(0, 1000);   // cap: endpoint público, evita abuso de almacenamiento
  const cid = String(b.cid || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
  if (!texto || !cid) return NextResponse.json({ error: 'falta texto o cid' }, { status: 400 });
  if (!rateLimit('aw:' + clientIp(req), 12, 60e3) || !rateLimit('aw-cid:' + cid, 12, 60e3)) {
    return NextResponse.json({ answer: 'Vas muy rápido 🙂 espera un momento e intenta de nuevo.' });
  }

  let db;
  try { db = svc(); } catch { return NextResponse.json({ answer: 'El asistente no está disponible por ahora. 🙂', disabled: true }); }
  // Org: por asesor (ficha compartida) o directa (widget con data-org).
  let orgId = null, asesorId = null;
  if (b.asesor && UUID.test(b.asesor)) {
    const { data: prof } = await db.from('profiles').select('id,org_id').eq('id', b.asesor).maybeSingle();
    if (prof) { asesorId = prof.id; orgId = prof.org_id; }
  } else if (b.org && UUID.test(b.org)) {
    orgId = b.org;
  }
  const ia = orgId ? await resolverIAPublica(db, asesorId, orgId) : null;
  const sinAsesor = { answer: 'El asistente todavía no está activado. Deja tus datos y un asesor te contacta enseguida. 🙂', disabled: true };
  if (!orgId) return NextResponse.json(sinAsesor);

  const { data: org } = await db.from('orgs').select('nombre,agente_modo').eq('id', orgId).maybeSingle();
  if (!org || org.agente_modo === 'off' || !ia) return NextResponse.json(sinAsesor);
  const cap = ia.trial ? { clave: 'trial:' + orgId, max: IA_TRIAL_DIA } : { clave: 'org:' + orgId, max: IA_MAX_DIA };
  if (!(await cuotaIA(db, cap.clave, cap.max))) {
    return NextResponse.json({ answer: 'Por hoy alcanzamos el límite del asistente. Deja tus datos y te contactamos enseguida. 🙂', disabled: true });
  }

  // Contexto de la ficha que está viendo (si viene sku), solo publicados.
  let contexto = null, devSku = null;
  if (b.sku) {
    const { data: d } = await db.from('desarrollos').select('sku,nombre,direccion').eq('sku', String(b.sku)).eq('publicado', true).maybeSingle();
    if (d) { contexto = `El cliente está viendo la ficha del desarrollo "${tituloDev(d)}" (clave ${d.sku}); parte de ahí.`; devSku = d.sku; }
  }

  const contacto = 'web:' + cid;
  await db.from('wa_mensajes').insert({ org_id: orgId, telefono: contacto, rol: 'cliente', texto, canal: 'web', dev_sku: devSku });

  // Historial en servidor (persiste entre recargas) + estado de conversación en el panel.
  const { data: cur } = await db.from('agente_conversaciones').select('id,no_leidos,lead_id,estado,pausado_hasta')
    .eq('org_id', orgId).eq('canal', 'web').eq('contacto', contacto).maybeSingle();
  if (cur) await db.from('agente_conversaciones').update({ ultimo: texto.slice(0, 200), ultimo_rol: 'cliente', no_leidos: (cur.no_leidos || 0) + 1, actualizado: new Date().toISOString() }).eq('id', cur.id);
  else await db.from('agente_conversaciones').insert({ org_id: orgId, canal: 'web', contacto, ultimo: texto.slice(0, 200), ultimo_rol: 'cliente', no_leidos: 1 });

  // Pausa humana aplica también aquí (un asesor pudo tomar el chat desde el panel).
  const pausado = cur?.estado === 'pausado' && (!cur.pausado_hasta || new Date(cur.pausado_hasta) > new Date());
  if (pausado) return NextResponse.json({ answer: 'Un asesor está atendiendo tu conversación, en un momento te responde. 🙂' });

  let lead = null;
  if (cur?.lead_id) { const { data } = await db.from('leads').select('id,asesor_id,dev_sku,nombre').eq('id', cur.lead_id).maybeSingle(); lead = data; }

  const { data: hist } = await db.from('wa_mensajes').select('rol,texto').eq('org_id', orgId).eq('telefono', contacto)
    .eq('estado', 'enviado').order('creado', { ascending: false }).limit(10);
  const historial = (hist || []).slice(1).reverse().map(m => ({ role: m.rol === 'cliente' ? 'user' : 'assistant', content: m.texto || '' })).filter(m => m.content);

  try {
    const r = await responderAgente({ db, ia, orgId, nombreOrg: org.nombre, canal: 'web', contacto, texto, historial, lead, asesorId, contexto });
    await db.rpc('ia_registrar_tokens', { p_clave: 'org:' + orgId, p_in: r.tokens_in, p_out: r.tokens_out });
    await db.from('wa_mensajes').insert({ org_id: orgId, telefono: contacto, rol: 'agente', texto: r.texto, canal: 'web', dev_sku: devSku, handoff: r.handoff, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
    const patchLead = r.leadCreado ? { lead_id: r.leadCreado } : {};
    await db.from('agente_conversaciones').update({ ultimo: r.texto.slice(0, 200), ultimo_rol: 'agente', actualizado: new Date().toISOString(), ...patchLead })
      .eq('org_id', orgId).eq('canal', 'web').eq('contacto', contacto);
    if (r.handoff && (asesorId || lead?.asesor_id)) {
      await db.from('notificaciones').insert({ org_id: orgId, user_id: lead?.asesor_id || asesorId, tipo: 'wa_handoff', titulo: 'Cliente del chat web pide atención', cuerpo: `"${texto.slice(0, 140)}"`, link: '/conversaciones' });
    }
    return NextResponse.json({ answer: r.texto });
  } catch {
    return NextResponse.json({ answer: 'Ahorita no puedo responder, pero un asesor te ayuda enseguida. Deja tus datos. 🙂' });
  }
}
