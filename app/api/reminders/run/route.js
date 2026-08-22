import { tituloDev } from '../../../../lib/nombre';
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
      // Reclamar el token ANTES de enviar: el índice único (cita_id,tipo) serializa el envío.
      // Si otra ejecución concurrente ya lo insertó, este insert falla y no se envía doble.
      const { data: claim, error: claimErr } = await db.from('reminders_enviados')
        .insert({ cita_id: c.id, tipo, canal: 'whatsapp+email' }).select('id').maybeSingle();
      if (claimErr || !claim) continue;   // ya reclamado por otra corrida (o carrera perdida)

      const { data: ase } = await db.from('profiles').select('nombre,telefono,email').eq('id', c.asesor_id).maybeSingle();
      const { data: dev } = await db.from('desarrollos').select('nombre,direccion').eq('sku', c.dev_sku).maybeSingle();
      const cuando = new Date(start).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const devN = (dev ? tituloDev(dev) : null) || 'tu desarrollo';
      const msgCli = `Hola ${c.nombre || ''}, te recordamos tu cita para ${devN} el ${cuando}.${ase?.nombre ? ' Te atiende ' + ase.nombre + (ase.telefono ? ' (' + ase.telefono + ')' : '') + '.' : ''}`;
      const msgBrk = `Recordatorio: cita con ${c.nombre || 'cliente'}${c.telefono ? ' (' + c.telefono + ')' : ''} para ${devN} el ${cuando}.`;

      const res = [];
      if (c.telefono) res.push(await sendWhatsApp(c.telefono, msgCli));
      if (c.email) res.push(await sendEmail(c.email, `Recordatorio de tu cita — ${devN}`, `<p>${msgCli}</p>`));
      if (ase?.telefono) res.push(await sendWhatsApp(ase.telefono, msgBrk));
      if (ase?.email) res.push(await sendEmail(ase.email, `Recordatorio de cita — ${devN}`, `<p>${msgBrk}</p>`));
      // Si había a quién enviar pero TODO falló (proveedor caído), libera el reclamo para reintentar
      // en la próxima corrida en vez de perder el recordatorio para siempre.
      if (res.length > 0 && !res.some(Boolean)) {
        try { await db.from('reminders_enviados').delete().eq('id', claim.id); } catch { /* noop */ }
        continue;
      }
      enviados++;
    }
  }
  return { ok: true, enviados, horaMx: h };
}

function autorizado(req) {
  // Fail-closed: exige CRON_SECRET. Vercel Cron manda "Authorization: Bearer <CRON_SECRET>"
  // automáticamente cuando la variable está configurada. No se confía en x-vercel-cron solo.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return req.headers.get('x-cron-secret') === secret || auth === `Bearer ${secret}`;
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); }
  catch { return NextResponse.json({ error: 'error al ejecutar recordatorios' }, { status: 200 }); }
}
export async function GET(req) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try { return NextResponse.json(await correr()); }
  catch { return NextResponse.json({ error: 'error al ejecutar recordatorios' }, { status: 200 }); }
}
