// Contexto "ver como" del super-admin, persistido en localStorage.
// { org_id, org_nombre, rol, asesor_id, asesor_nombre } | null
const KEY = 'qc_viewas';

export function getViewAs() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

export function setViewAs(v) {
  if (typeof window === 'undefined') return;
  if (v) window.localStorage.setItem(KEY, JSON.stringify(v));
  else window.localStorage.removeItem(KEY);
}
