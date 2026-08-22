// Agente proactivo (pg_cron cada hora, 8am-8pm CDMX). Tres barridos con dedupe en agente_toques:
//  - Cadencias: leads fríos a los 2, 5 y 10 días sin actualización.
//  - Precio a la baja: cambios del diario -> leads interesados en ese desarrollo.
//  - No-shows: citas de ayer que quedaron en Solicitada/Confirmada.
// Los toques NOTIFICAN AL ASESOR con el texto listo (los mensajes salientes a >24h
// necesitan plantilla aprobada de Meta, así que no se mandan solos al cliente).
import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { tituloDev } from '../../../../lib/nombre';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

export async function POST(req) {
  if ((req.headers.get('x-cron-secret') || '') !== (process.env.CRON_SECRET || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const hora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false }));
  if (hora < 8 || hora >= 20) return NextResponse.json({ ok: true, skip: 'fuera de horario' });

  const db = svc();
  const hoy = new Date().toISOString().slice(0, 10);
  const res = { cadencias: 0, precio: 0, noshow: 0 };

  const { data: devs } = await db.from('desarrollos').select('sku,nombre,direccion');
  const devName = Object.fromEntries((devs || []).map(d => [d.sku, tituloDev(d)]));

  async function toque(leadId, tipo) {
    const { error } = await db.from('agente_toques').insert({ lead_id: leadId, tipo });
    return !error;   // false = ya existía (dedupe por unique)
  }
  async function notificar(lead, tipoNotif, titulo, cuerpo) {
    let uid = lead.asesor_id;
    if (!uid) { const { data: dir } = await db.from('profiles').select('id').eq('org_id', lead.org_id).in('rol', ['director', 'gerente']).limit(1).maybeSingle(); uid = dir?.id; }
    if (uid) await db.from('notificaciones').insert({ org_id: lead.org_id, user_id: uid, tipo: tipoNotif, titulo, cuerpo, link: '/crm' });
  }

  // --- 1) Cadencias de seguimiento ---
  const { data: frios } = await db.from('leads')
    .select('id,org_id,asesor_id,nombre,telefono,dev_sku,actualizado,etapa')
    .or('etapa.is.null,etapa.not.in.("Cita","Apartado","Escriturado","Perdido","Descartado")')
    .lt('actualizado', new Date(Date.now() - 2 * 86400e3).toISOString())
    .not('telefono', 'is', null).limit(300);
  for (const l of (frios || [])) {
    const dias = Math.floor((Date.now() - new Date(l.actualizado).getTime()) / 86400e3);
    const paso = dias >= 10 ? 'cadencia_3' : dias >= 5 ? 'cadencia_2' : 'cadencia_1';
    if (!(await toque(l.id, paso))) continue;
    const dev = devName[l.dev_sku] || 'el desarrollo que le interesa';
    const msg = paso === 'cadencia_1'
      ? `Hola ${String(l.nombre || '').split(' ')[0]}, ¿pudiste ver la info de ${dev}? Con gusto te agendo una visita esta semana.`
      : paso === 'cadencia_2'
        ? `Hola ${String(l.nombre || '').split(' ')[0]}, sigo al pendiente 🙂 ¿te gustaría ver ${dev} en persona? Tengo horarios disponibles.`
        : `Hola ${String(l.nombre || '').split(' ')[0]}, última vez que insisto 🙂 si sigue en tu radar ${dev}, dime y te aparto un horario; si no, ¡todo bien!`;
    await notificar(l, 'agente_cadencia', `Seguimiento ${dias}d: ${l.nombre || l.telefono}`, `Mándale: "${msg}"`);
    res.cadencias++;
  }

  // --- 2) Bajas de precio (diario /cambios) -> leads interesados en ese desarrollo ---
  const { data: bajas } = await db.from('cambios_inventario').select('dev_sku,sku,antes,despues')
    .eq('tipo', 'precio').gte('fecha', new Date(Date.now() - 24 * 3600e3).toISOString()).limit(500);
  const porDev = {};
  for (const c of (bajas || [])) {
    if ((c.despues?.precio || 0) < (c.antes?.precio || 0)) (porDev[c.dev_sku] = porDev[c.dev_sku] || []).push(c);
  }
  for (const [devSku, cambios] of Object.entries(porDev)) {
    const { data: interesados } = await db.from('leads').select('id,org_id,asesor_id,nombre,telefono,dev_sku')
      .eq('dev_sku', devSku).or('etapa.is.null,etapa.not.in.("Apartado","Escriturado","Perdido","Descartado")').limit(100);
    const mejor = cambios.reduce((b, c) => (c.antes.precio - c.despues.precio) > (b.antes.precio - b.despues.precio) ? c : b, cambios[0]);
    for (const l of (interesados || [])) {
      if (!(await toque(l.id, `precio:${devSku}:${hoy}`))) continue;
      await notificar(l, 'agente_precio', `Bajó de precio ${devName[devSku] || devSku}`,
        `${cambios.length} unidad(es) bajaron. Ej: ${MXN(mejor.antes.precio)} → ${MXN(mejor.despues.precio)}. Avísale a ${l.nombre || l.telefono}.`);
      res.precio++;
    }
  }

  // --- 3) Rescate de no-shows (citas de ayer sin desenlace) ---
  const ayer = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const { data: ns } = await db.from('citas').select('id,org_id,lead_id,asesor_id,nombre,telefono,dev_sku')
    .eq('fecha', ayer).in('estatus', ['Solicitada', 'Confirmada']).limit(100);
  for (const c of (ns || [])) {
    if (!c.lead_id || !(await toque(c.lead_id, `noshow:${c.id}`))) continue;
    await notificar({ ...c, asesor_id: c.asesor_id }, 'agente_noshow', `Rescata la cita de ${c.nombre || 'cliente'}`,
      `La visita de ayer a ${devName[c.dev_sku] || c.dev_sku || 'el desarrollo'} quedó sin desenlace. Mándale: "Hola ${String(c.nombre || '').split(' ')[0]}, ¿reagendamos tu visita? Tengo horarios hoy y mañana."`);
    res.noshow++;
  }

  return NextResponse.json({ ok: true, ...res });
}
