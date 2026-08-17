'use client';
import { useMemo, useState } from 'react';
import { esquemaPago, resumenCredito, BANCOS } from '../lib/finance';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const soloDig = s => String(s ?? '').replace(/[^0-9]/g, '');
const money = s => { const d = soloDig(s); return d ? '$' + Number(d).toLocaleString('es-MX') : ''; };
function mesesEntrega(fecha) {
  if (!fecha) return 0;
  const h = new Date(), f = new Date(fecha + 'T12:00');
  return Math.max(0, (f.getFullYear() - h.getFullYear()) * 12 + f.getMonth() - h.getMonth());
}

// dev: registro de desarrollos. unidad: opcional (precio, torre, num_depto, prototipo).
export default function Cotizador({ dev, unidad, onClose }) {
  const precio = (unidad && unidad.precio) || dev.precio_min || 0;
  const meses = mesesEntrega(dev.fecha_entrega);

  const esq = useMemo(() => esquemaPago(precio, {
    enganchePct: dev.esq_enganche || 0,
    obraPct: dev.esq_mensualidades || 0,
    escrituraPct: dev.esq_escritura || 0,
    apartado: (unidad && unidad.apartado) || dev.apartado || 0,
    meses,
  }), [precio, dev, unidad, meses]);

  // --- Sección 2: crédito hipotecario ---
  const [banco, setBanco] = useState(BANCOS[3].nombre); // BBVA por defecto
  const [tasa, setTasa] = useState(BANCOS[3].tasa.toFixed(2));
  const [plazo, setPlazo] = useState(20);
  const [financiar, setFinanciar] = useState(String(Math.round(esq.saldoEscritura)));

  function cambiarBanco(nombre) {
    setBanco(nombre);
    const b = BANCOS.find(x => x.nombre === nombre);
    if (b) setTasa(b.tasa.toFixed(2));
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
    `Precio: ${MXN(precio)}\n\n` +
    `PLAN DEL DESARROLLADOR\n` +
    `· Apartado: ${MXN(esq.apartado)}\n` +
    `· Enganche (${Math.round((dev.esq_enganche || 0) * 100)}%): ${MXN(esq.enganche)}\n` +
    `· Mensualidades en obra: ${meses} x ${MXN(esq.mensualidadObra)}\n` +
    `· Saldo a escritura (${Math.round((dev.esq_escritura || 0) * 100)}%): ${MXN(esq.saldoEscritura)}\n\n` +
    `CRÉDITO HIPOTECARIO (${banco})\n` +
    `· Financiar: ${MXN(financiar)} a ${tasa}% / ${plazo} años\n` +
    `· Mensualidad estimada: ${MXN(cred.mensualidad)}`;

  function copiar() { if (navigator.clipboard) navigator.clipboard.writeText(resumenTxt); }
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

        <div className="cotiz-precio"><span>Precio de lista</span><b>{MXN(precio)}</b></div>

        {/* ── 1 · Plan del desarrollador ── */}
        <section className="cotiz-block">
          <div className="cotiz-blabel"><span className="cotiz-num">1</span> Plan del desarrollador</div>
          <div className="pay-row"><span>Apartado</span><b>{MXN(esq.apartado)}</b></div>
          <div className="pay-row"><span>Enganche <em>{Math.round((dev.esq_enganche || 0) * 100)}%</em></span><b>{MXN(esq.enganche)}</b></div>
          <div className="pay-row sub"><span>· resto tras apartado</span><b>{MXN(esq.engancheRestante)}</b></div>
          <div className="pay-row"><span>Mensualidades en obra <em>{meses ? meses + ' meses' : 'entrega inmediata'}</em></span><b>{MXN(esq.mensualidadObra)}{meses ? '/mes' : ''}</b></div>
          <div className="pay-row"><span>Escrituración <em>{Math.round((dev.esq_escritura || 0) * 100)}%</em></span><b>{MXN(esq.saldoEscritura)}</b></div>
          <div className="pay-total"><span>Suma</span><b>{MXN(esq.enganche + esq.montoObra + esq.saldoEscritura)}</b></div>
        </section>

        {/* ── 2 · Crédito hipotecario ── */}
        <section className="cotiz-block">
          <div className="cotiz-blabel"><span className="cotiz-num">2</span> Crédito hipotecario</div>
          <p className="cotiz-anchor">Sobre el <b>saldo a escritura</b> ({MXN(esq.saldoEscritura)}) — lo que normalmente se financia.</p>
          <div className="dw-field">
            <label>Banco / fondo</label>
            <select value={banco} onChange={e => cambiarBanco(e.target.value)}>
              {BANCOS.map(b => <option key={b.nombre} value={b.nombre}>{b.nombre} · {b.tasa.toFixed(2)}%</option>)}
            </select>
          </div>
          <div className="dw-row">
            <div className="dw-field"><label>Tasa anual %</label>
              <input type="number" step="0.01" value={tasa} onChange={e => setTasa(e.target.value)} /></div>
            <div className="dw-field"><label>Plazo (años)</label>
              <input type="number" step="1" value={plazo} onChange={e => setPlazo(e.target.value)} /></div>
          </div>
          <div className="dw-field"><label>Monto a financiar</label>
            <input type="text" inputMode="numeric" value={money(financiar)} onChange={e => setFinanciar(soloDig(e.target.value))} /></div>

          <div className="cotiz-result">
            <span>Mensualidad estimada</span>
            <b>{MXN(cred.mensualidad)}</b>
            <small>{cred.meses} pagos · total {MXN(cred.totalPagado)} · intereses {MXN(cred.intereses)}</small>
          </div>
          <p className="fnote">Tasas de referencia (Banxico/CONDUSEF), editables. Infonavit varía por salario. Cálculo referencial, no es oferta vinculante.</p>
        </section>

        <div className="cotiz-actions">
          <button className="btn lim block" onClick={copiar}>Copiar cotización</button>
          <a className="btn ghost block" href={waHref} target="_blank" rel="noopener">Compartir por WhatsApp</a>
        </div>
      </aside>
    </>
  );
}
