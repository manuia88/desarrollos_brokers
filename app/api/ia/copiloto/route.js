import { tituloDev } from '../../../../lib/nombre';
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { llamarIA, resolverIA } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

export async function POST(req) {
  const auth = req.headers.get('authorization') || '';
  const uid = await userFromToken(auth.replace(/^Bearer\s+/i, ''));
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  // Llave de IA del broker (su conexión o la de su inmobiliaria).
  const ia = await resolverIA(db, uid);
  if (!ia) return NextResponse.json({ answer: 'El copiloto todavía no está activado. Conecta tu llave de IA en Conexiones (o pídele a tu inmobiliaria que conecte la suya).', disabled: true });

  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { pregunta, historial } = body;
  if (!pregunta) return NextResponse.json({ error: 'falta pregunta' }, { status: 400 });
  const { data: devs } = await db.from('desarrollos').select('sku,nombre,direccion,alcaldia,precio_min,precio_max,rec_min,rec_max,comision_broker,etapa,credito_ion,credito_hir,credito_bancario').eq('publicado', true);
  const { data: us } = await db.from('unidades').select('dev_sku').eq('estatus', 'Disponible');
  const byDev = {}; (us || []).forEach(u => { byDev[u.dev_sku] = (byDev[u.dev_sku] || 0) + 1; });
  const lineas = (devs || []).map(d => {
    const creds = [d.credito_ion && 'ION', d.credito_hir && 'HIR', d.credito_bancario && 'Bancario'].filter(Boolean).join('/');
    return `${tituloDev(d)} (${d.alcaldia}): ${MXN(d.precio_min)}–${MXN(d.precio_max)}, ${d.rec_min}–${d.rec_max} rec, ${byDev[d.sku] || 0} disp., comisión ${Math.round((d.comision_broker || 0) * 100)}%, ${d.etapa}${creds ? ', créditos ' + creds : ''}.`;
  }).join('\n');

  const system = `Eres el copiloto de un broker inmobiliario en México. Tienes el inventario EN VIVO de ${(devs || []).length} desarrollos. Ayuda al broker a encontrar rápido lo que le sirve a su cliente (por zona, presupuesto, recámaras, crédito, comisión, entrega). Responde SOLO con estos datos, breve y accionable, en español de México, sin markdown pesado. Recomienda 2-3 opciones concretas cuando aplique. Si nada encaja, dilo claro.

INVENTARIO:
${lineas}`;

  const previos = Array.isArray(historial) ? historial.filter(m => m && m.role && m.content).slice(-6) : [];
  try {
    const answer = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [...previos, { role: 'user', content: String(pregunta).slice(0, 700) }], maxTokens: 600 });
    return NextResponse.json({ answer });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'error de IA' }, { status: 200 });
  }
}
