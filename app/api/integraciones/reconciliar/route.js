import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { mapEasyBroker, pushEasyBroker, elegirConexionEB } from '../../../../lib/integraciones';
import { resolverReglas, ordenar } from '../../../../lib/publicador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ahora = () => new Date().toISOString();

// Mantiene los anuncios vivos de una campaña iguales a lo que la receta resuelve HOY.
// mode 'full' = baja lo vendido y sube el reemplazo (auto-relleno). 'takedown' = solo baja.
async function reconciliarCampana(db, camp, mode) {
  const portal = camp.portal || 'easybroker';
  // Credencial de la cuenta dueña de la campaña (org) o env global del desarrollador.
  let cfg = null, cuenta = 'dev';
  if (portal === 'easybroker' && camp.org_id) {
    const { data: org } = await db.from('orgs').select('eb_modo').eq('id', camp.org_id).maybeSingle();
    const { data: conns } = await db.from('conexiones').select('*').eq('org_id', camp.org_id);
    const sel = elegirConexionEB(conns, { org_id: camp.org_id, asesor_id: null, eb_modo: 'org' });
    if (sel) { cfg = { key: sel.key, ambiente: sel.ambiente }; cuenta = 'org:' + camp.org_id; }
  }
  const { data: devs } = await db.from('desarrollos').select('*');
  const byId = Object.fromEntries((devs || []).map(d => [d.sku, d]));
  const { data: unitsAll } = await db.from('unidades').select('*');
  const byUnit = Object.fromEntries((unitsAll || []).map(u => [u.sku, u]));
  const disponibles = (unitsAll || []).filter(u => u.estatus === 'Disponible');

  const desired = ordenar(resolverReglas(disponibles, byId, camp.base || {}, camp.reglas || []), byId, camp.orden || 'precio').slice(0, camp.limite || 30);
  const desiredRefs = new Set(desired.map(u => u.sku));

  const { data: pubs } = await db.from('publicaciones').select('*').eq('campana_id', camp.id);
  const live = (pubs || []).filter(p => ['publicado', 'borrador'].includes(p.estatus));

  let bajados = 0, subidos = 0;

  // 1) Bajar lo que ya no debe estar (vendido/apartado o fuera de la receta).
  for (const p of live) {
    if (desiredRefs.has(p.ref)) continue;
    const u = byUnit[p.ref];
    const st = u && /vend/i.test(u.estatus) ? 'sold' : (u && /apart|reserv/i.test(u.estatus) ? 'reserved' : 'not_published');
    if (portal === 'easybroker' && p.external_id) { try { await pushEasyBroker({ status: st }, p.external_id, cfg); } catch { /* noop */ } }
    await db.from('publicaciones').update({ estatus: 'retirado', meta: { ...(p.meta || {}), motivo: st }, actualizado: ahora() }).eq('id', p.id);
    bajados++;
  }

  // 2) Subir los que faltan para cumplir la receta (solo si reponemos).
  if (mode === 'full') {
    const liveRefs = new Set(live.filter(p => desiredRefs.has(p.ref)).map(p => p.ref));
    for (const u of desired) {
      if (liveRefs.has(u.sku)) continue;
      const d = byId[u.dev_sku]; if (!d) continue;
      const prev = (pubs || []).find(p => p.ref === u.sku);
      const body = mapEasyBroker({
        ref: u.sku, title: `${d.nombre}${u.prototipo ? ' · ' + u.prototipo : ''}`,
        description: d.notas || `${d.nombre} en ${d.colonia}, ${d.alcaldia}. ${u.rec === 0 ? 'Loft' : u.rec + ' recámaras'}.`,
        propertyType: d.tipo || 'Departamento', status: camp.status === 'published' ? 'published' : 'not_published',
        price: u.precio, bedrooms: u.rec || 0, bathrooms: Math.floor(u.banos || 0), parking: u.n_estac || 0,
        construction: u.m2_total || u.m2_hab || null, locationName: [d.colonia, d.alcaldia, d.estado].filter(Boolean).join(', '),
      });
      let res = portal === 'easybroker' ? await pushEasyBroker(body, prev?.external_id, cfg).catch(e => ({ error: String(e?.message || e) })) : { skipped: true };
      const estatus = res.skipped ? 'pendiente' : (res.ok ? (camp.status === 'published' ? 'publicado' : 'borrador') : 'error');
      await db.from('publicaciones').upsert({
        org_id: camp.org_id, portal, ref: u.sku, dev_sku: u.dev_sku, campana_id: camp.id, cuenta,
        external_id: res.external_id || prev?.external_id || null, estatus,
        error: res.error || (res.skipped ? 'sin conexión EB' : null),
        meta: { rec: u.rec, prototipo: u.prototipo, precio: u.precio }, actualizado: ahora(),
      }, { onConflict: 'portal,ref,cuenta' });
      subidos++;
    }
  }

  await db.from('campanas').update({ actualizado: ahora() }).eq('id', camp.id);
  return { campana: camp.nombre || camp.id, desired: desired.length, bajados, subidos };
}

async function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return { cron: true };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol').eq('id', uid).maybeSingle();
  return prof?.rol === 'super_admin' ? { cron: false } : null;
}

async function correr(req, body) {
  const db = svc();
  let q = db.from('campanas').select('*').eq('activa', true);
  if (body?.campana_id) q = db.from('campanas').select('*').eq('id', body.campana_id);
  const { data: camps } = await q;
  const manual = !!body?.campana_id;
  const res = [];
  for (const c of (camps || [])) res.push(await reconciliarCampana(db, c, (manual || c.reponer) ? 'full' : 'takedown'));
  return { ok: true, campanas: res.length, detalle: res };
}

export async function POST(req) {
  const auth = await autorizado(req);
  if (!auth) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch { /* noop */ }
  try { return NextResponse.json(await correr(req, body)); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
export async function GET(req) {
  const auth = await autorizado(req);
  if (!auth) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr(req, {})); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
