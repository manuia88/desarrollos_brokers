'use client';
import { useState } from 'react';
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

export default function UnitDrawer({ dev, unidad: u, medios = [], asesorId = null, onClose, onCotizar, onRegistrar }) {
  const [copiado, setCopiado] = useState(false);
  const shareLink = (typeof window !== 'undefined' && asesorId) ? `${window.location.origin}/f/${dev.sku}?a=${asesorId}&u=${u.sku}` : '';
  const waShare = shareLink ? 'https://wa.me/?text=' + encodeURIComponent(`Te comparto el depa T${u.torre} ${u.num_depto} de ${dev.nombre}: ${shareLink}`) : '';
  function copiar() { if (navigator.clipboard && shareLink) { navigator.clipboard.writeText(shareLink); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } }
  const meses = mesesEntrega(dev.fecha_entrega);
  const medioDe = tipo => medios.find(x => x.tipo === tipo && (x.unidad_sku === u.sku || (x.prototipo && x.prototipo === u.prototipo)));
  const planoUrl = medioDe('plano')?.url || u.plano_url;
  const plantaUrl = medioDe('planta')?.url || u.planta_url;
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
          <h3>Superficies (m²)</h3>
          <div className="ud-grid">
            <div><span>Habitable</span><b>{num(u.m2_hab, ' m²')}</b></div>
            {u.balcon_m2 > 0 && <div><span>Balcón</span><b>{num(u.balcon_m2, ' m²')}</b></div>}
            {u.terraza_m2 > 0 && <div><span>Terraza</span><b>{num(u.terraza_m2, ' m²')}</b></div>}
            {u.roof_m2 > 0 && <div><span>Roof garden priv.</span><b>{num(u.roof_m2, ' m²')}</b></div>}
            {u.bodega_m2 > 0 && <div><span>Bodega</span><b>{num(u.bodega_m2, ' m²')}</b></div>}
            {u.m2_total > 0 && <div className="ud-total"><span>Total</span><b>{num(u.m2_total, ' m²')}</b></div>}
          </div>
        </div>

        <div className="dw-sec">
          <h3>Distribución y estacionamiento</h3>
          <div className="dw-kv"><span>Recámaras</span><b>{u.rec === 0 ? 'Loft' : (u.rec ?? '—')}</b></div>
          <div className="dw-kv"><span>Baños</span><b>{u.banos ?? '—'}</b></div>
          <div className="dw-kv"><span>Estacionamiento</span><b>{u.n_estac ? `${u.n_estac} cajón${u.n_estac === 1 ? '' : 'es'}` : '—'}{u.tipo_estac ? ` · ${u.tipo_estac}` : ''}</b></div>
          {u.tam_estac && <div className="dw-kv"><span>Tamaño de cajón</span><b>{u.tam_estac}</b></div>}
          {u.bodega_m2 > 0 && <div className="dw-kv"><span>Bodega</span><b>{num(u.bodega_m2, ' m²')}{u.sku_bodega ? ` · ${u.sku_bodega}` : ''}</b></div>}
          {u.elevautos && <details className="ud-elev"><summary>Detalle de elevautos</summary><p>{u.elevautos}</p></details>}
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
          {planoUrl ? <a href={planoUrl} target="_blank" rel="noopener"><img className="ud-img" src={planoUrl} alt="Plano" /></a> : <div className="ud-ph">Plano próximamente</div>}
        </div>
        <div className="dw-sec">
          <h3>Planta ambientada</h3>
          {plantaUrl ? <a href={plantaUrl} target="_blank" rel="noopener"><img className="ud-img" src={plantaUrl} alt="Planta ambientada" /></a> : <div className="ud-ph">Planta ambientada próximamente</div>}
        </div>

        <div className="cotiz-actions">
          <button className="btn mag block" onClick={() => onCotizar(u)}>Cotizar esta unidad</button>
          {shareLink && <button className="btn lim block" onClick={copiar}>{copiado ? '¡Link copiado!' : '🔗 Compartir esta unidad'}</button>}
          {waShare && <a className="btn ghost block" href={waShare} target="_blank" rel="noopener">Compartir por WhatsApp</a>}
          {onRegistrar && <button className="btn ghost block" onClick={() => onRegistrar(u)}>Registrar cliente por esta unidad</button>}
        </div>
        {shareLink && <p className="fnote" style={{ marginTop: '.5rem' }}>El link abre la ficha de <b>esta unidad</b> con tu marca; el cliente puede agendar cita directo.</p>}
      </aside>
    </>
  );
}
