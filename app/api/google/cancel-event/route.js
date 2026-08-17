import { NextResponse } from 'next/server';
import { svc, googleConfigured, deleteGoogleEvent } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Borra el evento de Google de una cita (cancelación). Best-effort.
export async function POST(req) {
  try {
    if (!googleConfigured()) return NextResponse.json({ skipped: 'no-config' });
    const { cita_id } = await req.json();
    if (!cita_id) return NextResponse.json({ error: 'cita_id requerido' }, { status: 400 });
    const db = svc();
    const { data: cita } = await db.from('citas').select('id,google_event_id,google_event_host').eq('id', cita_id).maybeSingle();
    if (!cita) return NextResponse.json({ error: 'cita no encontrada' }, { status: 404 });
    if (cita.google_event_id && cita.google_event_host) {
      await deleteGoogleEvent(db, cita.google_event_host, cita.google_event_id);
      await db.from('citas').update({ google_event_id: null, google_event_host: null }).eq('id', cita.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 200 });
  }
}
