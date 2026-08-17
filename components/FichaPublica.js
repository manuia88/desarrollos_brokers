'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { googleCalUrl, descargarIcs } from '../lib/calendario';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const soloDig = s => String(s ?? '').replace(/[^0-9]/g, '');
const m2 = v => (v == null || v === '') ? '—' : (Math.round(v * 10) / 10);
function meses(f) { if (!f) return null; const h = new Date(), x = new Date(f + 'T12:00'); return Math.max(0, (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth()); }
const IMG = ['portada', 'render', 'foto', 'amenidad', 'planta', 'plano'];

export default function FichaPublica({ sku, asesor, unidad }) {
  const [data, setData] = useState(undefined);
  const [foto, setFoto] = useState(null);
  const [modo, setModo] = useState('cita'); // 'cita' | 'contacto'
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', mensaje: '', fecha: '', hora: '', modalidad: 'Presencial', consent: false });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.rpc('ficha_publica', { p_sku: sku, p_asesor: asesor || null });
      setData(d || null);
      supabase.rpc('registrar_vista', { p_sku: sku, p_asesor: asesor || null });
    })();
  }, [sku, asesor]);

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

  if (data === undefined) return <div className="loading">Cargando ficha…</div>;
  if (!dev) return <div className="loading">Esta ficha no está disponible.</div>;

  const m = meses(dev.fecha_entrega);
  const amen = (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  const creds = [['ION', dev.credito_ion], ['HIR', dev.credito_hir], ['Yave', dev.credito_yave], ['Bancario', dev.credito_bancario]].filter(([l, v]) => v && /s/i.test(v));
  const engMonto = dev.esq_enganche ? dev.precio_min * dev.esq_enganche : null;
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
    let error;
    if (modo === 'cita') {
      ({ error } = await supabase.rpc('agendar_cita_publica', {
        p_sku: sku, p_asesor: asesor, p_unidad: unidad || null,
        p_nombre: form.nombre.trim(), p_telefono: form.telefono.trim(), p_email: form.email.trim() || null,
        p_fecha: form.fecha, p_hora: form.hora, p_modalidad: form.modalidad, p_mensaje: form.mensaje.trim() || null,
      }));
    } else {
      ({ error } = await supabase.rpc('registrar_lead_publico', {
        p_sku: sku, p_asesor: asesor, p_nombre: form.nombre.trim(), p_telefono: form.telefono.trim(),
        p_email: form.email.trim() || null, p_mensaje: form.mensaje.trim() || null, p_unidad: unidad || null,
      }));
    }
    setSending(false);
    if (error) { setErr(error.message); return; }
    if (modo === 'cita') {
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
                <img src={mm.url} alt={mm.area || mm.tipo} loading="lazy" />
                <span>{mm.area || mm.titulo || mm.tipo}</span>
              </button>))}</div>
          </section>
        )}

        <section className="fp-sec"><h2>Esquema de pago</h2>
          <div className="fp-esq">
            <div><span>Apartado</span><b>{MXN(dev.apartado)}</b></div>
            <div><span>Enganche</span><b>{Math.round((dev.esq_enganche || 0) * 100)}%{engMonto ? ` · ${MXN(engMonto)}` : ''}</b></div>
            <div><span>Mensualidades en obra</span><b>{Math.round((dev.esq_mensualidades || 0) * 100)}%</b></div>
            <div><span>Contra escritura</span><b>{Math.round((dev.esq_escritura || 0) * 100)}%</b></div>
          </div>
        </section>

        {amen.length > 0 && <section className="fp-sec"><h2>Amenidades</h2><div className="chips2">{amen.map((a, i) => <span className="chip2" key={i}>{a}</span>)}</div></section>}
        {creds.length > 0 && <section className="fp-sec"><h2>Créditos aceptados</h2><div className="chips2">{creds.map(([l]) => <span className="chip2 on" key={l}>{l}</span>)}</div></section>}

        {!selUnit && unidades.length > 0 && (
          <section className="fp-sec"><h2>Unidades disponibles · {unidades.length}</h2>
            <div className="utbl-wrap"><table className="utbl"><thead><tr>
              <th>Unidad</th><th>Prototipo</th><th>Rec</th><th>m² hab</th><th>Precio</th>
            </tr></thead><tbody>
              {unidades.slice(0, 30).map(u => (
                <tr key={u.sku}><td><b>T{u.torre} · {u.num_depto}</b></td><td>{u.prototipo || '—'}</td>
                  <td>{u.rec === 0 ? 'Loft' : u.rec}</td><td>{m2(u.m2_hab)}</td><td><b>{MXN(u.precio)}</b></td></tr>
              ))}
            </tbody></table></div>
            {unidades.length > 30 && <p className="fnote">Y {unidades.length - 30} unidades más — pregúntale a tu asesor.</p>}
          </section>
        )}

        <section className="fp-sec fp-contacto" id="contacto">
          <div className="fp-ase">
            <div className="fp-ase-foto">{ase?.foto_url ? <img src={ase.foto_url} alt={ase.nombre} /> : <span>{(ase?.nombre || 'Q').slice(0, 1)}</span>}</div>
            <div><b>{ase?.nombre || 'Tu asesor'}</b><span>{ase?.org_nombre || ''}</span></div>
            {waAse && <a className="btn lim sm" href={waAse} target="_blank" rel="noopener">WhatsApp</a>}
          </div>

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
              <div className="fp-toggle">
                <button type="button" className={modo === 'cita' ? 'on' : ''} onClick={() => setModo('cita')}>Agendar cita</button>
                <button type="button" className={modo === 'contacto' ? 'on' : ''} onClick={() => setModo('contacto')}>Solo contáctenme</button>
              </div>
              {err && <div className="msg err">{err}</div>}
              <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <input placeholder="Teléfono / WhatsApp *" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              <input placeholder="Correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              {modo === 'cita' && (
                <div className="fp-cita-row">
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                  <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
                  <select value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })}>
                    <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                  </select>
                </div>
              )}
              <textarea placeholder="¿Algo que quieras comentar?" value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} />
              <label className="fp-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} />
                <span>Autorizo que me contacten sobre este desarrollo conforme al aviso de privacidad.</span></label>
              <button className="btn mag block" disabled={sending}>{sending ? 'Enviando…' : (modo === 'cita' ? 'Agendar mi cita' : 'Quiero que me contacten')}</button>
            </form>
          )}
        </section>

        <footer className="fp-foot">Ficha compartida vía <b>Quiero Casa</b> · Información referencial, sujeta a disponibilidad.</footer>
      </div>

      {foto && <div className="fp-viewer" onClick={() => setFoto(null)}><img src={foto} alt="" /><button className="fp-viewer-x">✕</button></div>}
    </div>
  );
}
