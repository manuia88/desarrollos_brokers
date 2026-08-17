import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { mapEasyBroker, pushEasyBroker, elegirConexionEB } from '../../../../lib/integraciones';
import { resolverReglas, ordenar } from '../../../../lib/publicador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VENDE = ['super_admin', 'director', 'gerente', 'asesor', 'independiente'];
async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof && VENDE.includes(prof.rol) ? { uid, ...prof } : null;
}

export async function POST(req) {
  const p = await quien(req);
  if (!p) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  let b = {};
  try { b = await req.json(); } catch { /* noop */ }
  const portal = b.portal || 'easybroker';
  const status = b.status === 'published' ? 'published' : 'not_published';
  const limite = Math.min(Math.max(1, b.limite || 30), 100);
  const base = b.base || b.filtros || {};
  const reglas = b.reglas || null;
  const orden = b.orden || 'precio';

  const db = svc();

  // Resolver la credencial EB de quien publica (su cuenta o la de su inmobiliaria).
  let cfg = null, cuenta = 'dev';
  if (portal === 'easybroker' && p.org_id) {
    const { data: org } = await db.from('orgs').select('eb_modo').eq('id', p.org_id).maybeSingle();
    const { data: conns } = await db.from('conexiones').select('*').eq('org_id', p.org_id);
    const sel = elegirConexionEB(conns, { org_id: p.org_id, asesor_id: p.uid, eb_modo: org?.eb_modo });
    if (sel) { cfg = { key: sel.key, ambiente: sel.ambiente }; cuenta = (org?.eb_modo === 'asesor') ? 'asesor:' + p.uid : 'org:' + p.org_id; }
  }

  const { data: devs } = await db.from('desarrollos').select('*');
  const byId = Object.fromEntries((devs || []).map(d => [d.sku, d]));
  const { data: unitsRaw } = await db.from('unidades').select('*').eq('estatus', 'Disponible');

  // CONVENIO: solo inventario que el desarrollador autorizó exportar a EB.
  const autorizadas = (unitsRaw || []).filter(u => byId[u.dev_sku]?.permite_eb);
  if (!autorizadas.length) return NextResponse.json({ error: 'Ningún desarrollo tiene autorizada la exportación a EasyBroker. El desarrollador lo habilita en Captura.' }, { status: 200 });

  // Selección hipersegmentada por reglas + prioridad de slots por objetivo.
  let sel = resolverReglas(autorizadas, byId, base, reglas);
  sel = ordenar(sel, byId, orden);
  let items = sel.map(u => ({ ref: u.sku, u })).slice(0, limite);

  // Mapa de publicaciones previas de ESTA cuenta (para actualizar en vez de duplicar)
  const { data: prev } = await db.from('publicaciones').select('ref,external_id').eq('portal', portal).eq('cuenta', cuenta);
  const prevMap = Object.fromEntries((prev || []).map(x => [x.ref, x.external_id]));

  // Medios por desarrollo (para imágenes)
  const { data: medios } = await db.from('media').select('dev_sku,url,tipo');
  const imgsDe = sku => (medios || []).filter(m => m.dev_sku === sku && /^https?:/.test(m.url || '')).map(m => m.url).slice(0, 10);

  let publicados = 0, errores = 0; const detalles = [];
  for (const it of items) {
    const u = it.u, d = byId[u.dev_sku];
    const precio = u.precio;
    // Publicado visible en portales solo si el dev lo autorizó; si no, entra como borrador.
    const stItem = (status === 'published' && d.permite_portales) ? 'published' : 'not_published';
    const body = mapEasyBroker({
      ref: it.ref,
      title: `${d.nombre}${u.prototipo ? ' · ' + u.prototipo : ''}`,
      description: d.notas || `${d.nombre} en ${d.colonia}, ${d.alcaldia}. ${u.rec === 0 ? 'Loft' : u.rec + ' recámaras'}.`,
      propertyType: d.tipo || 'Departamento',
      status: stItem,
      price: precio,
      bedrooms: u.rec || 0, bathrooms: Math.floor(u.banos || 0), halfBaths: Math.round(((u.banos || 0) % 1) * 2) || 0,
      parking: u.n_estac || 0, construction: u.m2_total || u.m2_hab || null, lot: u.m2_total || null,
      locationName: [d.colonia, d.alcaldia, d.estado].filter(Boolean).join(', '),
      images: imgsDe(d.sku),
    });
    let res;
    if (portal === 'easybroker') res = await pushEasyBroker(body, prevMap[it.ref], cfg);
    else res = { skipped: true, error: 'portal no soportado aún: ' + portal };

    const estatus = res.skipped ? 'pendiente' : (res.ok ? (stItem === 'published' ? 'publicado' : 'borrador') : 'error');
    await db.from('publicaciones').upsert({
      org_id: p.org_id, portal, ref: it.ref, dev_sku: u.dev_sku, cuenta,
      external_id: res.external_id || prevMap[it.ref] || null,
      estatus, error: res.error || (res.skipped ? 'sin conexión (conecta tu cuenta EB)' : null),
      meta: { rec: u.rec, prototipo: u.prototipo, precio }, actualizado: new Date().toISOString(),
    }, { onConflict: 'portal,ref,cuenta' });
    if (res.ok) publicados++; else errores++;
    detalles.push({ ref: it.ref, ok: !!res.ok, estatus, error: res.error || null });
  }

  return NextResponse.json({ ok: true, intentos: items.length, publicados, errores, detalles: detalles.slice(0, 50) });
}
