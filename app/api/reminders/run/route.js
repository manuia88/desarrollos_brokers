import { NextResponse } from 'next/server';
import { svc } from '../../../../lib/googleServer';
import { sendWhatsApp, sendEmail } from '../../../../lib/notificaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFSETS = [['12h', 12], ['2h', 2]];

// México = UTC-6 fijo (sin horario de verano desde 2023).
function citaUtc(fecha, hora) {
  const t = Date.parse(`${fecha}T${hora || '09:00'}:00-06:00`);
  return isNaN(t) ? null : t;
}
function horaMx() { return (new Date().getUTCHours() - 6 + 24) % 24; }

async function correr() {
  const h = horaMx();
  if (h < 8 || h >= 20) return { skipped: 'fuera-de-horario', horaMx: h };

  const db = svc();
  const hoy = Date.now();
  const inicio = new Date(hoy - 86400000).toISOString().slice(0, 10);
  const fin = new Date(hoy + 2 * 86400000).toISOString().slice(0, 10);
  const { data: citas } = await db.from('citas').select('*')
    .in('estatus', ['Solicitada', 'Confirmada']).gte('fecha', inicio).lte('fecha', fin);

  let enviados = 0;
  for (const c of (citas || [])) {
    const start = citaUtc(c.fecha, c.hora);
    if (!start || start <= hoy) continue;
    for (const [tipo, offH] of OFFSETS) {
      if (hoy < start - offH * 3600 * 1000) continue;          // aún no toca
      const { data: yaEnv } = await db.from('reminders_enviados').select('id').eq('cita_id', c.id).eq('tipo', tipo).maybeSingle();
      if (yaEnv) continue;

      const { data: ase } = await db.from('profiles').select('nombre,telefono,email').eq('id', c.asesor_id).maybeSingle();
      const { data: dev } = await db.from('desarrollos').select('nombre').eq('sku', c.dev_sku).maybeSingle();
      const cuando = new Date(start).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const devN = dev?.nombre || 'tu desarrollo';
      const msgCli = `Hola ${c.nombre || ''}, te recordamos tu cita para ${devN} el ${cuando}.${ase?.nombre ? ' Te atiende ' + ase.nombre + (ase.telefono ? ' (' + ase.telefono + ')' : '') + '.' : ''}`;
      const msgBrk = `Recordatorio: cita con ${c.nombre || 'cliente'}${c.telefono ? ' (' + c.telefono + ')' : ''} para ${devN} el ${cuando}.`;

      if (c.telefono) await sendWhatsApp(c.telefono, msgCli);
      if (c.email) await sendEmail(c.email, `Recordatorio de tu cita — ${devN}`, `<p>${msgCli}</p>`);
      if (ase?.telefono) await sendWhatsApp(ase.telefono, msgBrk);
      if (ase?.email) await sendEmail(ase.email, `Recordatorio de cita — ${devN}`, `<p>${msgBrk}</p>`);

      try { await db.from('reminders_enviados').insert({ cita_id: c.id, tipo, canal: 'whatsapp+email' }); } catch { /* carrera: ya enviado */ }
      enviados++;
    }
  }
  return { ok: true, enviados, horaMx: h };
}

function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no se configuró, se permite (recomendado configurarlo)
  return req.headers.get('x-cron-secret') === secret;
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
export async function GET(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); }
  catch (e) { return NextResponse.json({ error: String(e?.message || e) }, { status: 200 }); }
}
