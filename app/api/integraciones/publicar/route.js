import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { mapEasyBroker, pushEasyBroker } from '../../../../lib/integraciones';
import { resolverReglas, ordenar } from '../../../../lib/publicador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function superId(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof?.rol === 'super_admin' ? { uid, org_id: prof.org_id } : null;
}

export async function POST(req) {
  const su = await superId(req);
  if (!su) return NextResponse.json({ error: 'solo super-admin' }, { status: 401 });

  let b = {};
  try { b = await req.json(); } catch { /* noop */ }
  const portal = b.portal || 'easybroker';
  const status = b.status === 'published' ? 'published' : 'not_published';
  const limite = Math.min(Math.max(1, b.limite || 30), 100);
  const base = b.base || b.filtros || {};
  const reglas = b.reglas || null;
  const orden = b.orden || 'precio';

  const db = svc();
  const { data: devs } = await db.from('desarrollos').select('*');
  const byId = Object.fromEntries((devs || []).map(d => [d.sku, d]));
  const { data: unitsRaw } = await db.from('unidades').select('*').eq('estatus', 'Disponible');

  // Selección hipersegmentada por reglas + prioridad de slots por objetivo.
  let sel = resolverReglas(unitsRaw || [], byId, base, reglas);
  sel = ordenar(sel, byId, orden);
  let items = sel.map(u => ({ ref: u.sku, u })).slice(0, limite);

  // Mapa de publicaciones previas (para actualizar en vez de duplicar)
  const { data: prev } = await db.from('publicaciones').select('ref,external_id').eq('portal', portal);
  const prevMap = Object.fromEntries((prev || []).map(p => [p.ref, p.external_id]));

  // Medios por desarrollo (para imágenes)
  const { data: medios } = await db.from('media').select('dev_sku,url,tipo');
  const imgsDe = sku => (medios || []).filter(m => m.dev_sku === sku && /^https?:/.test(m.url || '')).map(m => m.url).slice(0, 10);

  let publicados = 0, errores = 0; const detalles = [];
  for (const it of items) {
    const u = it.u, d = byId[u.dev_sku];
    const precio = u.precio;
    const body = mapEasyBroker({
      ref: it.ref,
      title: `${d.nombre}${u.prototipo ? ' · ' + u.prototipo : ''}`,
      description: d.notas || `${d.nombre} en ${d.colonia}, ${d.alcaldia}. ${u.rec === 0 ? 'Loft' : u.rec + ' recámaras'}.`,
      propertyType: d.tipo || 'Departamento',
      status,
      price: precio,
      bedrooms: u.rec || 0, bathrooms: Math.floor(u.banos || 0), halfBaths: Math.round(((u.banos || 0) % 1) * 2) || 0,
      parking: u.n_estac || 0, construction: u.m2_total || u.m2_hab || null, lot: u.m2_total || null,
      locationName: [d.colonia, d.alcaldia, d.estado].filter(Boolean).join(', '),
      images: imgsDe(d.sku),
    });
    let res;
    if (portal === 'easybroker') res = await pushEasyBroker(body, prevMap[it.ref]);
    else res = { skipped: true, error: 'portal no soportado aún: ' + portal };

    const estatus = res.skipped ? 'error' : (res.ok ? (status === 'published' ? 'publicado' : 'borrador') : 'error');
    await db.from('publicaciones').upsert({
      org_id: su.org_id, portal, ref: it.ref, dev_sku: u.dev_sku,
      external_id: res.external_id || prevMap[it.ref] || null,
      estatus, error: res.error || (res.skipped ? 'proveedor no configurado' : null),
      meta: { rec: u.rec, prototipo: u.prototipo, precio }, actualizado: new Date().toISOString(),
    }, { onConflict: 'portal,ref' });
    if (res.ok) publicados++; else errores++;
    detalles.push({ ref: it.ref, ok: !!res.ok, estatus, error: res.error || null });
  }

  return NextResponse.json({ ok: true, intentos: items.length, publicados, errores, detalles: detalles.slice(0, 50) });
}
