'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const RECLBL = { '0': 'Loft', '1': '1 rec', '2': '2 rec', '3': '3+ rec' };

export default function Metricas() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      let tipoOrg = null;
      if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('tipo').eq('id', prof.org_id).maybeSingle(); tipoOrg = o?.tipo; }
      setMe({ id: session.user.id, email: session.user.email, tipoOrg, ...(prof || {}) });
      const [ev, ld, ci, no, de] = await Promise.all([
        supabase.from('eventos').select('tipo,entidad_id,meta,creado').order('creado', { ascending: false }).limit(3000),
        supabase.from('leads').select('id,dev_sku,rec_interes,zona_interes,fuente,etapa,creado'),
        supabase.from('citas').select('id,dev_sku,estatus'),
        supabase.from('notificaciones').select('tipo,leido'),
        supabase.from('desarrollos').select('sku,nombre,dev_org_id'),
      ]);
      // #8 Aislar por dueño: un desarrollador ve SOLO sus desarrollos; super ve todo.
      let de2 = de.data || [];
      if (prof?.rol !== 'super_admin' && tipoOrg === 'desarrollador') de2 = de2.filter(x => x.dev_org_id === prof.org_id);
      const mine = new Set(de2.map(x => x.sku));
      const esDev = prof?.rol !== 'super_admin' && tipoOrg === 'desarrollador';
      setD({
        ev: esDev ? (ev.data || []).filter(e => e.tipo !== 'vista_ficha' || mine.has(e.entidad_id)) : (ev.data || []),
        ld: esDev ? (ld.data || []).filter(l => mine.has(l.dev_sku)) : (ld.data || []),
        ci: esDev ? (ci.data || []).filter(c => mine.has(c.dev_sku)) : (ci.data || []),
        no: no.data || [], de: de2,
      });
    })();
  }, [router]);

  const k = useMemo(() => {
    if (!d) return null;
    const devName = Object.fromEntries(d.de.map(x => [x.sku, x.nombre]));
    const busquedas = d.ev.filter(e => e.tipo === 'busqueda');
    const sinRes = busquedas.filter(e => (e.meta?.resultados ?? 1) === 0);
    const vistas = d.ev.filter(e => e.tipo === 'vista_ficha');

    // recámaras y zonas más buscadas (búsquedas + intención de leads)
    const rec = {}, zona = {};
    busquedas.forEach(e => { (e.meta?.criterios?.recs || []).forEach(r => { rec[r] = (rec[r] || 0) + 1; }); const z = e.meta?.criterios?.zona; if (z) zona[z] = (zona[z] || 0) + 1; });
    d.ld.forEach(l => { if (l.rec_interes != null) { const r = l.rec_interes >= 3 ? '3' : String(l.rec_interes); rec[r] = (rec[r] || 0) + 1; } if (l.zona_interes) zona[l.zona_interes] = (zona[l.zona_interes] || 0) + 1; });
    const recTop = Object.entries(rec).map(([r, n]) => ({ label: RECLBL[r] || r, n })).sort((a, b) => b.n - a.n);
    const zonaTop = Object.entries(zona).map(([z, n]) => ({ label: z, n })).sort((a, b) => b.n - a.n).slice(0, 8);

    // desarrollos: vistas / leads / citas
    const dev = {};
    const bump = (sku, key) => { if (!sku) return; dev[sku] = dev[sku] || { vistas: 0, leads: 0, citas: 0 }; dev[sku][key]++; };
    vistas.forEach(e => bump(e.entidad_id, 'vistas'));
    d.ld.forEach(l => bump(l.dev_sku, 'leads'));
    d.ci.forEach(c => bump(c.dev_sku, 'citas'));
    const devRows = Object.entries(dev).map(([sku, o]) => ({ sku, nombre: devName[sku] || sku, ...o, conv: o.vistas ? Math.round(o.leads / o.vistas * 100) : null }))
      .sort((a, b) => (b.vistas + b.leads * 3 + b.citas * 5) - (a.vistas + a.leads * 3 + a.citas * 5)).slice(0, 10);

    // demanda insatisfecha: búsquedas con 0 resultados, agrupadas por criterio
    const insat = {};
    sinRes.forEach(e => { const c = e.meta?.criterios || {}; const key = [(c.recs || []).map(r => RECLBL[r] || r).join('/'), c.zona, c.presMax ? '≤$' + Math.round(c.presMax / 1e6) + 'M' : ''].filter(Boolean).join(' · ') || '(sin criterio)'; insat[key] = (insat[key] || 0) + 1; });
    const insatTop = Object.entries(insat).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 8);

    // avisos por tipo
    const av = {};
    d.no.forEach(n => { av[n.tipo] = av[n.tipo] || { total: 0, leidos: 0 }; av[n.tipo].total++; if (n.leido) av[n.tipo].leidos++; });
    const avRows = Object.entries(av).map(([tipo, o]) => ({ tipo, ...o, pct: o.total ? Math.round(o.leidos / o.total * 100) : 0 })).sort((a, b) => b.total - a.total);

    const conv = vistas.length ? Math.round(d.ld.length / vistas.length * 100) : null;
    return { busquedas: busquedas.length, sinRes: sinRes.length, pctSin: busquedas.length ? Math.round(sinRes.length / busquedas.length * 100) : 0, leads: d.ld.length, citas: d.ci.filter(c => ['Solicitada', 'Confirmada'].includes(c.estatus)).length, conv, recTop, zonaTop, devRows, insatTop, avRows };
  }, [d]);

  if (!k) return <div className="loading">Cargando métricas…</div>;
  const maxRec = k.recTop[0]?.n || 1, maxZona = k.zonaTop[0]?.n || 1;

  return (
    <>
      <Nav me={me} current="/metricas" logo="Métricas" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Métricas de demanda</h1>
          <p>Qué busca la gente, qué anuncios jalan y dónde hay demanda sin inventario. Se alimenta de las búsquedas, vistas, leads y citas del portal.</p>
        </div>

        <div className="mtiles" style={{ marginBottom: '1.3rem' }}>
          <div className="mtile acc"><b>{k.busquedas}</b><span>Búsquedas</span></div>
          <div className="mtile"><b>{k.pctSin}%</b><span>Sin resultados</span></div>
          <div className="mtile"><b>{k.leads}</b><span>Leads</span></div>
          <div className="mtile"><b>{k.citas}</b><span>Citas activas</span></div>
          <div className="mtile"><b>{k.conv ?? '—'}{k.conv != null ? '%' : ''}</b><span>Conversión vista→lead</span></div>
        </div>

        <div className="tb-cols">
          <section className="sec">
            <h2>Recámaras más buscadas</h2>
            {k.recTop.length === 0 ? <p className="fnote">Aún sin búsquedas registradas.</p> : k.recTop.map(r => (
              <div className="tb-row" key={r.label}><span className="tb-lbl">{r.label}</span><div className="tb-bar mag"><i style={{ width: Math.max(4, r.n / maxRec * 100) + '%' }} /></div><b className="tb-n">{r.n}</b></div>
            ))}
          </section>
          <section className="sec">
            <h2>Zonas más buscadas</h2>
            {k.zonaTop.length === 0 ? <p className="fnote">Aún sin datos de zona.</p> : k.zonaTop.map(z => (
              <div className="tb-row" key={z.label}><span className="tb-lbl">{z.label}</span><div className="tb-bar lim"><i style={{ width: Math.max(4, z.n / maxZona * 100) + '%' }} /></div><b className="tb-n">{z.n}</b></div>
            ))}
          </section>
          <section className="sec">
            <h2>Demanda insatisfecha</h2>
            {k.insatTop.length === 0 ? <p className="fnote">Nada por ahora — o todas las búsquedas encuentran algo. 👍</p> : k.insatTop.map(i => (
              <div className="tb-row" key={i.label}><span className="tb-lbl" title={i.label}>{i.label}</span><div className="tb-bar" style={{ maxWidth: 60 }}><i style={{ width: '100%', background: '#ff8fa3' }} /></div><b className="tb-n">{i.n}</b></div>
            ))}
            <p className="fnote">Búsquedas que no encontraron inventario. Aquí ves qué construir o traer.</p>
          </section>
        </div>

        <section className="sec" style={{ marginTop: '1rem' }}>
          <h2>Desempeño por desarrollo</h2>
          {k.devRows.length === 0 ? <p className="fnote">Aún sin vistas/leads por desarrollo.</p> : (
            <div className="utbl-wrap"><table className="utbl"><thead><tr><th>Desarrollo</th><th>Vistas</th><th>Leads</th><th>Citas</th><th>Conv. vista→lead</th></tr></thead><tbody>
              {k.devRows.map(r => (
                <tr key={r.sku} onClick={() => router.push('/portal/' + r.sku)} style={{ cursor: 'pointer' }}>
                  <td><b>{r.nombre}</b></td><td>{r.vistas}</td><td>{r.leads}</td><td>{r.citas}</td>
                  <td>{r.conv != null ? <b style={{ color: 'var(--lime)' }}>{r.conv}%</b> : '—'}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>

        {k.avRows.length > 0 && (
          <section className="sec">
            <h2>Avisos · qué se lee</h2>
            {k.avRows.map(a => (
              <div className="tb-row" key={a.tipo}><span className="tb-lbl">{a.tipo}</span><div className="tb-bar mag"><i style={{ width: a.pct + '%' }} /></div><b className="tb-n">{a.pct}%</b></div>
            ))}
            <p className="fnote">% de cada tipo de aviso que el equipo ya leyó.</p>
          </section>
        )}
      </main>
    </>
  );
}
