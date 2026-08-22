import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { fitScore } from '../../../../lib/matching';
import { criteriosDeCard } from '../../../../lib/clientcards';
import { sendWhatsApp, sendEmail } from '../../../../lib/notificaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MXN = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
const UMBRAL = 75; // % de match para considerar que "le queda"

// Decide el alcance del escaneo:
//  - cron secret o super_admin  -> todas las tarjetas
//  - usuario normal autenticado -> sólo SUS tarjetas (asesor_id = uid)
//  - nadie                      -> null (no autorizado)
async function alcance(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return { all: true };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol').eq('id', uid).maybeSingle();
  if (prof?.rol === 'super_admin') return { all: true };
  return { uid };
}

// Reverse matching: cuando entra/cambia inventario, avisa al asesor dueño de cada
// tarjeta qué unidades NUEVAS le quedan. Entrega in-app siempre; WhatsApp/correo
// según el opt-in de la tarjeta (alertas + alertas_canal).
async function correr(scope) {
  const db = svc();
  let cardsQ = db.from('client_cards').select('*').eq('activo', true);
  if (scope?.uid) cardsQ = cardsQ.eq('asesor_id', scope.uid);
  const [{ data: cards }, { data: devs }, { data: units }] = await Promise.all([
    cardsQ,
    db.from('desarrollos').select('*'),
    db.from('unidades').select('*').eq('estatus', 'Disponible'),
  ]);
  const byId = Object.fromEntries((devs || []).map(d => [d.sku, d]));

  // Contactos de los asesores involucrados (para WhatsApp / correo).
  const asesorIds = [...new Set((cards || []).map(c => c.asesor_id).filter(Boolean))];
  let contactos = {};
  if (asesorIds.length) {
    const { data: profs } = await db.from('profiles').select('id,nombre,telefono,email').in('id', asesorIds);
    contactos = Object.fromEntries((profs || []).map(p => [p.id, p]));
  }

  let avisados = 0, seeded = 0, whatsapp = 0, correos = 0;

  for (const c of (cards || [])) {
    const crit = criteriosDeCard(c);
    const matches = (units || [])
      .map(u => { const d = byId[u.dev_sku]; if (!d) return null; const f = fitScore(u, d, crit); return { u, d, score: f.score }; })
      .filter(Boolean).filter(m => m.score >= UMBRAL);
    const yaSet = new Set(c.notificados || []);

    if (!c.wl_seeded) {
      // Primer escaneo: marca lo actual como "ya visto" sin avisar (recién lo buscó).
      const skus = matches.map(m => m.u.sku);
      await db.from('client_cards').update({ notificados: skus, wl_seeded: true }).eq('id', c.id);
      seeded++; continue;
    }

    const nuevos = matches.filter(m => !yaSet.has(m.u.sku)).sort((a, b) => b.score - a.score);
    if (nuevos.length && c.asesor_id) {
      const top = nuevos[0];
      const resumen = `${nuevos.length} unidad(es) que le quedan: ${top.d.nombre} desde ${MXN(top.u.precio)} (${top.score}% match).`;
      // 1) In-app (siempre).
      await db.from('notificaciones').insert({
        org_id: c.org_id, user_id: c.asesor_id, tipo: 'waitlist',
        titulo: `Nuevo inventario para ${c.nombre}`, cuerpo: resumen, link: '/clientes',
      });
      // 2) WhatsApp / correo al asesor según opt-in.
      if (c.alertas && c.alertas_canal && c.alertas_canal !== 'app') {
        const ase = contactos[c.asesor_id] || {};
        if (c.alertas_canal === 'whatsapp' && ase.telefono) {
          const ok = await sendWhatsApp(ase.telefono, `🔔 Nuevo inventario para ${c.nombre}: ${resumen} Míralo en tu portal → /clientes`);
          if (ok) whatsapp++;
        } else if (c.alertas_canal === 'email' && ase.email) {
          const ok = await sendEmail(ase.email, `Nuevo inventario para ${c.nombre}`,
            `<p>Hola ${ase.nombre || ''},</p><p>Entró inventario que le queda a <b>${c.nombre}</b>:</p><p>${resumen}</p><p>Revísalo en tu portal, sección <b>Clientes</b>.</p>`);
          if (ok) correos++;
        }
      }
      const merged = [...new Set([...(c.notificados || []), ...nuevos.map(m => m.u.sku)])];
      await db.from('client_cards').update({ notificados: merged }).eq('id', c.id);
      avisados++;
    }
  }
  return { ok: true, tarjetas: (cards || []).length, avisados, seeded, whatsapp, correos };
}

export async function POST(req) {
  const scope = await alcance(req);
  if (!scope) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr(scope)); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
export async function GET(req) {
  const scope = await alcance(req);
  if (!scope) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr(scope)); } catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
