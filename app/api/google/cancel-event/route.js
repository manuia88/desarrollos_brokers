import { NextResponse } from 'next/server';
import { svc, userFromToken, googleConfigured, deleteGoogleEvent } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Borra el evento de Google de una cita (cancelación). Solo el asesor/org dueña. Best-effort.
export async function POST(req) {
  try {
    if (!googleConfigured()) return NextResponse.json({ skipped: 'no-config' });
    const uid = await userFromToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
    const { cita_id } = await req.json();
    if (!cita_id) return NextResponse.json({ error: 'cita_id requerido' }, { status: 400 });
    const db = svc();
    const { data: cita } = await db.from('citas').select('id,org_id,asesor_id,google_event_id,google_event_host').eq('id', cita_id).maybeSingle();
    if (!cita) return NextResponse.json({ error: 'cita no encontrada' }, { status: 404 });
    const { data: prof } = await db.from('profiles').select('org_id,rol').eq('id', uid).maybeSingle();
    const owns = cita.asesor_id === uid || (prof?.org_id && cita.org_id === prof.org_id) || prof?.rol === 'super_admin';
    if (!owns) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
    if (cita.google_event_id && cita.google_event_host) {
      await deleteGoogleEvent(db, cita.google_event_host, cita.google_event_id);
      await db.from('citas').update({ google_event_id: null, google_event_host: null }).eq('id', cita.id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'no se pudo cancelar el evento' }, { status: 200 });
  }
}
