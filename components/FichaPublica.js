'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const soloDig = s => String(s ?? '').replace(/[^0-9]/g, '');
function meses(f) { if (!f) return null; const h = new Date(), x = new Date(f + 'T12:00'); return Math.max(0, (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth()); }
const IMG = ['portada', 'render', 'foto', 'amenidad', 'planta', 'plano'];

export default function FichaPublica({ sku, asesor }) {
  const [data, setData] = useState(undefined);
  const [foto, setFoto] = useState(null); // imagen abierta en visor
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', mensaje: '', consent: false });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
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

  const portada = useMemo(() => medios.find(m => m.tipo === 'portada') || medios.find(m => m.tipo === 'render') || medios.find(m => m.tipo === 'foto'), [medios]);
  const galeria = useMemo(() => {
    const pri = { portada: 0, render: 1, foto: 2, amenidad: 3, planta: 4, plano: 5 };
    return medios.filter(m => IMG.includes(m.tipo)).slice().sort((a, b) => (pri[a.tipo] - pri[b.tipo]) || ((a.orden || 0) - (b.orden || 0)));
  }, [medios]);

  if (data === undefined) return <div className="loading">Cargando ficha…</div>;
  if (!dev) return <div className="loading">Esta ficha no está disponible.</div>;

  const m = meses(dev.fecha_entrega);
  const amen = (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  const creds = [['ION', dev.credito_ion], ['HIR', dev.credito_hir], ['Yave', dev.credito_yave], ['Bancario', dev.credito_bancario]].filter(([l, v]) => v && /s/i.test(v));
  const engMonto = dev.esq_enganche ? dev.precio_min * dev.esq_enganche : null;
  const telDig = ase?.telefono ? soloDig(ase.telefono) : '';
  const waAse = telDig ? 'https://wa.me/' + (telDig.length === 10 ? '52' : '') + telDig + '?text=' + encodeURIComponent(`Hola ${ase?.nombre || ''}, me interesa ${dev.nombre}`) : null;

  async function enviar(e) {
    e.preventDefault();
    setErr(null);
    if (!form.nombre.trim() || !form.telefono.trim()) { setErr('Nombre y teléfono son obligatorios.'); return; }
    if (!form.consent) { setErr('Marca la casilla de autorización para que te contactemos.'); return; }
    if (!asesor) { setErr('Este enlace no trae asesor asignado.'); return; }
    setSending(true);
    const { error } = await supabase.rpc('registrar_lead_publico', {
      p_sku: sku, p_asesor: asesor, p_nombre: form.nombre.trim(), p_telefono: form.telefono.trim(),
      p_email: form.email.trim() || null, p_mensaje: form.mensaje.trim() || null, p_unidad: null,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  return (
    <div className="fp">
      {/* Marca superior */}
      <div className="fp-brand">
        {ase?.org_logo ? <img className="fp-logo" src={ase.org_logo} alt={ase.org_nombre} /> : <span className="fp-org">{ase?.org_nombre || 'Quiero Casa'}</span>}
        {ase?.nombre && <span className="fp-by">Compartido por <b>{ase.nombre}</b></span>}
      </div>

      {/* Hero */}
      <div className="fp-hero" style={portada ? { backgroundImage: `linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.75)),url(${portada.url})` } : undefined}>
        <div className="fp-hero-in">
          <span className="fp-badge">{dev.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : (m != null ? `Preventa · ${m} meses` : 'Preventa')}</span>
          <h1>{dev.nombre}</h1>
          <p className="fp-loc">📍 {[dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', ')}</p>
          <div className="fp-price">Desde <b>{MXN(dev.precio_min)}</b></div>
        </div>
      </div>

      <div className="fp-body">
        {/* Specs */}
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

        {unidades.length > 0 && (
          <section className="fp-sec"><h2>Unidades disponibles · {unidades.length}</h2>
            <div className="utbl-wrap"><table className="utbl"><thead><tr>
              <th>Unidad</th><th>Prototipo</th><th>Rec</th><th>m² hab</th><th>Precio</th>
            </tr></thead><tbody>
              {unidades.slice(0, 30).map(u => (
                <tr key={u.sku}><td><b>T{u.torre} · {u.num_depto}</b></td><td>{u.prototipo || '—'}</td>
                  <td>{u.rec === 0 ? 'Loft' : u.rec}</td><td>{u.m2_hab ? Math.round(u.m2_hab * 10) / 10 : '—'}</td><td><b>{MXN(u.precio)}</b></td></tr>
              ))}
            </tbody></table></div>
            {unidades.length > 30 && <p className="fnote">Y {unidades.length - 30} unidades más — pregúntale a tu asesor.</p>}
          </section>
        )}

        {/* Contacto / lead */}
        <section className="fp-sec fp-contacto" id="contacto">
          <div className="fp-ase">
            <div className="fp-ase-foto">{ase?.foto_url ? <img src={ase.foto_url} alt={ase.nombre} /> : <span>{(ase?.nombre || 'Q').slice(0, 1)}</span>}</div>
            <div><b>{ase?.nombre || 'Tu asesor'}</b><span>{ase?.org_nombre || ''}</span></div>
            {waAse && <a className="btn lim sm" href={waAse} target="_blank" rel="noopener">WhatsApp</a>}
          </div>

          {done ? (
            <div className="fp-done">✅ ¡Gracias! {ase?.nombre || 'Tu asesor'} te contactará muy pronto.</div>
          ) : (
            <form className="fp-form" onSubmit={enviar}>
              <h3>Me interesa — que me contacten</h3>
              {err && <div className="msg err">{err}</div>}
              <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <input placeholder="Teléfono / WhatsApp *" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              <input placeholder="Correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <textarea placeholder="¿Qué te interesa saber?" value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} />
              <label className="fp-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} />
                <span>Autorizo que me contacten sobre este desarrollo conforme al aviso de privacidad.</span></label>
              <button className="btn mag block" disabled={sending}>{sending ? 'Enviando…' : 'Quiero que me contacten'}</button>
            </form>
          )}
        </section>

        <footer className="fp-foot">Ficha compartida vía <b>Quiero Casa</b> · Información referencial, sujeta a disponibilidad.</footer>
      </div>

      {foto && <div className="fp-viewer" onClick={() => setFoto(null)}><img src={foto} alt="" /><button className="fp-viewer-x">✕</button></div>}
    </div>
  );
}
