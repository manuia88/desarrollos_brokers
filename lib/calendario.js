'use client';
// Enlaces de calendario sin integración OAuth: "Agregar a Google Calendar" y .ics.
import { supabase } from './supabase';

// Adjunta el token de sesión si hay una (el broker autenticado); en la ficha
// pública no hay sesión y se manda sin token (el endpoint valida por otra vía).
async function authHeaders() {
  try { const { data } = await supabase.auth.getSession(); const t = data?.session?.access_token; return t ? { Authorization: 'Bearer ' + t } : {}; }
  catch { return {}; }
}

function stamp(fecha, hora, addH = 0) {
  // fecha 'YYYY-MM-DD', hora 'HH:MM' -> 'YYYYMMDDTHHMMSS' (hora local flotante)
  const [Y, M, D] = (fecha || '').split('-');
  let [h, mi] = (hora || '09:00').split(':');
  h = String((parseInt(h || '9', 10) + addH) % 24).padStart(2, '0');
  mi = (mi || '00').padStart(2, '0');
  return `${Y}${M}${D}T${h}${mi}00`;
}

export function googleCalUrl({ titulo, fecha, hora, detalles, ubicacion }) {
  if (!fecha) return null;
  const dates = `${stamp(fecha, hora)}/${stamp(fecha, hora, 1)}`;
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: titulo || 'Cita', dates,
    details: detalles || '', location: ubicacion || '',
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

// Dispara (best-effort) la creación del evento en el calendario maestro/asesor.
export async function crearEventoGoogle(cita_id) {
  if (!cita_id) return;
  try {
    await fetch('/api/google/create-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ cita_id }),
    });
  } catch { /* si Google no está configurado, no pasa nada */ }
}

// Borra el evento de Google al cancelar la cita (best-effort).
export async function cancelarEventoGoogle(cita_id) {
  if (!cita_id) return;
  try {
    await fetch('/api/google/cancel-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ cita_id }),
    });
  } catch { /* no-op */ }
}

// Construye el link de Cal.com del asesor con datos prellenados.
export function calcomUrl(base, { nombre, email, notas } = {}) {
  if (!base) return null;
  let url = base.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^cal\.com\//i, 'cal.com/').replace(/^\//, '');
  try {
    const u = new URL(url);
    if (nombre) u.searchParams.set('name', nombre);
    if (email) u.searchParams.set('email', email);
    if (notas) u.searchParams.set('notes', notas);
    return u.toString();
  } catch { return url; }
}

export function descargarIcs({ titulo, fecha, hora, detalles, ubicacion }) {
  if (!fecha) return;
  const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DesarrollosMX//Cita//ES', 'BEGIN:VEVENT',
    `DTSTART:${stamp(fecha, hora)}`, `DTEND:${stamp(fecha, hora, 1)}`,
    `SUMMARY:${esc(titulo)}`, `DESCRIPTION:${esc(detalles)}`, `LOCATION:${esc(ubicacion)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de cita (12 h)', 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de cita (2 h)', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(titulo || 'cita').replace(/[^a-zA-Z0-9]+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
