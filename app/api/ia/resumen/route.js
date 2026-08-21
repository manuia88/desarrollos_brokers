import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { llamarIA, resolverIA } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resumen del día en 3 frases (BYOK). El frontend ya muestra un resumen por reglas;
// esto lo "afina" con IA cuando el asesor tiene su llave conectada.
export async function POST(req) {
  const uid = await userFromToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const ia = await resolverIA(db, uid);
  if (!ia) return NextResponse.json({ disabled: true }, { status: 200 });

  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { citas = 0, calientes = 0, nuevos = 0, seguir = 0, prioridad = null, top = null } = body;

  const system = `Eres el jefe de ventas de un broker inmobiliario en México. Resume su día en MÁXIMO 3 frases, cálido, directo y accionable. Español de México, sin markdown ni listas. Di qué hacer primero y cierra motivando.`;
  const datos = [
    `Citas hoy: ${citas}.`,
    `Leads calientes: ${calientes}.`,
    `Nuevos por llamar: ${nuevos}.`,
    `En seguimiento: ${seguir}.`,
    prioridad ? `Prioridad ahora: ${String(prioridad).slice(0, 160)}.` : '',
    top ? `Lead más caliente: ${String(top).slice(0, 80)}.` : '',
  ].filter(Boolean).join(' ');

  try {
    const resumen = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [{ role: 'user', content: datos }], maxTokens: 220 });
    return NextResponse.json({ resumen });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'error de IA' }, { status: 200 });
  }
}
