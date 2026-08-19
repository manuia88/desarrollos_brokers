import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { rateLimit, clientIp } from '../../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ocupación del asesor para el widget de agenda de la ficha pública.
// Ya no se expone la RPC directa a anon: se sirve por aquí, gateado por
// desarrollo publicado + rate-limit (evita enumeración/spam por UUID).
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { /* noop */ }
  const { sku, asesor } = b;
  if (!sku || !asesor) return NextResponse.json({ ocupados: [] });

  if (!rateLimit('horarios:' + clientIp(req), 20, 60 * 1000) || !rateLimit('horarios-ase:' + asesor, 40, 60 * 1000)) {
    return NextResponse.json({ ocupados: [] });
  }

  let db;
  try { db = svc(); } catch { return NextResponse.json({ ocupados: [] }); }

  // Solo en el contexto de una ficha pública válida (desarrollo publicado).
  const { data: dev } = await db.from('desarrollos').select('sku').eq('sku', sku).eq('publicado', true).maybeSingle();
  if (!dev) return NextResponse.json({ ocupados: [] });

  const { data } = await db.rpc('horarios_asesor', { p_asesor: asesor });
  return NextResponse.json({ ocupados: data || [] });
}
