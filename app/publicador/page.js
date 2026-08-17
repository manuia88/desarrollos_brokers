'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { resolverReglas, ordenar } from '../../lib/publicador';

const AMBITOS = [['dev', 'Por desarrollo'], ['prototipo', 'Por prototipo'], ['global', 'Global']];
const RECS = [['', 'Todas'], ['0', 'Loft'], ['1', '1'], ['2', '2'], ['3', '3+']];
const PUNTOS = [['todas', 'Todas'], ['min', 'Mínimo'], ['mid', 'Medio'], ['max', 'Máximo']];

const PRESETS = [
  ['Todo el inventario', [{ ambito: 'global', rec: '', puntos: ['todas'] }]],
  ['1 por prototipo (más barata)', [{ ambito: 'prototipo', rec: '', puntos: ['min'] }]],
  ['Mín y máx por prototipo', [{ ambito: 'prototipo', rec: '', puntos: ['min', 'max'] }]],
  ['2 y 3 rec (mín+máx) por desarrollo', [{ ambito: 'dev', rec: '2', puntos: ['min', 'max'] }, { ambito: 'dev', rec: '3', puntos: ['min', 'max'] }]],
];
const ORDENES = [['precio', 'Precio ↑'], ['comision', 'Mayor comisión'], ['dias', 'Más días en inventario']];
// Objetivos de negocio: arman base + reglas + orden de un jalón.
const OBJETIVOS = [
  { label: '💰 Máxima comisión', base: {}, reglas: [{ ambito: 'prototipo', rec: '', puntos: ['min'] }], orden: 'comision' },
  { label: '🐌 Mover lo estancado', base: {}, reglas: [{ ambito: 'prototipo', rec: '', puntos: ['min', 'max'] }], orden: 'dias' },
  { label: '⚡ Entrega inmediata', base: { etapa: 'Entrega inmediata' }, reglas: [{ ambito: 'prototipo', rec: '', puntos: ['todas'] }], orden: 'precio' },
  { label: '🔻 Con promoción', base: { descuento: true }, reglas: [{ ambito: 'prototipo', rec: '', puntos: ['min'] }], orden: 'precio' },
];

export default function Publicador() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [token, setToken] = useState('');
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [ebOk, setEbOk] = useState(null);
  const [run, setRun] = useState(null);
  const [base, setBase] = useState({ devs: [], zona: '', prototipos: [], precioMin: '', precioMax: '' });
  const [reglas, setReglas] = useState([{ ambito: 'dev', rec: '2', puntos: ['min', 'max'] }, { ambito: 'dev', rec: '3', puntos: ['min', 'max'] }]);
  const [status, setStatus] = useState('not_published');
  const [limite, setLimite] = useState(30);
  const [orden, setOrden] = useState('precio');
  const [campanas, setCampanas] = useState([]);
  const [campNombre, setCampNombre] = useState('');
  const [reponer, setReponer] = useState(true);

  const setB = (k, v) => setBase(o => ({ ...o, [k]: v }));
  const togB = (k, v) => setBase(o => ({ ...o, [k]: o[k].includes(v) ? o[k].filter(x => x !== v) : [...o[k], v] }));
  const setRegla = (i, patch) => setReglas(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const togPunto = (i, p) => setReglas(rs => rs.map((r, j) => {
    if (j !== i) return r;
    if (p === 'todas') return { ...r, puntos: ['todas'] };
    let pts = (r.puntos || []).filter(x => x !== 'todas');
    pts = pts.includes(p) ? pts.filter(x => x !== p) : [...pts, p];
    return { ...r, puntos: pts.length ? pts : ['todas'] };
  }));

  async function cargarPubs() { const { data } = await supabase.from('publicaciones').select('*').order('actualizado', { ascending: false }).limit(100); setPubs(data || []); }
  async function cargarCampanas() { const { data } = await supabase.from('campanas').select('*').order('creado', { ascending: false }); setCampanas(data || []); }
  async function reconciliar(id) {
    setRun({ loading: true });
    try {
      const r = await fetch('/api/integraciones/reconciliar', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { campana_id: id } : {}) });
      setRun(await r.json()); cargarPubs(); cargarCampanas();
    } catch (e) { setRun({ error: String(e?.message || e) }); }
  }
  async function guardarCampana() {
    const { data, error } = await supabase.from('campanas').insert({ org_id: me.org_id, portal: 'easybroker', nombre: campNombre || ('Campaña ' + (campanas.length + 1)), base, reglas, status, reponer, limite, orden, activa: true }).select('id').single();
    if (error) { setRun({ error: error.message }); return; }
    setCampNombre(''); await cargarCampanas();
    reconciliar(data.id);   // primer llenado
  }
  async function toggleCampana(id, patch) { await supabase.from('campanas').update(patch).eq('id', id); cargarCampanas(); }
  async function borrarCampana(id) { await supabase.from('campanas').update({ activa: false }).eq('id', id); cargarCampanas(); }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      if (prof?.rol !== 'super_admin') { router.replace('/portal'); return; }
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      setToken(session.access_token);
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('sku,nombre,alcaldia').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,rec,banos,n_estac,m2_hab,precio,prototipo,torre,num_depto,estatus').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
      await cargarPubs(); await cargarCampanas();
      try { const r = await fetch('/api/integraciones/status', { headers: { Authorization: 'Bearer ' + session.access_token } }); const j = await r.json(); setEbOk(j?.estado?.easybroker?.configured); } catch { setEbOk(false); }
    })();
  }, [router]);

  const zonas = useMemo(() => devs ? [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort() : [], [devs]);
  const prototipos = useMemo(() => {
    const src = base.devs.length ? units.filter(u => base.devs.includes(u.dev_sku)) : units;
    return [...new Set(src.map(u => u.prototipo).filter(Boolean))].sort();
  }, [units, base.devs]);
  const byId = useMemo(() => Object.fromEntries((devs || []).map(d => [d.sku, d])), [devs]);

  const seleccion = useMemo(() => ordenar(resolverReglas(units, byId, base, reglas), byId, orden), [units, byId, base, reglas, orden]);
  const preview = useMemo(() => {
    const porDev = {}; seleccion.forEach(u => { (porDev[u.dev_sku] = porDev[u.dev_sku] || []).push(u); });
    return { total: seleccion.length, devs: Object.keys(porDev).length, porDev };
  }, [seleccion]);

  async function publicar() {
    setRun({ loading: true });
    try {
      const r = await fetch('/api/integraciones/publicar', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal: 'easybroker', status, limite, orden, base, reglas }),
      });
      setRun(await r.json()); cargarPubs();
    } catch (e) { setRun({ error: String(e?.message || e) }); }
  }

  if (devs === null) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/publicador" logo="Publicador" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Publicar inventario en portales</h1>
          <p>Arma reglas hipersegmentadas — por desarrollo, prototipo o global; por recámaras; y por punto de precio (mínimo, medio, máximo o todas) — y publícalo en EasyBroker.</p>
        </div>

        {ebOk === false && <div className="cap-msg err">EasyBroker no está configurado. Agrega <code>EASYBROKER_API_KEY</code> en Vercel y haz redeploy. Puedes armar y previsualizar la selección igual.</div>}

        {/* Filtros base */}
        <div className="crit">
          <div className="crit-row"><label>Desarrollos</label>
            <div className="crit-chips scroll">
              <span className={'chip' + (base.devs.length === 0 ? ' on' : '')} onClick={() => setB('devs', [])}>Todos</span>
              {devs.map(d => <span key={d.sku} className={'chip' + (base.devs.includes(d.sku) ? ' on' : '')} onClick={() => togB('devs', d.sku)}>{d.nombre}</span>)}
            </div>
          </div>
          {prototipos.length > 0 && <div className="crit-row"><label>Prototipo</label>
            <div className="crit-chips scroll">{prototipos.map(p => <span key={p} className={'chip' + (base.prototipos.includes(p) ? ' on' : '')} onClick={() => togB('prototipos', p)}>{p}</span>)}</div>
          </div>}
          <div className="crit-row"><label>Zona y precio</label>
            <select className="crit-sel" value={base.zona} onChange={e => setB('zona', e.target.value)}><option value="">Cualquier zona</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
            <input className="inp" style={{ maxWidth: 150 }} inputMode="decimal" value={base.precioMin} onChange={e => setB('precioMin', e.target.value)} placeholder="Precio mín." />
            <input className="inp" style={{ maxWidth: 150 }} inputMode="decimal" value={base.precioMax} onChange={e => setB('precioMax', e.target.value)} placeholder="Precio máx." />
          </div>
        </div>

        {/* Objetivos de negocio */}
        <div className="crit" style={{ marginTop: '1rem' }}>
          <div className="crit-row"><label>Objetivo</label>
            <div className="crit-chips">{OBJETIVOS.map(o => <span key={o.label} className="chip" onClick={() => { setBase(b => ({ ...b, ...o.base })); setReglas(o.reglas.map(x => ({ ...x }))); setOrden(o.orden); }}>{o.label}</span>)}</div>
          </div>
          <div className="crit-row"><label>Priorizar slots por</label>
            <div className="crit-chips">{ORDENES.map(([v, l]) => <span key={v} className={'chip' + (orden === v ? ' on' : '')} onClick={() => setOrden(v)}>{l}</span>)}</div>
          </div>
        </div>

        {/* Recetas / reglas */}
        <div className="reglas">
          <div className="reglas-head">
            <h2>Reglas de selección</h2>
            <div className="reglas-presets">{PRESETS.map(([l, r]) => <button key={l} className="chip" onClick={() => setReglas(r.map(x => ({ ...x })))}>{l}</button>)}</div>
          </div>
          {reglas.map((r, i) => (
            <div className="regla" key={i}>
              <select className="inp sm" value={r.ambito} onChange={e => setRegla(i, { ambito: e.target.value })}>{AMBITOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <select className="inp sm" value={r.rec} onChange={e => setRegla(i, { rec: e.target.value })}>{RECS.map(([v, l]) => <option key={v} value={v}>{l === 'Todas' ? 'Todas las rec' : l}</option>)}</select>
              <div className="crit-chips">{PUNTOS.map(([v, l]) => <span key={v} className={'chip' + ((r.puntos || []).includes(v) ? ' on' : '')} onClick={() => togPunto(i, v)}>{l}</span>)}</div>
              {reglas.length > 1 && <button className="regla-x" onClick={() => setReglas(rs => rs.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => setReglas(rs => [...rs, { ambito: 'dev', rec: '', puntos: ['min'] }])}>+ Agregar regla</button>
          <p className="fnote">Cada regla suma unidades a la selección (sin duplicar). Ej: “2 rec · mínimo y máximo · por desarrollo” + “3 rec · mínimo y máximo · por desarrollo” = 4 listados por desarrollo.</p>
        </div>

        {/* Vista previa + publicar */}
        <div className="pub-bar">
          <div className="pub-cnt"><b>{preview.total}</b> listado{preview.total === 1 ? '' : 's'}<span> · en {preview.devs} desarrollo{preview.devs === 1 ? '' : 's'}{preview.total > limite ? ` · se subirán ${limite} por corrida` : ''}</span></div>
          <div className="pub-opts">
            <span className={'chip' + (status === 'not_published' ? ' on' : '')} onClick={() => setStatus('not_published')}>Borrador</span>
            <span className={'chip' + (status === 'published' ? ' on' : '')} onClick={() => setStatus('published')}>Publicado</span>
            <label className="fnote" style={{ margin: 0 }}>Máx: <input className="inp" style={{ width: 64, display: 'inline-block' }} inputMode="numeric" value={limite} onChange={e => setLimite(+e.target.value.replace(/[^0-9]/g, '') || 1)} /></label>
            <button className="btn mag" disabled={run?.loading || preview.total === 0} onClick={publicar}>{run?.loading ? 'Publicando…' : '🚀 Publicar'}</button>
          </div>
        </div>

        {run && !run.loading && (run.error
          ? <div className="cap-msg err">{run.error}</div>
          : run.detalle
            ? <div className="cap-msg ok">Reconcilié {run.campanas} campaña(s). {run.detalle.map(x => `${x.campana}: +${x.subidos}/-${x.bajados}`).join(' · ')}</div>
            : <div className={'cap-msg ' + (run.errores ? 'err' : 'ok')}>Intentos: {run.intentos} · Publicados: {run.publicados} · Errores: {run.errores}{run.detalles?.find(d => d.error) ? ` · ej: ${run.detalles.find(d => d.error).error}` : ''}</div>)}

        {/* Guardar como campaña viva */}
        <div className="camp-save">
          <label className="pub-opts" style={{ margin: 0 }}><input type="checkbox" checked={reponer} onChange={e => setReponer(e.target.checked)} style={{ accentColor: 'var(--mag)' }} /> Reponer automáticamente (rellenar el hueco cuando algo se venda)</label>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
            <input className="inp" style={{ maxWidth: 260 }} value={campNombre} onChange={e => setCampNombre(e.target.value)} placeholder="Nombre de la campaña (ej. EB · mín y máx)" />
            <button className="btn lim" onClick={guardarCampana} disabled={seleccion.length === 0}>💾 Guardar como campaña viva</button>
          </div>
          <p className="fnote" style={{ marginTop: '.4rem' }}>Una campaña mantiene tus anuncios alineados con la receta: si una unidad se vende o aparta, se baja del portal y {reponer ? 'sube la siguiente que cumple la misma regla (si ya no hay, deja el hueco vacío).' : 'NO se repone (queda el hueco).'} Se reconcilia sola cada 30 min.</p>
        </div>

        {campanas.length > 0 && (
          <section className="sec" style={{ marginTop: '1.2rem' }}>
            <h2>Campañas vivas</h2>
            {campanas.map(c => (
              <div className="camp" key={c.id}>
                <div className="camp-main">
                  <b>{c.nombre}</b>
                  <span className="camp-sub">{c.portal} · {(c.reglas || []).length} regla(s) · {c.status === 'published' ? 'publicado' : 'borrador'} · máx {c.limite}</span>
                </div>
                <label className="camp-tog"><input type="checkbox" checked={c.reponer} onChange={e => toggleCampana(c.id, { reponer: e.target.checked })} /> repone</label>
                <label className="camp-tog"><input type="checkbox" checked={c.activa} onChange={e => toggleCampana(c.id, { activa: e.target.checked })} /> activa</label>
                <button className="cotiz-mini" onClick={() => reconciliar(c.id)}>Reconciliar</button>
                <button className="regla-x" onClick={() => borrarCampana(c.id)}>✕</button>
              </div>
            ))}
          </section>
        )}

        {/* Desglose de la selección */}
        {preview.total > 0 && (
          <details className="sec" style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver qué se va a publicar ({preview.total})</summary>
            <div style={{ marginTop: '.7rem' }}>{Object.entries(preview.porDev).map(([sku, us]) => (
              <div className="pv-dev" key={sku}>
                <b>{byId[sku]?.nombre || sku}</b>
                <div className="pv-us">{us.slice().sort((a, b) => a.rec - b.rec || a.precio - b.precio).map(u => (
                  <span key={u.sku} className="pv-u">{u.rec === 0 ? 'Loft' : u.rec + ' rec'} · ${Math.round(u.precio).toLocaleString('es-MX')} <em>{u.prototipo}</em></span>
                ))}</div>
              </div>
            ))}</div>
          </details>
        )}

        {pubs.length > 0 && (
          <section className="sec" style={{ marginTop: '1.2rem' }}>
            <h2>Ya publicado</h2>
            <div className="utbl-wrap"><table className="utbl"><thead><tr><th>Portal</th><th>Referencia</th><th>Desarrollo</th><th>Estatus</th><th>ID externo</th><th>Actualizado</th></tr></thead><tbody>
              {pubs.map(p => (
                <tr key={p.id}>
                  <td>{p.portal}</td><td>{p.ref}</td><td>{byId[p.dev_sku]?.nombre || p.dev_sku || '—'}</td>
                  <td><span className={'ap-badge ' + (p.estatus === 'publicado' ? 'es' : p.estatus === 'error' ? 'cx' : 'ap')}>{p.estatus}</span></td>
                  <td>{p.external_id || '—'}</td>
                  <td>{new Date(p.actualizado).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
            </tbody></table></div>
          </section>
        )}
      </main>
    </>
  );
}
