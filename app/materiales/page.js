'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';

const LINK_KEYS = [['brochure', '📄 Brochure'], ['recorrido', '🎥 Recorrido 360'], ['recorrido360', '🎥 Recorrido 360'], ['video', '▶️ Video'], ['drive', '📁 Drive'], ['easybroker', '🏢 EasyBroker']];

export default function Materiales() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [medios, setMedios] = useState([]);
  const [q, setQ] = useState('');
  const [copiado, setCopiado] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: m }] = await Promise.all([
        supabase.from('desarrollos').select('sku,nombre,colonia,alcaldia,portada,liga_disponibilidad,links,whatsapp').order('nombre'),
        supabase.from('media').select('dev_sku,tipo,url,titulo,area,prototipo'),
      ]);
      setDevs(d || []); setMedios(m || []);
    })();
  }, [router]);

  const porDev = useMemo(() => {
    const g = {}; medios.forEach(m => { (g[m.dev_sku] = g[m.dev_sku] || []).push(m); }); return g;
  }, [medios]);

  const lista = useMemo(() => {
    if (!devs) return [];
    const t = q.trim().toLowerCase();
    return t ? devs.filter(d => (d.nombre + d.colonia + d.alcaldia).toLowerCase().includes(t)) : devs;
  }, [devs, q]);

  function link(sku) {
    return (typeof window !== 'undefined')
      ? `${window.location.origin}/f/${sku}?a=${me?.id}&utm_source=broker&utm_medium=share&utm_campaign=${sku}`
      : '';
  }
  function copiar(sku) {
    const l = link(sku);
    if (navigator.clipboard) { navigator.clipboard.writeText(l); setCopiado(sku); setTimeout(() => setCopiado(null), 1500); }
  }
  function wa(sku, nombre) {
    return 'https://wa.me/?text=' + encodeURIComponent(`Te comparto ${nombre}: ${link(sku)}`);
  }
  // Descarga la imagen con la marca del broker sobrepuesta (watermark en canvas).
  async function descargarConMarca(url, filename) {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const marca = String(me?.nombre || 'DesarrollosMX').toUpperCase();
      const pad = Math.round(c.width * 0.02);
      const fs = Math.max(16, Math.round(c.width * 0.028));
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(marca).width;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(pad - 6, c.height - pad - fs - 12, tw + 14, fs + 14);
      ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.textBaseline = 'top';
      ctx.fillText(marca, pad, c.height - pad - fs - 4);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'imagen.jpg'; a.click(); URL.revokeObjectURL(a.href);
    } catch { window.open(url, '_blank'); }
  }

  function ligas(d) {
    const out = [];
    if (d.liga_disponibilidad && /^https?:/.test(d.liga_disponibilidad)) out.push(['🌐 Sitio oficial', d.liga_disponibilidad]);
    const lk = d.links && typeof d.links === 'object' ? d.links : {};
    LINK_KEYS.forEach(([k, l]) => { if (lk[k] && /^https?:/.test(lk[k])) out.push([l, lk[k]]); });
    return out;
  }

  if (devs === null) return <div className="loading">Cargando materiales…</div>;

  return (
    <>
      <Nav me={me} current="/materiales" logo="Materiales" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Materiales para compartir</h1>
          <p>Todo lo que necesitas para mandarle a un cliente, ya con tu marca y con seguimiento: link rastreable, mensaje de WhatsApp, imágenes y brochure.</p>
        </div>

        <input className="inp" style={{ maxWidth: 360, marginBottom: '1rem' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar desarrollo…" />

        {lista.length === 0 ? <EmptyState icon="🔎" title="Sin resultados">Prueba otro nombre o zona.</EmptyState> : (
          <div className="mat-grid">
            {lista.map(d => {
              const imgs = (porDev[d.sku] || []).filter(m => ['portada', 'render', 'foto', 'amenidad', 'plano', 'planta'].includes(m.tipo));
              const ls = ligas(d);
              const tset = new Set((porDev[d.sku] || []).map(m => m.tipo));
              const comp = [['portada', 'Portada'], ['render', 'Renders'], ['plano', 'Planos'], ['planta', 'Plantas'], ['amenidad', 'Amenidades'], ['brochure', 'Brochure']];
              return (
                <article className="mat" key={d.sku}>
                  <div className="mat-h">
                    <div><h3>{d.nombre}</h3><span className="loc">📍 {d.colonia}, {d.alcaldia}</span></div>
                    <span className="mat-count">{imgs.length} img</span>
                  </div>

                  <div className="mat-comp">{comp.map(([k, l]) => <span key={k} className={'mc-dot' + (tset.has(k) || (k === 'render' && tset.has('foto')) ? ' on' : '')} title={l}>{l}</span>)}</div>

                  <div className="mat-share">
                    <div className="mat-link">{link(d.sku)}</div>
                    <div className="mat-btns">
                      <button className="btn lim sm" onClick={() => copiar(d.sku)}>{copiado === d.sku ? '¡Copiado!' : 'Copiar link'}</button>
                      <a className="btn ghost sm" href={wa(d.sku, d.nombre)} target="_blank" rel="noopener">WhatsApp</a>
                      <button className="btn ghost sm" onClick={() => router.push('/portal/' + d.sku)}>Abrir ficha</button>
                    </div>
                  </div>

                  {ls.length > 0 && <div className="mat-ligas">{ls.map(([l, u]) => <a key={l} className="chip2" href={u} target="_blank" rel="noopener">{l}</a>)}</div>}

                  {imgs.length > 0 ? (
                    <div className="mat-imgs">{imgs.slice(0, 8).map((m, i) => (
                      <button key={i} className="mat-img" onClick={() => descargarConMarca(m.url, (m.titulo || m.tipo) + '.jpg')} title={'Descargar con tu marca · ' + (m.titulo || m.area || m.tipo)}>
                        <img src={m.url} alt={m.titulo || m.tipo} loading="lazy" />
                        <span className="mat-dl">⬇</span>
                      </button>
                    ))}</div>
                  ) : (
                    <div className="mat-empty">Sin imágenes cargadas. {me?.rol === 'super_admin' ? 'Súbelas desde 🖼️ Gestionar medios en la ficha.' : 'El link brandeado ya funciona para compartir.'}</div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
