'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
function meses(fecha) {
  if (!fecha) return null;
  const h = new Date(), f = new Date(fecha + 'T12:00');
  return Math.max(0, (f.getFullYear() - h.getFullYear()) * 12 + f.getMonth() - h.getMonth());
}
const hue = d => (d.desarrollador || '').includes('Agatha') ? 210 : (d.desarrollador || '').includes('Capital') ? 265 : 330;

export default function Portal() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [fZona, setFZona] = useState('');
  const [fEtapa, setFEtapa] = useState('');
  const [fRec, setFRec] = useState('');
  const [fPrecio, setFPrecio] = useState('');
  const [sort, setSort] = useState('precio');
  const [smart, setSmart] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ email: session.user.email, ...(prof || {}) });
      const { data, error } = await supabase.from('desarrollos').select('*').order('nombre');
      if (!error) setDevs(data || []);
      else setDevs([]);
    })();
  }, [router]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  const zonas = useMemo(() => devs ? [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort() : [], [devs]);

  const rows = useMemo(() => {
    if (!devs) return [];
    let r = devs.filter(d =>
      (!fZona || d.alcaldia === fZona) &&
      (!fEtapa || d.etapa === fEtapa) &&
      (!fRec || (fRec === '3' ? d.rec_max >= 3 : (d.rec_min <= +fRec && d.rec_max >= +fRec))) &&
      (!fPrecio || d.precio_min <= +fPrecio)
    );
    if (smart === 'inmediata') r = r.filter(d => d.etapa === 'Entrega inmediata');
    if (smart === 'muestra') r = r.filter(d => d.depa_muestra === 'Sí');
    const pm2 = d => d.precio_min / (d.m2_min || 1);
    if (smart === 'preciom2' || sort === 'preciom2') r = [...r].sort((a, b) => pm2(a) - pm2(b));
    else if (smart === 'comision' || sort === 'comision') r = [...r].sort((a, b) => (b.comision_broker || 0) - (a.comision_broker || 0));
    else if (sort === 'entrega') r = [...r].sort((a, b) => (a.fecha_entrega || '').localeCompare(b.fecha_entrega || ''));
    else r = [...r].sort((a, b) => a.precio_min - b.precio_min);
    return r;
  }, [devs, fZona, fEtapa, fRec, fPrecio, sort, smart]);

  if (devs === null) return <div className="loading">Cargando portal…</div>;

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Portal de Brokers</span>
        <nav className="nav">
          <a onClick={() => router.push('/buscar')}>Buscar</a>
          <a onClick={() => router.push('/crm')}>CRM</a>
          <a onClick={() => router.push('/comisiones')}>Comisiones</a>
          {me?.rol === 'super_admin' && <a onClick={() => router.push('/altas')}>Altas</a>}
          {me?.rol === 'super_admin' && <span className="tag-super">SUPER ADMIN</span>}
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

      <main className="wrap">
        <div className="filters">
          <select value={fZona} onChange={e => setFZona(e.target.value)}><option value="">Zona</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
          <select value={fEtapa} onChange={e => setFEtapa(e.target.value)}><option value="">Etapa</option><option>Entrega inmediata</option><option>Preventa</option></select>
          <select value={fRec} onChange={e => setFRec(e.target.value)}><option value="">Recámaras</option><option value="0">Loft</option><option value="1">1+</option><option value="2">2+</option><option value="3">3</option></select>
          <select value={fPrecio} onChange={e => setFPrecio(e.target.value)}><option value="">Precio</option><option value="3000000">Hasta $3M</option><option value="4000000">Hasta $4M</option><option value="5000000">Hasta $5M</option><option value="6500000">Hasta $6.5M</option></select>
          <select value={sort} onChange={e => setSort(e.target.value)}><option value="precio">Ordenar: precio</option><option value="preciom2">Precio/m²</option><option value="comision">Comisión</option><option value="entrega">Entrega</option></select>
          <span className="count">{rows.length} de {devs.length} desarrollos</span>
        </div>
        <div className="chips">
          {[['', 'Todos'], ['preciom2', '💸 Mejor precio/m²'], ['inmediata', '⚡ Entrega inmediata'], ['comision', '💰 Mayor comisión'], ['muestra', '🏠 Con depa muestra']].map(([k, l]) =>
            <span key={k} className={'chip' + (smart === k ? ' on' : '')} onClick={() => setSmart(k)}>{l}</span>)}
        </div>

        <div className="grid">
          {rows.map(d => {
            const m = meses(d.fecha_entrega);
            const pm2 = d.m2_min ? Math.round(d.precio_min / d.m2_min) : null;
            const eng = d.esq_enganche ? d.precio_min * d.esq_enganche : null;
            return (
              <article className="card card-link" key={d.sku} onClick={() => router.push('/portal/' + d.sku)}>
                <div className="cover" style={{ background: `linear-gradient(135deg,hsl(${hue(d)} 45% 28%),hsl(${hue(d) + 18} 50% 40%))` }}>
                  <span className="sig">{d.sku}</span>
                  <span className={'badge ' + (d.etapa === 'Entrega inmediata' ? 'inm' : 'pre')}>{d.etapa === 'Entrega inmediata' ? 'Inmediata' : (m != null ? `Preventa · ${m}m` : 'Preventa')}</span>
                </div>
                <div className="cbody">
                  <h3>{d.nombre}</h3>
                  <span className="loc">📍 {d.colonia}, {d.alcaldia} · {d.desarrollador}</span>
                  <div className="price"><span>desde</span><b>{MXN(d.precio_min)}</b></div>
                  <div className="specs">
                    <span>🛏 {d.rec_min === 0 ? 'Loft' : d.rec_min}–{d.rec_max}</span>
                    <span>🛁 {d.banos_min}–{d.banos_max}</span>
                    <span>🚗 {d.estac_min}–{d.estac_max} · {d.tipo_estac || '—'}</span>
                    <span>📐 {Math.round(d.m2_min)}–{Math.round(d.m2_max)} m²</span>
                  </div>
                  <div className="metrics">
                    {pm2 && <span className="metric">$/m² <b>${pm2.toLocaleString('es-MX')}</b></span>}
                    {eng && <span className="metric">Enganche <b>{MXN(eng)}</b></span>}
                    {d.comision_broker && <span className="metric">Comisión <b>{Math.round(d.comision_broker * 100)}%</b></span>}
                  </div>
                  <div className="foot">
                    <span className="avail">{d.unidades_totales || '—'} unidades</span>
                    {d.whatsapp && <a href={'https://' + d.whatsapp.replace('https://', '').replace('http://', '')} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ fontSize: '.82rem', fontWeight: 700 }}>WhatsApp →</a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <footer className="foot-note">Catálogo en vivo desde Supabase con RLS. La ficha técnica completa, unidades y cotizador llegan en los siguientes batches.</footer>
      </main>
    </>
  );
}
