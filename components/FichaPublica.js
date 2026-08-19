'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleCalUrl, descargarIcs, crearEventoGoogle, calcomUrl } from '../lib/calendario';
import { etiquetaMedio } from '../lib/medios';
import { mensualidadCredito, TASAS_DEFAULT } from '../lib/finance';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const soloDig = s => String(s ?? '').replace(/[^0-9]/g, '');
const m2 = v => (v == null || v === '') ? '—' : (Math.round(v * 10) / 10);
function meses(f) { if (!f) return null; const h = new Date(), x = new Date(f + 'T12:00'); return Math.max(0, (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth()); }
const IMG = ['portada', 'render', 'foto', 'amenidad', 'planta', 'plano'];

// Agrupa por NÚMERO DE RECÁMARAS (una tarjeta por 1/2/3 rec) con "desde".
// Evita la lista infinita de prototipos y no expone la lista de precios interna.
function agruparPorRec(units) {
  const g = {};
  units.forEach(u => { const k = (u.rec ?? 0); (g[k] = g[k] || []).push(u); });
  return Object.entries(g).map(([rec, us]) => {
    const s = us.slice().sort((a, b) => (a.precio || 0) - (b.precio || 0))[0];
    return {
      rec: Number(rec), proto: s.prototipo,
      desde: Math.min(...us.map(u => u.precio || Infinity)),
      m2Desde: Math.min(...us.map(u => u.m2_hab || Infinity)),
      banos: s.banos, n_estac: s.n_estac, n: us.length,
    };
  }).sort((a, b) => a.rec - b.rec);
}
const tituloRec = r => r === 0 ? 'Loft' : `${r} recámara${r === 1 ? '' : 's'}`;

// Esquema de pago BASE para la ficha del cliente (se ajustará por desarrollo después).
const ESQUEMA_BASE = { firma: 0.15, obra: 0.10, escritura: 0.75 };

function amenIcon(a) {
  const s = (a || '').toLowerCase();
  if (/alberca|piscina/.test(s)) return '🏊';
  if (/gim|gym|fitness/.test(s)) return '🏋️';
  if (/roof|sky|terraza/.test(s)) return '🌇';
  if (/cowork|business|oficina/.test(s)) return '💻';
  if (/cctv|circuito|cámara|camara|vigil/.test(s)) return '📹';
  if (/segur|acceso|control/.test(s)) return '🛡️';
  if (/elevad|ascensor|salvaescal/.test(s)) return '🛗';
  if (/ludot|juego|niñ|kids|infantil/.test(s)) return '🧸';
  if (/mascota|pet/.test(s)) return '🐾';
  if (/salón|salon|usos|eventos|fiesta|lounge/.test(s)) return '🎉';
  if (/bici|bike/.test(s)) return '🚲';
  if (/verde|jard|picnic|zen/.test(s)) return '🌳';
  if (/asador|bbq|parrilla|grill/.test(s)) return '🔥';
  if (/lobby|recep/.test(s)) return '🛋️';
  if (/lavand/.test(s)) return '🧺';
  if (/spa|sauna|vapor|yoga/.test(s)) return '🧖';
  if (/cine|teatro/.test(s)) return '🎬';
  if (/agua|espejo|fuente/.test(s)) return '⛲';
  if (/coment|comerci|tienda/.test(s)) return '🛍️';
  if (/estacion|visita|cajón|cajon/.test(s)) return '🅿️';
  return '✨';
}

export default function FichaPublica({ sku, asesor, unidad, cliente }) {
  const [data, setData] = useState(undefined);
  const [foto, setFoto] = useState(null);
  const [modo, setModo] = useState('cita'); // 'cita' | 'contacto'
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', mensaje: '', fecha: '', hora: '', modalidad: 'Presencial', consent: false });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  // Cotizador del cliente
  const [cotRec, setCotRec] = useState(null);    // recámaras elegidas para cotizar
  const [cotPlazo, setCotPlazo] = useState(20);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.rpc('ficha_publica', { p_sku: sku, p_asesor: asesor || null });
      setData(d || null);
      supabase.rpc('registrar_vista', { p_sku: sku, p_asesor: asesor || null, p_client: cliente ? Number(cliente) : null });
    })();
  }, [sku, asesor, cliente]);

  const dev = data?.dev;
  const unidades = data?.unidades || [];
  const medios = data?.medios || [];
  const ase = data?.asesor;
  const selUnit = useMemo(() => unidad ? unidades.find(u => u.sku === unidad) : null, [unidad, unidades]);

  const portada = useMemo(() => medios.find(m => m.tipo === 'portada') || medios.find(m => m.tipo === 'render') || medios.find(m => m.tipo === 'foto'), [medios]);
  const galeria = useMemo(() => {
    const pri = { portada: 0, render: 1, foto: 2, amenidad: 3, planta: 4, plano: 5 };
    return medios.filter(m => IMG.includes(m.tipo)).slice().sort((a, b) => (pri[a.tipo] - pri[b.tipo]) || ((a.orden || 0) - (b.orden || 0)));
  }, [medios]);
  const unitMedio = (tipo) => selUnit && medios.find(m => m.tipo === tipo && (m.unidad_sku === selUnit.sku || (m.prototipo && m.prototipo === selUnit.prototipo)));
  const grupos = useMemo(() => agruparPorRec(unidades), [unidades]);
  const modeloImg = proto => medios.find(x => x.prototipo === proto && ['planta', 'plano', 'render', 'foto'].includes(x.tipo));

  if (data === undefined) return <div className="loading">Cargando ficha…</div>;
  if (!dev) return <div className="loading">Esta ficha no está disponible.</div>;

  const m = meses(dev.fecha_entrega);
  const amen = (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  const creds = [['ION', dev.credito_ion], ['HIR', dev.credito_hir], ['Yave', dev.credito_yave], ['Bancario', dev.credito_bancario]].filter(([l, v]) => v && /s/i.test(v));
  const engMonto = dev.esq_enganche ? dev.precio_min * dev.esq_enganche : null;
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dev.direccion, dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', '));
  const siTxt = v => v && /^\s*s[íi]/i.test(String(v));
  const exteriores = [['balcon', '🌿 Balcón'], ['terraza', '☀️ Terraza'], ['roof', '🏙️ Roof garden'], ['bodega', '📦 Bodega']].filter(([k]) => siTxt(dev[k])).map(([, l]) => l);
  // Forma de pago (esquema BASE) + crédito bancario sobre el monto a escriturar.
  const cotTasa = TASAS_DEFAULT.Bancario;                 // ~11.5% referencia
  const cRec = selUnit ? (selUnit.rec ?? 0) : (cotRec ?? grupos[0]?.rec ?? 0);
  const cBase = selUnit ? selUnit.precio : (grupos.find(g => g.rec === cRec)?.desde ?? dev.precio_min ?? 0);
  const cApartado = dev.apartado || 10000;
  const cFirma = Math.round(cBase * ESQUEMA_BASE.firma);
  const cObra = Math.round(cBase * ESQUEMA_BASE.obra);
  const cEscritura = Math.round(cBase * ESQUEMA_BASE.escritura);
  const cMensualidad = mensualidadCredito(cEscritura, cotTasa, cotPlazo);
  const cIngreso = cMensualidad ? Math.round(cMensualidad / 0.30) : null;
  const telDig = ase?.telefono ? soloDig(ase.telefono) : '';
  const waAse = telDig ? 'https://wa.me/' + (telDig.length === 10 ? '52' : '') + telDig + '?text=' + encodeURIComponent(`Hola ${ase?.nombre || ''}, me interesa ${dev.nombre}${selUnit ? ` (T${selUnit.torre} ${selUnit.num_depto})` : ''}`) : null;
  const planoUrl = unitMedio('plano')?.url;
  const plantaUrl = unitMedio('planta')?.url;

  async function enviar(e) {
    e.preventDefault();
    setErr(null);
    if (!form.nombre.trim() || !form.telefono.trim()) { setErr('Nombre y teléfono son obligatorios.'); return; }
    if (!form.consent) { setErr('Marca la casilla de autorización.'); return; }
    if (!asesor) { setErr('Este enlace no trae asesor asignado.'); return; }
    if (modo === 'cita' && (!form.fecha || !form.hora)) { setErr('Elige fecha y hora para tu cita.'); return; }
    setSending(true);
    let error, citaId;
    if (modo === 'cita') {
      const r = await supabase.rpc('agendar_cita_publica', {
        p_sku: sku, p_asesor: asesor, p_unidad: unidad || null,
        p_nombre: form.nombre.trim(), p_telefono: form.telefono.trim(), p_email: form.email.trim() || null,
        p_fecha: form.fecha, p_hora: form.hora, p_modalidad: form.modalidad, p_mensaje: form.mensaje.trim() || null,
      });
      error = r.error; citaId = r.data;
    } else {
      const r = await supabase.rpc('registrar_lead_publico', {
        p_sku: sku, p_asesor: asesor, p_nombre: form.nombre.trim(), p_telefono: form.telefono.trim(),
        p_email: form.email.trim() || null, p_mensaje: form.mensaje.trim() || null, p_unidad: unidad || null,
      });
      error = r.error;
    }
    setSending(false);
    if (error) { setErr(error.message); return; }
    if (modo === 'cita') {
      if (citaId) crearEventoGoogle(citaId);
      const cal = {
        titulo: `Cita — ${dev.nombre}${selUnit ? ` (T${selUnit.torre} ${selUnit.num_depto})` : ''}`,
        fecha: form.fecha, hora: form.hora,
        detalles: `Cliente: ${form.nombre} · Tel ${form.telefono}. Asesor: ${ase?.nombre || ''} ${ase?.telefono || ''}. ${dev.nombre}${selUnit ? ' · T' + selUnit.torre + ' ' + selUnit.num_depto : ''}.`,
        ubicacion: [dev.direccion, dev.colonia, dev.alcaldia].filter(Boolean).join(', '),
      };
      setDone({ cita: true, cal, fecha: form.fecha, hora: form.hora });
    } else setDone({ cita: false });
  }

  return (
    <div className="fp">
      <div className="fp-brand">
        {ase?.org_logo ? <img className="fp-logo" src={ase.org_logo} alt={ase.org_nombre} /> : <span className="fp-org">{ase?.org_nombre || 'Quiero Casa'}</span>}
        {ase?.nombre && <span className="fp-by">Compartido por <b>{ase.nombre}</b></span>}
      </div>

      <div className="fp-hero" style={portada ? { backgroundImage: `linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.75)),url(${portada.url})` } : undefined}>
        <div className="fp-hero-in">
          <span className="fp-badge">{dev.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : (m != null ? `Preventa · ${m} meses` : 'Preventa')}</span>
          <h1>{dev.nombre}</h1>
          <p className="fp-loc">📍 {[dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', ')}</p>
          <div className="fp-price">{selUnit ? 'Precio de la unidad' : 'Desde'} <b>{MXN(selUnit ? selUnit.precio : dev.precio_min)}</b></div>
        </div>
      </div>

      <div className="fp-body">
        {selUnit && (
          <section className="fp-unit">
            <div className="fp-unit-h"><span className="fp-unit-tag">Unidad seleccionada</span><b>T{selUnit.torre} · {selUnit.num_depto}</b>{selUnit.prototipo ? <span className="fp-unit-proto">{selUnit.prototipo}</span> : null}</div>
            <div className="fp-unit-grid">
              <div><span>Recámaras</span><b>{selUnit.rec === 0 ? 'Loft' : (selUnit.rec ?? '—')}</b></div>
              <div><span>Baños</span><b>{selUnit.banos ?? '—'}</b></div>
              <div><span>Estac.</span><b>{selUnit.n_estac ?? '—'}</b></div>
              <div><span>m² hab</span><b>{m2(selUnit.m2_hab)}</b></div>
              <div><span>m² tot</span><b>{m2(selUnit.m2_total)}</b></div>
              <div className="acc"><span>Precio</span><b>{MXN(selUnit.precio)}</b></div>
            </div>
            {(planoUrl || plantaUrl) && (
              <div className="fp-unit-planos">
                {planoUrl && <a href={planoUrl} target="_blank" rel="noopener"><img src={planoUrl} alt="Plano" /><span>Plano</span></a>}
                {plantaUrl && <a href={plantaUrl} target="_blank" rel="noopener"><img src={plantaUrl} alt="Planta" /><span>Planta ambientada</span></a>}
              </div>
            )}
            <a className="fp-cta" href="#contacto">Agendar cita por esta unidad ↓</a>
          </section>
        )}

        <div className="fp-specs">
          <div><b>{dev.rec_min === 0 ? 'Loft' : dev.rec_min}–{dev.rec_max}</b><span>Recámaras</span></div>
          <div><b>{dev.banos_min}–{dev.banos_max}</b><span>Baños</span></div>
          <div><b>{dev.estac_min}–{dev.estac_max}</b><span>Estac.</span></div>
          <div><b>{Math.round(dev.m2_min)}–{Math.round(dev.m2_max)}</b><span>m²</span></div>
        </div>

        {galeria.length > 0 && (
          <section className="fp-sec"><h2>Galería</h2>
            <div className="fp-gal">{galeria.map((mm, i) => (
              <button key={i} className="fp-gal-i" onClick={() => setFoto(mm.url)}>
                <img src={mm.url} alt={etiquetaMedio(mm)} loading="lazy" />
                <span>{etiquetaMedio(mm)}</span>
              </button>))}</div>
          </section>
        )}

        {/* Modelos disponibles: una tarjeta por número de recámaras */}
        {!selUnit && grupos.length > 0 && (
          <section className="fp-sec"><h2>Modelos disponibles</h2>
            <div className="fp-modelos">
              {grupos.map(g => {
                const img = modeloImg(g.proto);
                return (
                  <div className={'fp-model' + (img ? '' : ' nophoto')} key={g.rec}>
                    {img && <div className="fp-model-img"><img src={img.url} alt={tituloRec(g.rec)} loading="lazy" /></div>}
                    <div className="fp-model-body">
                      <b>{tituloRec(g.rec)}</b>
                      <span className="fp-model-specs">desde {m2(g.m2Desde)} m²</span>
                      <div className="fp-model-price"><span>desde</span><b>{MXN(g.desde)}</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="fnote">Para la unidad ideal para ti y su disponibilidad, contacta a {ase?.nombre || 'tu asesor'}.</p>
          </section>
        )}

        {/* Forma de pago (esquema base) */}
        <section className="fp-sec fp-pago">
          <h2>Forma de pago</h2>
          {!selUnit && grupos.length > 1 && (
            <div className="fp-pago-rec"><span>Cotizar</span>
              {grupos.map(g => <button type="button" key={g.rec} className={'chip' + (cRec === g.rec ? ' on' : '')} onClick={() => setCotRec(g.rec)}>{tituloRec(g.rec)}</button>)}
            </div>
          )}
          <div className="fp-pago-base">Sobre {selUnit ? 'esta unidad' : `${tituloRec(cRec)} desde`} <b>{MXN(cBase)}</b></div>
          <div className="fp-pago-rows">
            <div className="fp-pago-row"><span>Apartado</span><b>{MXN(cApartado)}</b></div>
            <div className="fp-pago-row"><span>Firma de contrato</span><i>15%</i><b>{MXN(cFirma)}</b></div>
            <div className="fp-pago-row"><span>Mensualidades en obra</span><i>10%</i><b>{MXN(cObra)}</b></div>
            <div className="fp-pago-row esc"><span>Monto a escriturar</span><i>75%</i><b>{MXN(cEscritura)}</b></div>
          </div>
        </section>

        {/* Crédito bancario sobre el monto a escriturar */}
        <section className="fp-sec fp-credito">
          <h2>Crédito bancario</h2>
          <p className="fnote" style={{ marginTop: 0 }}>Se financia el monto a escriturar ({MXN(cEscritura)}) con el banco. Elige el plazo:</p>
          <div className="fp-cotiz-plazo"><span>Plazo</span>
            {[5, 10, 15, 20].map(p => <button type="button" key={p} className={'chip' + (cotPlazo === p ? ' on' : '')} onClick={() => setCotPlazo(p)}>{p} años</button>)}
          </div>
          <div className="cotiz-result">
            <span>Mensualidad estimada</span>
            <b>{MXN(cMensualidad)}</b>
            <small>{(cotTasa * 100).toFixed(1)}% anual · {cotPlazo} años</small>
          </div>
          {cIngreso && <div className="cotiz-ingreso"><span>Ingreso sugerido para calificar</span><b>{MXN(cIngreso)}/mes</b><small>si el pago es ≤ 30% del ingreso</small></div>}
          <p className="fnote">Cálculo referencial. {ase?.nombre || 'Tu asesor'} arma la cotización formal con tu crédito.</p>
        </section>

        {/* Info curada para el cliente, en acordeón */}
        <div className="devsecs fp-acc">
          <details className="devsec" open><summary><span className="devsec-ic">🏠</span>Qué incluye tu depa<span className="devsec-caret">⌄</span></summary>
            <div className="devsec-body">
              {exteriores.length > 0 && <div className="dchips">{exteriores.map(e => <span key={e}>{e}</span>)}</div>}
              <div className="kv2">
                <div className="kv2row"><span>Baños</span><b>{dev.banos_min}{dev.banos_min !== dev.banos_max ? `–${dev.banos_max}` : ''}</b></div>
                <div className="kv2row"><span>Estacionamientos</span><b>{dev.estac_min}{dev.estac_min !== dev.estac_max ? `–${dev.estac_max}` : ''}</b></div>
              </div>
            </div>
          </details>
          <details className="devsec"><summary><span className="devsec-ic">📍</span>Ubicación<span className="devsec-caret">⌄</span></summary>
            <div className="devsec-body">
              <p className="fp-dir">📍 {[dev.direccion, dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', ')}</p>
              <a className="fp-maps-btn" href={mapsUrl} target="_blank" rel="noopener">📍 Ver en Google Maps · Cómo llegar</a>
            </div>
          </details>
          {amen.length > 0 && <details className="devsec"><summary><span className="devsec-ic">✨</span>Amenidades<span className="devsec-caret">⌄</span></summary>
            <div className="devsec-body"><div className="fp-amen">{amen.map((a, i) => <span className="fp-amen-i" key={i}><i>{amenIcon(a)}</i>{a}</span>)}</div></div>
          </details>}
          {creds.length > 0 && <details className="devsec"><summary><span className="devsec-ic">🏦</span>Créditos que puedes usar<span className="devsec-caret">⌄</span></summary>
            <div className="devsec-body"><div className="chips2">{creds.map(([l]) => <span className="chip2 on" key={l}>{l}</span>)}</div></div>
          </details>}
          <details className="devsec"><summary><span className="devsec-ic">🏗️</span>Entrega<span className="devsec-caret">⌄</span></summary>
            <div className="devsec-body"><div className="kv2">
              <div className="kv2row"><span>Etapa</span><b>{dev.etapa || '—'}</b></div>
              {dev.fecha_entrega && <div className="kv2row"><span>Entrega estimada</span><b>{new Date(dev.fecha_entrega + 'T12:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</b></div>}
              {m != null && <div className="kv2row"><span>Faltan</span><b>{m} meses</b></div>}
            </div></div>
          </details>
        </div>

        <section className="fp-sec fp-contacto" id="contacto">
          <div className="fp-ase">
            <div className="fp-ase-foto">{ase?.foto_url ? <img src={ase.foto_url} alt={ase.nombre} /> : <span>{(ase?.nombre || 'Q').slice(0, 1)}</span>}</div>
            <div><b>{ase?.nombre || 'Tu asesor'}</b><span>{ase?.org_nombre || ''}</span></div>
            {waAse && <a className="btn lim sm" href={waAse} target="_blank" rel="noopener">WhatsApp</a>}
          </div>

          {ase?.calcom && !done && (
            <a className="btn mag block fp-calcom" target="_blank" rel="noopener"
              href={calcomUrl(ase.calcom, { nombre: form.nombre, email: form.email, notas: `Interés: ${dev.nombre}${selUnit ? ' · T' + selUnit.torre + ' ' + selUnit.num_depto : ''}` })}>
              📅 Reservar un horario disponible (en vivo)
            </a>
          )}
          {ase?.calcom && !done && <div className="fp-or">o deja tus datos y {ase?.nombre || 'tu asesor'} te agenda</div>}

          {done ? (
            <div className="fp-done">
              {done.cita ? <>
                <div className="fp-done-h">✅ ¡Cita solicitada!</div>
                <p>{ase?.nombre || 'Tu asesor'} la confirmará. Agrégala a tu calendario para no perderla:</p>
                <div className="fp-cal">
                  <a className="btn mag block" href={googleCalUrl(done.cal)} target="_blank" rel="noopener">Agregar a Google Calendar</a>
                  <button className="btn ghost block" onClick={() => descargarIcs(done.cal)}>Descargar .ics (Apple/Outlook)</button>
                </div>
              </> : <div className="fp-done-h">✅ ¡Gracias! {ase?.nombre || 'Tu asesor'} te contactará pronto.</div>}
            </div>
          ) : (
            <form className="fp-form" onSubmit={enviar}>
              <div className="fp-form-h">📅 Agenda tu visita con {ase?.nombre || 'tu asesor'}</div>
              {err && <div className="msg err">{err}</div>}
              <div className="fp-cita-row">
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
                <select value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })}>
                  <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                </select>
              </div>
              <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <input placeholder="Teléfono / WhatsApp *" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              <input placeholder="Correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <textarea placeholder="¿Algo que quieras comentar? (opcional)" value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} />
              <label className="fp-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} />
                <span>Autorizo que me contacten sobre este desarrollo conforme al aviso de privacidad.</span></label>
              <button className="btn mag block" disabled={sending}>{sending ? 'Enviando…' : 'Agendar mi visita'}</button>
            </form>
          )}
        </section>

        <footer className="fp-foot">Ficha compartida vía <b>Quiero Casa</b> · Información referencial, sujeta a disponibilidad.</footer>
      </div>

      {foto && <div className="fp-viewer" onClick={() => setFoto(null)}><img src={foto} alt="" /><button className="fp-viewer-x">✕</button></div>}
    </div>
  );
}
