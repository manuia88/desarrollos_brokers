import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { fitScore } from '../../../../lib/matching';
import { criteriosDeCard } from '../../../../lib/clientcards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MXN = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
const UMBRAL = 75; // % de match para considerar que "le queda"

async function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return true;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return false;
  const { data: prof } = await svc().from('profiles').select('rol').eq('id', uid).maybeSingle();
  return prof?.rol === 'super_admin';
}

// Reverse matching automático: cuando entra/cambia inventario, avisa al asesor
// dueño de cada tarjeta de cliente cuáles unidades NUEVAS le quedan.
async function correr() {
  const db = svc();
  const [{ data: cards }, { data: devs }, { data: units }] = await Promise.all([
    db.from('client_cards').select('*').eq('activo', true),
    db.from('desarrollos').select('*'),
    db.from('unidades').select('*').eq('estatus', 'Disponible'),
  ]);
  const byId = Object.fromEntries((devs || []).map(d => [d.sku, d]));
  let avisados = 0, seeded = 0;

  for (const c of (cards || [])) {
    const crit = criteriosDeCard(c);
    const matches = (units || [])
      .map(u => { const d = byId[u.dev_sku]; if (!d) return null; const f = fitScore(u, d, crit); return { u, d, score: f.score }; })
      .filter(Boolean).filter(m => m.score >= UMBRAL);
    const yaSet = new Set(c.notificados || []);

    if (!c.wl_seeded) {
      // Primer escaneo: marca lo actual como "ya visto" sin avisar (el asesor recién lo buscó).
      const skus = matches.map(m => m.u.sku);
      await db.from('client_cards').update({ notificados: skus, wl_seeded: true }).eq('id', c.id);
      seeded++; continue;
    }

    const nuevos = matches.filter(m => !yaSet.has(m.u.sku)).sort((a, b) => b.score - a.score);
    if (nuevos.length && c.asesor_id) {
      const top = nuevos[0];
      await db.from('notificaciones').insert({
        org_id: c.org_id, user_id: c.asesor_id, tipo: 'waitlist',
        titulo: `Nuevo inventario para ${c.nombre}`,
        cuerpo: `${nuevos.length} unidad(es) que le quedan: ${top.d.nombre} desde ${MXN(top.u.precio)} (${top.score}% match).`,
        link: '/clientes',
      });
      const merged = [...new Set([...(c.notificados || []), ...nuevos.map(m => m.u.sku)])];
      await db.from('client_cards').update({ notificados: merged }).eq('id', c.id);
      avisados++;
    }
  }
  return { ok: true, tarjetas: (cards || []).length, avisados, seeded };
}

export async function POST(req) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
export async function GET(req) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
