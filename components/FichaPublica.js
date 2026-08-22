'use client';
import { tituloDev } from '../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleCalUrl, descargarIcs, crearEventoGoogle, calcomUrl } from '../lib/calendario';
import { etiquetaMedio } from '../lib/medios';
import { mensualidadCredito, TASAS_DEFAULT, BANCOS } from '../lib/finance';

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

// Esquema de pago por defecto (fallback) si el desarrollo no lo define.
const ESQUEMA_BASE = { firma: 0.15, obra: 0.10, escritura: 0.75 };
// Bancos para el estimador de crédito del cliente (sin fondos Infonavit/FOVISSSTE, que van aparte).
const BANCOS_CLIENTE = BANCOS.filter(b => !['Infonavit', 'FOVISSSTE'].includes(b.nombre));

// Agenda inteligente: horarios de atención y días a ofrecer.
const HORARIOS = ['10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00'];
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_AGENDA = 21;   // ventana a revisar
const MAX_DIAS = 8;       // días con cupo que se muestran
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// Construye los días con horarios libres (excluye ocupados, domingos y horas pasadas de hoy).
function construirAgenda(ocupados) {
  const busy = new Set((ocupados || []).map(o => `${o.fecha} ${(o.hora || '').slice(0, 5)}`));
  const now = new Date();
  const out = [];
  for (let i = 0; i < DIAS_AGENDA && out.length < MAX_DIAS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (day.getDay() === 0) continue;               // sin domingos
    const fecha = ymd(day);
    const slots = HORARIOS.filter(h => {
      if (busy.has(`${fecha} ${h}`)) return false;
      if (i === 0) { const [hh, mm] = h.split(':'); const t = new Date(day); t.setHours(+hh, +mm, 0, 0); if (t <= now) return false; }
      return true;
    });
    if (slots.length) out.push({ fecha, dow: day.getDay(), dia: day.getDate(), mes: day.toLocaleDateString('es-MX', { month: 'short' }), slots });
  }
  return out;
}

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
  const [cotBanco, setCotBanco] = useState('BBVA'); // banco para el estimador de crédito
  const [ocupados, setOcupados] = useState([]);  // horarios ya tomados del asesor
  const [clienteInfo, setClienteInfo] = useState(null); // si el link trae un cliente ya registrado
  // Concierge IA
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatIn, setChatIn] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.rpc('ficha_publica', { p_sku: sku, p_asesor: asesor || null });
      setData(d || null);
      supabase.rpc('registrar_vista', { p_sku: sku, p_asesor: asesor || null, p_client: null });
      if (asesor) {
        try {
          const r = await fetch('/api/agenda/horarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku, asesor }) });
          const j = await r.json();
          setOcupados(j.ocupados || []);
        } catch { setOcupados([]); }
        if (cliente) {
          const { data: ci } = await supabase.rpc('cliente_card_publica', { p_token: String(cliente), p_asesor: asesor });
          const hit = Array.isArray(ci) ? ci[0] : ci;
          if (hit?.nombre) { setClienteInfo(hit); setForm(f => ({ ...f, nombre: hit.nombre, telefono: hit.telefono || '', email: hit.email || '', consent: true })); }
        }
      }
    })();
  }, [sku, asesor, cliente]);

  // Quita el token de la tarjeta (?c=) de la URL visible tras usarlo, para que no viaje
  // en el historial ni en el Referer de recursos externos (defensa del token de PII).
  useEffect(() => {
    if (typeof window === 'undefined' || !cliente) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('c')) { u.searchParams.delete('c'); window.history.replaceState({}, '', u.pathname + u.search + u.hash); }
    } catch { /* noop */ }
  }, [cliente]);

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
  const agenda = useMemo(() => construirAgenda(ocupados), [ocupados]);
  const slotsDelDia = useMemo(() => agenda.find(a => a.fecha === form.fecha)?.slots || [], [agenda, form.fecha]);
  const modeloImg = proto => medios.find(x => x.prototipo === proto && ['planta', 'plano', 'render', 'foto'].includes(x.tipo));

  async function enviarChat(e) {
    if (e) e.preventDefault();
    const q = chatIn.trim();
    if (!q || chatBusy) return;
    const nuevo = [...chat, { role: 'user', content: q }];
    setChat(nuevo); setChatIn(''); setChatBusy(true);
    try {
      let cid = ''; try { cid = localStorage.getItem('qc_cid') || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem('qc_cid', cid); } catch { cid = 'anon-' + sku; }
      const r = await fetch('/api/agente/web', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku, texto: q, cid, asesor }) });
      const j = await r.json();
      setChat([...nuevo, { role: 'assistant', content: j.answer || 'No pude responder ahorita, pero tu asesor te ayuda enseguida.' }]);
    } catch {
      setChat([...nuevo, { role: 'assistant', content: 'No pude responder ahorita. Deja tus datos abajo y tu asesor te ayuda.' }]);
    }
    setChatBusy(false);
  }

  if (data === undefined) return <div className="loading">Cargando ficha…</div>;
  if (!dev) return <div className="loading">Esta ficha no está disponible.</div>;

  const m = meses(dev.fecha_entrega);
  const amen = (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  const creds = [['ION', dev.credito_ion], ['HIR', dev.credito_hir], ['Yave', dev.credito_yave], ['Bancario', dev.credito_bancario]].filter(([l, v]) => v && /s/i.test(v));
  const engMonto = dev.esq_enganche ? dev.precio_min * dev.esq_enganche : null;
  const mapsQuery = encodeURIComponent([dev.direccion, dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', '));
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapsQuery;
  const mapsEmbed = 'https://www.google.com/maps?q=' + mapsQuery + '&output=embed';
  const siTxt = v => v && /^\s*s[íi]/i.test(String(v));
  const exteriores = [['balcon', '🌿 Balcón'], ['terraza', '☀️ Terraza'], ['roof', '🏙️ Roof garden'], ['bodega', '📦 Bodega']].filter(([k]) => siTxt(dev[k])).map(([, l]) => l);
  // Forma de pago: esquema REAL del desarrollo (con fallback) + crédito con banco elegible.
  const pFirma = dev.esq_enganche || ESQUEMA_BASE.firma;
  const pObra = dev.esq_mensualidades || ESQUEMA_BASE.obra;
  const pEscritura = dev.esq_escritura || ESQUEMA_BASE.escritura;
  const bancoSel = BANCOS_CLIENTE.find(b => b.nombre === cotBanco) || BANCOS_CLIENTE.find(b => b.nombre === 'BBVA') || BANCOS_CLIENTE[0];
  const cotTasa = (bancoSel?.tasa ?? 11.5) / 100;
  const cRec = selUnit ? (selUnit.rec ?? 0) : (cotRec ?? grupos[0]?.rec ?? 0);
  const cBase = selUnit ? selUnit.precio : (grupos.find(g => g.rec === cRec)?.desde ?? dev.precio_min ?? 0);
  const cApartado = dev.apartado || 10000;
  const cFirma = Math.round(cBase * pFirma);
  const cObra = Math.round(cBase * pObra);
  const cEscritura = Math.round(cBase * pEscritura);
  const cMensualidad = mensualidadCredito(cEscritura, cotTasa, cotPlazo);
  const cIngreso = cMensualidad ? Math.round(cMensualidad / 0.30) : null;
  const telDig = ase?.telefono ? soloDig(ase.telefono) : '';
  const waAse = telDig ? 'https://wa.me/' + (telDig.length === 10 ? '52' : '') + telDig + '?text=' + encodeURIComponent(`Hola ${ase?.nombre || ''}, me interesa ${tituloDev(dev)}${selUnit ? ` (T${selUnit.torre} ${selUnit.num_depto})` : ''}`) : null;
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
        titulo: `Cita — ${tituloDev(dev)}${selUnit ? ` (T${selUnit.torre} ${selUnit.num_depto})` : ''}`,
        fecha: form.fecha, hora: form.hora,
        detalles: `Cliente: ${form.nombre} · Tel ${form.telefono}. Asesor: ${ase?.nombre || ''} ${ase?.telefono || ''}. ${tituloDev(dev)}${selUnit ? ' · T' + selUnit.torre + ' ' + selUnit.num_depto : ''}.`,
        ubicacion: [dev.direccion, dev.colonia, dev.alcaldia].filter(Boolean).join(', '),
      };
      setDone({ cita: true, cal, fecha: form.fecha, hora: form.hora });
    } else setDone({ cita: false });
  }

  return (
    <div className="fp">
      <div className="fp-brand">
        {ase?.org_logo ? <img className="fp-logo" src={ase.org_logo} alt={ase.org_nombre} /> : <span className="fp-org">{ase?.org_nombre || 'DesarrollosMX'}</span>}
        {ase?.nombre && <span className="fp-by">Compartido por <b>{ase.nombre}</b></span>}
      </div>

      <div className="fp-hero" style={portada ? { backgroundImage: `linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.75)),url(${portada.url})` } : undefined}>
        <div className="fp-hero-in">
          <span className="fp-badge">{dev.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : (m != null ? `Preventa · ${m} meses` : 'Preventa')}</span>
          <h1>{tituloDev(dev)}</h1>
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
            <div className="fp-pago-row"><span>Firma de contrato</span><i>{Math.round(pFirma * 100)}%</i><b>{MXN(cFirma)}</b></div>
            <div className="fp-pago-row"><span>Mensualidades en obra</span><i>{Math.round(pObra * 100)}%</i><b>{MXN(cObra)}</b></div>
            <div className="fp-pago-row esc"><span>Monto a escriturar</span><i>{Math.round(pEscritura * 100)}%</i><b>{MXN(cEscritura)}</b></div>
          </div>
        </section>

        {/* Crédito bancario sobre el monto a escriturar */}
        <section className="fp-sec fp-credito">
          <h2>Crédito bancario</h2>
          <p className="fnote" style={{ marginTop: 0 }}>Se financia el monto a escriturar ({MXN(cEscritura)}) con el banco. Elige banco y plazo:</p>
          <div className="fp-cotiz-banco"><span>Banco</span>
            <select value={cotBanco} onChange={e => setCotBanco(e.target.value)}>
              {BANCOS_CLIENTE.map(b => <option key={b.nombre} value={b.nombre}>{b.nombre} · {b.tasa.toFixed(2)}%</option>)}
            </select>
          </div>
          <div className="fp-cotiz-plazo"><span>Plazo</span>
            {[5, 10, 15, 20].map(p => <button type="button" key={p} className={'chip' + (cotPlazo === p ? ' on' : '')} onClick={() => setCotPlazo(p)}>{p} años</button>)}
          </div>
          <div className="cotiz-result">
            <span>Mensualidad estimada</span>
            <b>{MXN(cMensualidad)}</b>
            <small>{bancoSel?.nombre || 'Banco'} · {(cotTasa * 100).toFixed(2)}% anual · {cotPlazo} años</small>
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
              <div className="fp-map"><iframe title="Mapa" src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer" allowFullScreen /></div>
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
              href={calcomUrl(ase.calcom, { nombre: form.nombre, email: form.email, notas: `Interés: ${tituloDev(dev)}${selUnit ? ' · T' + selUnit.torre + ' ' + selUnit.num_depto : ''}` })}>
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
              <div className="fp-form-h">📅 {clienteInfo ? `Hola ${String(clienteInfo.nombre).split(' ')[0]}, agenda tu visita` : 'Agenda tu visita'} con {ase?.nombre || 'tu asesor'}</div>
              {clienteInfo && <div className="fp-como">Agendando como <b>{clienteInfo.nombre}</b></div>}
              {err && <div className="msg err">{err}</div>}
              {agenda.length > 0 ? (
                <div className="fp-agenda">
                  <span className="fp-agenda-lbl">Elige el día</span>
                  <div className="fp-dias">
                    {agenda.map(a => (
                      <button type="button" key={a.fecha} className={'fp-dia' + (form.fecha === a.fecha ? ' on' : '')} onClick={() => setForm({ ...form, fecha: a.fecha, hora: '' })}>
                        <span>{DOW[a.dow]}</span><b>{a.dia}</b><em>{a.mes}</em>
                      </button>
                    ))}
                  </div>
                  {form.fecha && <>
                    <span className="fp-agenda-lbl">Elige la hora ({ase?.nombre || 'tu asesor'} tiene libre)</span>
                    <div className="fp-horas">
                      {slotsDelDia.map(h => (
                        <button type="button" key={h} className={'chip' + (form.hora === h ? ' on' : '')} onClick={() => setForm({ ...form, hora: h })}>{h}</button>
                      ))}
                    </div>
                  </>}
                  <select className="fp-modalidad" aria-label="Modalidad de la cita" value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })}>
                    <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                  </select>
                </div>
              ) : (
                <div className="fp-cita-row">
                  <input type="date" aria-label="Fecha de la cita" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                  <input type="time" aria-label="Hora de la cita" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
                  <select aria-label="Modalidad de la cita" value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })}>
                    <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                  </select>
                </div>
              )}
              {!clienteInfo && <>
                <input aria-label="Nombre" placeholder="Nombre *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                <input aria-label="Teléfono o WhatsApp" placeholder="Teléfono / WhatsApp *" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                <input aria-label="Correo" placeholder="Correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </>}
              <textarea aria-label="Comentario" placeholder="¿Algo que quieras comentar? (opcional)" value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} />
              {!clienteInfo && <label className="fp-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} />
                <span>Autorizo que me contacten sobre este desarrollo conforme al aviso de privacidad.</span></label>}
              <button className="btn mag block" disabled={sending}>{sending ? 'Enviando…' : 'Agendar mi visita'}</button>
            </form>
          )}
        </section>

        <footer className="fp-foot">Ficha compartida vía <b>DesarrollosMX</b> · Información referencial, sujeta a disponibilidad.</footer>
      </div>

      {foto && <div className="fp-viewer" onClick={() => setFoto(null)}><img src={foto} alt="Foto del desarrollo" /><button className="fp-viewer-x" aria-label="Cerrar imagen">✕</button></div>}

      {/* Concierge IA */}
      {!chatOpen && <button className="fp-chat-fab" onClick={() => setChatOpen(true)}>💬 Pregúntame</button>}
      {chatOpen && (
        <div className="fp-chat">
          <div className="fp-chat-h"><b>💬 Asistente · {tituloDev(dev)}</b><button onClick={() => setChatOpen(false)} aria-label="Cerrar">✕</button></div>
          <div className="fp-chat-body">
            {chat.length === 0 && <div className="fp-chat-hint">Pregúntame lo que quieras: precios, créditos, cuánto pagarías al mes, qué hay cerca, cuándo entregan…</div>}
            {chat.map((m, i) => <div key={i} className={'fp-chat-msg ' + m.role}>{m.content}</div>)}
            {chatBusy && <div className="fp-chat-msg assistant fp-chat-typing">Escribiendo…</div>}
          </div>
          <form className="fp-chat-in" onSubmit={enviarChat}>
            <input aria-label="Escribe tu pregunta" value={chatIn} onChange={e => setChatIn(e.target.value)} placeholder="Escribe tu pregunta…" />
            <button className="btn mag sm" aria-label="Enviar pregunta" disabled={chatBusy || !chatIn.trim()}>➤</button>
          </form>
        </div>
      )}
    </div>
  );
}
