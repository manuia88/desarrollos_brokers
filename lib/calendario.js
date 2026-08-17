'use client';
// Enlaces de calendario sin integración OAuth: "Agregar a Google Calendar" y .ics.

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

export function descargarIcs({ titulo, fecha, hora, detalles, ubicacion }) {
  if (!fecha) return;
  const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quiero Casa//Cita//ES', 'BEGIN:VEVENT',
    `DTSTART:${stamp(fecha, hora)}`, `DTEND:${stamp(fecha, hora, 1)}`,
    `SUMMARY:${esc(titulo)}`, `DESCRIPTION:${esc(detalles)}`, `LOCATION:${esc(ubicacion)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(titulo || 'cita').replace(/[^a-zA-Z0-9]+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
