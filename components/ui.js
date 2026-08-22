'use client';
// Semilla del design system: helpers y primitivas reutilizables.
// Todo módulo nuevo se arma con estas piezas para que se sienta un solo producto.

export const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

export function meses(f) {
  if (!f) return null;
  const h = new Date(), x = new Date(f + 'T12:00');
  return Math.max(0, (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth());
}

export function Chip({ on, onClick, children }) {
  return <span className={'chip' + (on ? ' on' : '')} onClick={onClick}>{children}</span>;
}

export function Kpi({ value, label, accent }) {
  return <div className={'mtile' + (accent ? ' acc' : '')}><b>{value}</b><span>{label}</span></div>;
}

export function EmptyState({ icon, title, children }) {
  return (
    <div className="empty">
      <div className="empty-ic">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

// Aviso de fallo de carga: los datos de Supabase llegaron con error (red caída, etc.).
// Uso: const [errCarga, setErrCarga] = useState(false) ... {errCarga && <ErrorCarga />}
export function ErrorCarga() {
  return (
    <div className="err-carga" role="alert">
      ⚠️ No se pudo cargar parte de la información. Revisa tu conexión e
      <button onClick={() => window.location.reload()}>reintenta</button>.
    </div>
  );
}
