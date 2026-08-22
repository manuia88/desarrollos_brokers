// Chat de prueba del panel: mismo cerebro, cero efectos (soloLectura) y cero canales.
// Sirve para que el broker pruebe a su asistente ANTES de soltarlo con clientes.
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { resolverIA } from '../../../../lib/ia';
import { responderAgente } from '../../../../lib/agente';
import { rateLimit } from '../../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token);
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  if (!rateLimit('agente-prueba:' + uid, 15, 60 * 1000)) return NextResponse.json({ answer: 'Vas muy rápido 🙂 espera un momento.' });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  if (!b.texto?.trim()) return NextResponse.json({ error: 'falta texto' }, { status: 400 });

  const db = svc();
  const { data: prof } = await db.from('profiles').select('org_id').eq('id', uid).maybeSingle();
  const { data: org } = prof?.org_id ? await db.from('orgs').select('nombre').eq('id', prof.org_id).maybeSingle() : { data: null };
  const ia = await resolverIA(db, uid);   // cascada: broker -> org -> plataforma (es interno)
  if (!ia) return NextResponse.json({ answer: 'Conecta tu llave de IA en Conexiones para probar al asistente.', disabled: true });

  const historial = Array.isArray(b.historial) ? b.historial.filter(m => m?.role && typeof m.content === 'string').slice(-8) : [];
  try {
    const r = await responderAgente({
      db, ia, orgId: prof?.org_id, nombreOrg: org?.nombre, canal: 'web', contacto: 'prueba:' + uid,
      texto: b.texto, historial, lead: null, asesorId: uid, soloLectura: true,
    });
    return NextResponse.json({ answer: r.texto, herramientas: r.usadas, handoff: r.handoff });
  } catch {
    return NextResponse.json({ answer: 'No pude responder (¿la llave de IA es válida?).' });
  }
}
