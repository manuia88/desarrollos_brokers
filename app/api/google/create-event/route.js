import { NextResponse } from 'next/server';
import { svc, googleConfigured, refreshAccess, citaDateTime } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Best-effort: crea el evento en el calendario del asesor si está conectado.
// Si Google no está configurado o el asesor no está conectado, no hace nada.
export async function POST(req) {
  try {
    if (!googleConfigured()) return NextResponse.json({ skipped: 'no-config' });
    const { cita_id } = await req.json();
    if (!cita_id) return NextResponse.json({ error: 'cita_id requerido' }, { status: 400 });

    const db = svc();
    const { data: cita } = await db.from('citas').select('*').eq('id', cita_id).maybeSingle();
    if (!cita) return NextResponse.json({ error: 'cita no encontrada' }, { status: 404 });

    const { data: tk } = await db.from('google_tokens').select('*').eq('user_id', cita.asesor_id).maybeSingle();
    if (!tk?.refresh_token) return NextResponse.json({ skipped: 'no-conectado' });

    const rt = await refreshAccess(tk.refresh_token);
    if (!rt.access_token) return NextResponse.json({ skipped: 'refresh-fail' });

    const { data: dev } = await db.from('desarrollos').select('nombre,direccion,colonia,alcaldia').eq('sku', cita.dev_sku).maybeSingle();
    const ev = {
      summary: `Cita — ${dev?.nombre || 'Desarrollo'}${cita.notas ? ' · ' + cita.notas : ''}`,
      description: `Cliente: ${cita.nombre || ''} · Tel ${cita.telefono || ''}${cita.email ? ' · ' + cita.email : ''}\nModalidad: ${cita.modalidad || ''}`,
      location: [dev?.direccion, dev?.colonia, dev?.alcaldia].filter(Boolean).join(', '),
      start: { dateTime: citaDateTime(cita.fecha, cita.hora), timeZone: 'America/Mexico_City' },
      end: { dateTime: citaDateTime(cita.fecha, cita.hora, 1), timeZone: 'America/Mexico_City' },
    };
    const cr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { Authorization: 'Bearer ' + rt.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    });
    const created = await cr.json();
    return NextResponse.json({ ok: !!created.id, id: created.id || null });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 200 });
  }
}
