'use client';
import { useMemo, useState } from 'react';
import { esquemaPago, resumenCredito, TASAS_DEFAULT } from '../lib/finance';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
function mesesEntrega(fecha) {
  if (!fecha) return 0;
  const h = new Date(), f = new Date(fecha + 'T12:00');
  return Math.max(0, (f.getFullYear() - h.getFullYear()) * 12 + f.getMonth() - h.getMonth());
}

// dev: registro de desarrollos (esq_enganche, esq_mensualidades, esq_escritura, apartado, fecha_entrega, nombre)
// unidad: opcional (precio, torre, num_depto). Si no viene, usa dev.precio_min.
export default function Cotizador({ dev, unidad, onClose }) {
  const precio = (unidad && unidad.precio) || dev.precio_min || 0;
  const meses = mesesEntrega(dev.fecha_entrega);

  const esq = useMemo(() => esquemaPago(precio, {
    enganchePct: dev.esq_enganche || 0,
    obraPct: dev.esq_mensualidades || 0,
    escrituraPct: dev.esq_escritura || 0,
    apartado: dev.apartado || 0,
    meses,
  }), [precio, dev, meses]);

  const [tipo, setTipo] = useState('Bancario');
  const [tasa, setTasa] = useState((TASAS_DEFAULT.Bancario * 100).toFixed(2)); // en %
  const [plazo, setPlazo] = useState(20);
  const [financiar, setFinanciar] = useState(Math.round(esq.saldoEscritura));

  function cambiarTipo(t) {
    setTipo(t);
    setTasa((TASAS_DEFAULT[t] * 100).toFixed(2));
  }

  const cred = useMemo(
    () => resumenCredito(Number(financiar) || 0, (Number(tasa) || 0) / 100, Number(plazo) || 0),
    [financiar, tasa, plazo]
  );

  const titulo = unidad
    ? `${dev.nombre} · T${unidad.torre} ${unidad.num_depto}`
    : dev.nombre;

  const resumenTxt =
    `Cotización — ${titulo}\n` +
    `Precio: ${MXN(precio)}\n` +
    `Apartado: ${MXN(esq.apartado)}\n` +
    `Enganche (${Math.round((dev.esq_enganche || 0) * 100)}%): ${MXN(esq.enganche)}\n` +
    `Mensualidades en obra: ${meses} x ${MXN(esq.mensualidadObra)}\n` +
    `Saldo a escritura: ${MXN(esq.saldoEscritura)}\n` +
    `Crédito ${tipo} — financiar ${MXN(financiar)} a ${tasa}% / ${plazo} años\n` +
    `Mensualidad estimada: ${MXN(cred.mensualidad)}`;

  function copiar() {
    if (navigator.clipboard) navigator.clipboard.writeText(resumenTxt);
  }
  const waHref = 'https://wa.me/?text=' + encodeURIComponent(resumenTxt);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div>
            <span className="dw-tag">Cotizador</span>
            <h2>{titulo}</h2>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="cotiz-precio">
          <span>Precio de lista</span><b>{MXN(precio)}</b>
        </div>

        <div className="dw-sec">
          <h3>Plan de pago</h3>
          <div className="dw-kv"><span>Apartado</span><b>{MXN(esq.apartado)}</b></div>
          <div className="dw-kv"><span>Enganche ({Math.round((dev.esq_enganche || 0) * 100)}%)</span><b>{MXN(esq.enganche)}</b></div>
          <div className="dw-kv" style={{ paddingLeft: '.8rem' }}><span>· resto del enganche</span><b>{MXN(esq.engancheRestante)}</b></div>
          <div className="dw-kv"><span>Mensualidades en obra{meses ? ` (${meses})` : ''}</span><b>{MXN(esq.mensualidadObra)}{meses ? '/mes' : ''}</b></div>
          <div className="dw-kv"><span>Saldo a la escritura ({Math.round((dev.esq_escritura || 0) * 100)}%)</span><b>{MXN(esq.saldoEscritura)}</b></div>
        </div>

        <div className="dw-sec">
          <h3>Crédito hipotecario (simulación)</h3>
          <div className="cotiz-tipos">
            {['Infonavit', 'FOVISSSTE', 'Bancario'].map(t => (
              <span key={t} className={'st' + (tipo === t ? ' on' : '')} onClick={() => cambiarTipo(t)}>{t}</span>
            ))}
          </div>
          <div className="dw-row">
            <div className="dw-field"><label>Tasa anual %</label>
              <input type="number" step="0.01" value={tasa} onChange={e => setTasa(e.target.value)} /></div>
            <div className="dw-field"><label>Plazo (años)</label>
              <input type="number" step="1" value={plazo} onChange={e => setPlazo(e.target.value)} /></div>
          </div>
          <div className="dw-field"><label>Monto a financiar</label>
            <input type="number" step="1000" value={financiar} onChange={e => setFinanciar(e.target.value)} /></div>

          <div className="cotiz-result">
            <span>Mensualidad estimada</span>
            <b>{MXN(cred.mensualidad)}</b>
            <small>{cred.meses} pagos · total {MXN(cred.totalPagado)} · intereses {MXN(cred.intereses)}</small>
          </div>
          <p className="fnote">Simulación aproximada con amortización fija. La tasa de Infonavit varía según tu salario; ajústala arriba.</p>
        </div>

        <div className="cotiz-actions">
          <button className="btn lim block" onClick={copiar}>Copiar cotización</button>
          <a className="btn ghost block" href={waHref} target="_blank" rel="noopener">Compartir por WhatsApp</a>
        </div>
      </aside>
    </>
  );
}
