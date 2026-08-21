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

// "Mis inmobiliarias": accesos rápidos que el super fija para saltar entre las orgs que administra.
const PKEY = 'qc_pins';   // [{ org_id, org_nombre }]

export function getPins() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(PKEY) || '[]'); }
  catch { return []; }
}

export function isPinned(org_id) {
  return getPins().some(p => p.org_id === org_id);
}

// Fija/quita una org de los accesos rápidos. Devuelve la lista resultante.
export function togglePin(org) {
  const a = getPins();
  const i = a.findIndex(p => p.org_id === org.org_id);
  if (i >= 0) a.splice(i, 1); else a.push({ org_id: org.org_id, org_nombre: org.org_nombre });
  if (typeof window !== 'undefined') { try { window.localStorage.setItem(PKEY, JSON.stringify(a)); } catch { /* noop */ } }
  return a;
}
