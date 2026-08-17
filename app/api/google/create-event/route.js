import { NextResponse } from 'next/server';
import { svc, googleConfigured, citaDateTime, masterUserId, createGoogleEvent } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Crea la cita en el calendario MAESTRO (super-admin con Google conectado);
// si no hay maestro, en el del asesor. Invita al cliente y al broker, con
// recordatorios 12h y 2h antes. Best-effort.
export async function POST(req) {
  try {
    if (!googleConfigured()) return NextResponse.json({ skipped: 'no-config' });
    const { cita_id } = await req.json();
    if (!cita_id) return NextResponse.json({ error: 'cita_id requerido' }, { status: 400 });

    const db = svc();
    const { data: cita } = await db.from('citas').select('*').eq('id', cita_id).maybeSingle();
    if (!cita) return NextResponse.json({ error: 'cita no encontrada' }, { status: 404 });

    const master = await masterUserId(db);
    const host = master || cita.asesor_id;
    if (!host) return NextResponse.json({ skipped: 'sin-calendario' });

    const { data: ase } = await db.from('profiles').select('email,nombre,telefono').eq('id', cita.asesor_id).maybeSingle();
    const { data: dev } = await db.from('desarrollos').select('nombre,direccion,colonia,alcaldia').eq('sku', cita.dev_sku).maybeSingle();

    const attendees = [cita.email, ase?.email].filter(Boolean).map(e => ({ email: e }));
    const eventBody = {
      summary: `Cita — ${dev?.nombre || 'Desarrollo'}${cita.notas ? ' · ' + cita.notas : ''}`,
      description: `Cliente: ${cita.nombre || ''} · Tel ${cita.telefono || ''}${cita.email ? ' · ' + cita.email : ''}\nAsesor: ${ase?.nombre || ''} · ${ase?.telefono || ''}\nModalidad: ${cita.modalidad || ''}`,
      location: [dev?.direccion, dev?.colonia, dev?.alcaldia].filter(Boolean).join(', '),
      start: { dateTime: citaDateTime(cita.fecha, cita.hora), timeZone: 'America/Mexico_City' },
      end: { dateTime: citaDateTime(cita.fecha, cita.hora, 1), timeZone: 'America/Mexico_City' },
      attendees,
      reminders: { useDefault: false, overrides: [
        { method: 'email', minutes: 720 },   // 12 h antes
        { method: 'popup', minutes: 120 },    // 2 h antes
        { method: 'email', minutes: 120 },
      ] },
    };

    const eventId = await createGoogleEvent(db, host, eventBody);
    if (eventId) await db.from('citas').update({ google_event_id: eventId, google_event_host: host }).eq('id', cita.id);
    return NextResponse.json({ ok: !!eventId, master: !!master });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 200 });
  }
}
