'use client';
import { esquemaPago } from '../lib/finance';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const num = (v, suf = '') => (v == null || v === '') ? '—' : (Math.round(v * 100) / 100) + suf;

function mesesEntrega(fecha) {
  if (!fecha) return 0;
  const h = new Date(), f = new Date(fecha + 'T12:00');
  return Math.max(0, (f.getFullYear() - h.getFullYear()) * 12 + f.getMonth() - h.getMonth());
}

const ESTADO = {
  disponible: { l: 'Disponible', c: '#C6FF3A', bg: 'rgba(198,255,58,.14)' },
  apartado:   { l: 'Apartado',   c: '#ffcf7a', bg: 'rgba(255,180,40,.14)' },
  reservado:  { l: 'Reservado',  c: '#8fbcff', bg: 'rgba(60,130,255,.14)' },
  vendido:    { l: 'Vendido',    c: '#ff8fa3', bg: 'rgba(255,80,110,.14)' },
};

export default function UnitDrawer({ dev, unidad: u, onClose, onCotizar, onRegistrar }) {
  const meses = mesesEntrega(dev.fecha_entrega);
  const esq = esquemaPago(u.precio || 0, {
    enganchePct: dev.esq_enganche || 0,
    obraPct: dev.esq_mensualidades || 0,
    escrituraPct: dev.esq_escritura || 0,
    apartado: u.apartado || dev.apartado || 0,
    meses,
  });
  const est = ESTADO[(u.estatus || 'disponible').toLowerCase()] || ESTADO.disponible;
  const pm2 = u.precio && u.m2_hab ? Math.round(u.precio / u.m2_hab) : null;

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div>
            <span className="ud-estado" style={{ color: est.c, background: est.bg }}>{est.l}</span>
            <h2>T{u.torre} · {u.num_depto}</h2>
            <div className="ud-sub">{u.prototipo || 'Prototipo —'} · Nivel {u.nivel || '—'}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="cotiz-precio">
          <span>Precio</span>
          <div style={{ textAlign: 'right' }}>
            <b>{MXN(u.precio)}</b>
            {pm2 && <div className="ud-pm2">${pm2.toLocaleString('es-MX')}/m²</div>}
          </div>
        </div>

        <div className="dw-sec">
          <h3>Superficies</h3>
          <div className="ud-grid">
            <div><span>Habitable</span><b>{num(u.m2_hab, ' m²')}</b></div>
            <div><span>Balcón</span><b>{num(u.balcon_m2, ' m²')}</b></div>
            <div><span>Terraza</span><b>{num(u.terraza_m2, ' m²')}</b></div>
            <div><span>Roof garden</span><b>{num(u.roof_m2, ' m²')}</b></div>
            <div><span>Bodega</span><b>{num(u.bodega_m2, ' m²')}</b></div>
            <div><span>Total</span><b>{num(u.m2_total, ' m²')}</b></div>
          </div>
        </div>

        <div className="dw-sec">
          <h3>Distribución</h3>
          <div className="dw-kv"><span>Recámaras</span><b>{u.rec === 0 ? 'Loft' : (u.rec ?? '—')}</b></div>
          <div className="dw-kv"><span>Baños</span><b>{u.banos ?? '—'}</b></div>
          <div className="dw-kv"><span>Estacionamientos</span><b>{u.n_estac ?? '—'}</b></div>
          <div className="dw-kv"><span>Tipo de estacionamiento</span><b>{u.tipo_estac || '—'}{u.tam_estac ? ' · ' + u.tam_estac : ''}</b></div>
          {u.elevautos && <div className="dw-kv"><span>Elevautos</span><b>{u.elevautos}</b></div>}
          {u.descripcion && <p className="fnote" style={{ marginTop: '.6rem' }}>{u.descripcion}</p>}
        </div>

        <div className="dw-sec">
          <h3>Plan de pago de esta unidad</h3>
          <div className="dw-kv"><span>Apartado</span><b>{MXN(esq.apartado)}</b></div>
          <div className="dw-kv"><span>Enganche ({Math.round((dev.esq_enganche || 0) * 100)}%)</span><b>{MXN(esq.enganche)}</b></div>
          <div className="dw-kv"><span>Mensualidades en obra{meses ? ` (${meses})` : ''}</span><b>{MXN(esq.mensualidadObra)}{meses ? '/mes' : ''}</b></div>
          <div className="dw-kv"><span>Escrituración ({Math.round((dev.esq_escritura || 0) * 100)}%)</span><b>{MXN(esq.saldoEscritura)}</b></div>
        </div>

        <div className="dw-sec">
          <h3>Plano</h3>
          {u.plano_url ? <img className="ud-img" src={u.plano_url} alt="Plano" /> : <div className="ud-ph">Plano próximamente</div>}
        </div>
        <div className="dw-sec">
          <h3>Planta ambientada</h3>
          {u.planta_url ? <img className="ud-img" src={u.planta_url} alt="Planta ambientada" /> : <div className="ud-ph">Planta ambientada próximamente</div>}
        </div>

        <div className="cotiz-actions">
          <button className="btn mag block" onClick={() => onCotizar(u)}>Cotizar esta unidad</button>
          {onRegistrar && <button className="btn ghost block" onClick={() => onRegistrar(u)}>Registrar cliente por esta unidad</button>}
        </div>
      </aside>
    </>
  );
}
