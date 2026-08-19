'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';
import {
  meses, precioM2, pasaEntrega, ENTREGA_BUCKETS, creditosDe, cabeEnCredito,
  CREDITOS, AMENIDADES_CLAVE, VISTAS, PERSONAS, fitScore, mensualidadHipoteca, ingresoMinimo,
} from '../../lib/matching';
import { guardarCard } from '../../lib/clientcards';
import { track } from '../../lib/track';

const RECS = [['0', 'Loft'], ['1', '1'], ['2', '2'], ['3', '3+']];
const BANOS = [['1', '1+'], ['2', '2+'], ['3', '3+']];
const CAJONES = [['', 'Cualquiera'], ['1', '1+'], ['2', '2+']];
const EXT = [['balcon', '🌿 Balcón'], ['terraza', '☀️ Terraza'], ['roof', '🏙️ Roof privado']];
const PRESUP = [['', 'Sin tope'], ['2300000', '$2.3M'], ['3500000', '$3.5M'], ['4500000', '$4.5M'], ['6000000', '$6M'], ['9000000', '$9M']];
const PRESUP_MIN = [['', 'Sin mínimo'], ['2000000', '$2M'], ['3000000', '$3M'], ['4000000', '$4M'], ['5000000', '$5M']];
const SORTS = [['precio', 'Precio ↑'], ['precio_m2', 'Precio/m² ↑'], ['comision', 'Comisión ↓'], ['entrega', 'Entrega ↑'], ['match', 'Mejor match ↓']];

const F0 = { recs: [], banosMin: '', ext: [], presMax: '', presMin: '', precioM2Max: '', zona: '', colonia: '', entrega: '', cajonesMin: '', bodega: false, amenidades: [], creditos: [], comisionMin: '', depaMuestra: false, descuento: false, sort: 'precio' };

// Orden en que aflojamos filtros para no llegar a cero resultados.
const RELAJA = [['precioM2Max', 'precio/m²'], ['comisionMin', 'comisión'], ['cajonesMin', 'cajones'], ['bodega', 'bodega'], ['amenidades', 'amenidades'], ['descuento', 'promoción'], ['entrega', 'fecha de entrega']];

export default function Buscar() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState(null);
  const [f, setF] = useState(F0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ nombre: '', telefono: '', email: '', notas: '' });
  const [saved, setSaved] = useState(false);
  const [vistas, setVistas] = useState([]);       // vistas propias guardadas
  const [persona, setPersona] = useState(null);

  useEffect(() => { try { setVistas(JSON.parse(localStorage.getItem('qc_vistas') || '[]')); } catch { setVistas([]); } }, []);
  function guardarVista() {
    const nombre = (typeof window !== 'undefined') ? window.prompt('Nombre de la vista (ej. "2 rec Infonavit BJ")') : '';
    if (!nombre) return;
    const next = [...vistas.filter(v => v.nombre !== nombre), { nombre, f }];
    setVistas(next); try { localStorage.setItem('qc_vistas', JSON.stringify(next)); } catch { /* noop */ }
  }
  function aplicarVistaPropia(v) { setF({ ...F0, ...v.f }); }
  function borrarVista(nombre) { const next = vistas.filter(v => v.nombre !== nombre); setVistas(next); try { localStorage.setItem('qc_vistas', JSON.stringify(next)); } catch { /* noop */ } }

  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const toggleArr = (k, v) => setF(o => ({ ...o, [k]: o[k].includes(v) ? o[k].filter(x => x !== v) : [...o[k], v] }));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,torre,num_depto,rec,banos,n_estac,m2_hab,m2_total,precio,prototipo,bodega_m2,sku_bodega,tipo_estac,balcon_m2,terraza_m2,roof_m2,estatus').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
      // Restaurar facetas desde la URL (link compartible).
      try {
        const q = new URLSearchParams(window.location.search);
        if ([...q.keys()].length) {
          const next = { ...F0 };
          if (q.get('recs')) next.recs = q.get('recs').split(',');
          if (q.get('ext')) next.ext = q.get('ext').split(',');
          if (q.get('creditos')) next.creditos = q.get('creditos').split(',');
          if (q.get('amenidades')) next.amenidades = q.get('amenidades').split(',');
          ['presMax', 'presMin', 'banosMin', 'precioM2Max', 'zona', 'colonia', 'entrega', 'cajonesMin', 'comisionMin', 'sort'].forEach(k => { if (q.get(k)) next[k] = q.get(k); });
          ['bodega', 'depaMuestra', 'descuento'].forEach(k => { if (q.get(k) === '1') next[k] = true; });
          setF(next);
        }
      } catch { /* noop */ }
    })();
  }, [router]);

  const zonas = useMemo(() => devs ? [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort() : [], [devs]);
  const colonias = useMemo(() => devs && f.zona ? [...new Set(devs.filter(d => d.alcaldia === f.zona).map(d => d.colonia).filter(Boolean))].sort() : [], [devs, f.zona]);

  // Sincroniza la URL (sin recargar) para poder compartir el segmento.
  useEffect(() => {
    if (!devs) return;
    const q = new URLSearchParams();
    if (f.recs.length) q.set('recs', f.recs.join(','));
    if (f.ext.length) q.set('ext', f.ext.join(','));
    if (f.creditos.length) q.set('creditos', f.creditos.join(','));
    if (f.amenidades.length) q.set('amenidades', f.amenidades.join(','));
    ['presMax', 'presMin', 'banosMin', 'precioM2Max', 'zona', 'colonia', 'entrega', 'cajonesMin', 'comisionMin'].forEach(k => { if (f[k]) q.set(k, f[k]); });
    if (f.sort !== 'precio') q.set('sort', f.sort);
    ['bodega', 'depaMuestra', 'descuento'].forEach(k => { if (f[k]) q.set(k, '1'); });
    const s = q.toString();
    try { window.history.replaceState(null, '', s ? '?' + s : window.location.pathname); } catch { /* noop */ }
  }, [f, devs]);

  const criterios = useMemo(() => ({
    presupuestoMax: +f.presMax || null, presupuestoMin: +f.presMin || null, recs: f.recs,
    zonas: f.zona ? [f.zona] : [], entregaBucket: f.entrega, creditos: f.creditos,
    cajonesMin: +f.cajonesMin || 0, bodega: f.bodega, amenidades: f.amenidades,
  }), [f]);

  function creditoOk(u, d) {
    if (!f.creditos.length) return true;
    const cd = creditosDe(d);
    return f.creditos.some(k => cd.has(k) ||
      ((k === 'infonavit' || k === 'fovissste') && cabeEnCredito(u.precio, d, k === 'infonavit' ? 'Infonavit' : 'FOVISSSTE')));
  }
  function unitPasa(u, d, skip) {
    if (!skip.has('presMax') && f.presMax && u.precio > +f.presMax) return false;
    if (f.presMin && u.precio < +f.presMin) return false;
    if (f.recs.length) { const hit = f.recs.some(r => r === '3' ? u.rec >= 3 : u.rec === +r); if (!hit) return false; }
    if (f.banosMin && (Number(u.banos) || 0) < +f.banosMin) return false;
    // Exteriores con lógica O: si el broker marca balcón y terraza, pasa la unidad que tenga cualquiera.
    if (f.ext.length) {
      const has = { balcon: (u.balcon_m2 || 0) > 0, terraza: (u.terraza_m2 || 0) > 0, roof: (u.roof_m2 || 0) > 0 };
      if (!f.ext.some(k => has[k])) return false;
    }
    if (!skip.has('cajonesMin') && f.cajonesMin && (u.n_estac || 0) < +f.cajonesMin) return false;
    if (!skip.has('bodega') && f.bodega && !((u.bodega_m2 || 0) > 0 || u.sku_bodega)) return false;
    if (!skip.has('precioM2Max') && f.precioM2Max) { const pm = precioM2(u); if (pm == null || pm > +f.precioM2Max) return false; }
    if (!skip.has('creditos') && !creditoOk(u, d)) return false;
    return true;
  }
  function devPasa(d, skip) {
    if (f.zona && d.alcaldia !== f.zona) return false;
    if (f.colonia && d.colonia !== f.colonia) return false;
    if (!skip.has('entrega') && !pasaEntrega(f.entrega, d)) return false;
    if (!skip.has('comisionMin') && f.comisionMin && Math.round((d.comision_broker || 0) * 100) < +f.comisionMin) return false;
    if (f.depaMuestra && !/s/i.test(d.depa_muestra || '')) return false;
    if (!skip.has('descuento') && f.descuento && !(d.descuentos && String(d.descuentos).trim())) return false;
    if (!skip.has('amenidades') && f.amenidades.length) {
      const am = (d.amenidades || '').toLowerCase();
      if (!f.amenidades.every(a => am.includes(a.toLowerCase()))) return false;
    }
    return true;
  }

  const activo = f.recs.length || f.banosMin || f.ext.length || f.presMax || f.presMin || f.precioM2Max || f.zona || f.colonia || f.entrega || f.cajonesMin || f.bodega || f.amenidades.length || f.creditos.length || f.comisionMin || f.depaMuestra || f.descuento;

  const { grupos, relajado, totalU } = useMemo(() => {
    if (!devs || !units) return { grupos: [], relajado: null, totalU: 0 };
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const run = (skip) => units.filter(u => { const d = byId[u.dev_sku]; return d && devPasa(d, skip) && unitPasa(u, d, skip); });
    let skip = new Set(), ok = run(skip), relajado = null;
    // Anti cero-resultados: afloja el filtro más débil hasta encontrar algo.
    if (ok.length === 0 && activo) {
      for (const [k, label] of RELAJA) {
        if (!f[k] || (Array.isArray(f[k]) && !f[k].length)) continue;
        skip = new Set([...skip, k]); const r = run(skip);
        if (r.length) { ok = r; relajado = label; break; }
      }
    }
    const g = {};
    ok.forEach(u => { const d = byId[u.dev_sku]; const f2 = fitScore(u, d, criterios); (g[u.dev_sku] = g[u.dev_sku] || { d, us: [], best: 0 }); g[u.dev_sku].us.push({ ...u, _fit: f2.score }); g[u.dev_sku].best = Math.max(g[u.dev_sku].best, f2.score); });
    let arr = Object.values(g).map(({ d, us, best }) => {
      us.sort((a, b) => a.precio - b.precio);
      const min = us[0].precio, max = us[us.length - 1].precio;
      const pms = us.map(precioM2).filter(Boolean);
      return {
        d, us, best,
        min, max,
        pm2: pms.length ? Math.min(...pms) : null,
        comPct: Math.round((d.comision_broker || 0) * 100),
        comMonto: d.comision_broker ? Math.round(d.comision_broker * min) : null,
        mens: mensualidadHipoteca(min, d),
        ingreso: ingresoMinimo(min, d),
        m: meses(d.fecha_entrega),
      };
    });
    const s = f.sort;
    arr.sort((a, b) =>
      s === 'precio_m2' ? (a.pm2 || 9e9) - (b.pm2 || 9e9) :
      s === 'comision' ? (b.comMonto || 0) - (a.comMonto || 0) :
      s === 'entrega' ? (a.m ?? 999) - (b.m ?? 999) :
      s === 'match' ? b.best - a.best :
      a.min - b.min);
    return { grupos: arr, relajado, totalU: ok.length };
  }, [devs, units, f, criterios, activo]);

  // Conteos por faceta (recámaras) respetando los demás filtros.
  const recCounts = useMemo(() => {
    if (!devs || !units) return {};
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const out = {};
    RECS.forEach(([v]) => {
      out[v] = units.filter(u => {
        const d = byId[u.dev_sku]; if (!d || !devPasa(d, new Set())) return false;
        const hit = v === '3' ? u.rec >= 3 : u.rec === +v; if (!hit) return false;
        // aplica los demás filtros de unidad salvo recámaras
        if (f.presMax && u.precio > +f.presMax) return false;
        if (f.cajonesMin && (u.n_estac || 0) < +f.cajonesMin) return false;
        if (f.bodega && !((u.bodega_m2 || 0) > 0 || u.sku_bodega)) return false;
        if (!creditoOk(u, d)) return false;
        return true;
      }).length;
    });
    return out;
  }, [devs, units, f]);

  // Registra la búsqueda (con debounce) para métricas y demanda insatisfecha.
  useEffect(() => {
    if (!activo || !me) return;
    const t = setTimeout(() => track('busqueda', { fuente: 'buscar', criterios: { recs: f.recs, zona: f.zona, presMax: f.presMax, creditos: f.creditos, amenidades: f.amenidades }, resultados: totalU }, me), 1500);
    return () => clearTimeout(t);
  }, [f, totalU, activo]);

  function aplicarVista(v) {
    setF(o => ({ ...F0, sort: v.sort || 'precio', ...v.patch, recs: v.patch.recs || [], creditos: v.patch.creditos || [], amenidades: v.patch.amenidades || [] }));
  }

  async function onSave() {
    const r = await guardarCard({ ...criterios, ...saveForm });
    if (!r.error) { setSaved(true); setTimeout(() => { setSaveOpen(false); setSaved(false); setSaveForm({ nombre: '', telefono: '', email: '', notas: '' }); }, 1200); }
  }

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  return (
    <>
      <Nav me={me} current="/buscar" logo="Buscador inteligente" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>¿Qué busca tu cliente?</h1>
          <p>Define sus criterios y te digo qué le queda de {devs.length} desarrollos y {units.length.toLocaleString('es-MX')} unidades disponibles — con mensualidad, ingreso mínimo y comisión ya calculados.</p>
        </div>

        {/* Vistas inteligentes */}
        <div className="vistas">
          {VISTAS.map(v => <button key={v.id} className="vista" onClick={() => aplicarVista(v)}><i>{v.icon}</i>{v.label}</button>)}
        </div>

        {/* Personas: perfil de cliente + pitch sugerido */}
        <div className="pers-row">
          <span className="pers-lbl">Perfil:</span>
          {PERSONAS.map(p => <button key={p.id} className={'chip' + (persona?.id === p.id ? ' on' : '')} onClick={() => setPersona(persona?.id === p.id ? null : p)}>{p.label}</button>)}
        </div>
        {persona && <div className="pers-pitch">💡 <b>{persona.label}:</b> {persona.pitch}</div>}

        {/* Vistas propias guardadas */}
        {vistas.length > 0 && (
          <div className="saved-row">
            <span className="pers-lbl">Mis vistas:</span>
            {vistas.map(v => (
              <span key={v.nombre} className="saved-chip">
                <button onClick={() => aplicarVistaPropia(v)}>{v.nombre}</button>
                <i onClick={() => borrarVista(v.nombre)}>✕</i>
              </span>
            ))}
          </div>
        )}

        {/* Facetas */}
        <div className="crit">
          <div className="crit-row"><label>Recámaras</label>
            <div className="crit-chips">{RECS.map(([v, l]) => <span key={v} className={'chip' + (f.recs.includes(v) ? ' on' : '')} onClick={() => toggleArr('recs', v)}>{l}{recCounts[v] != null && <em className="chip-n">{recCounts[v]}</em>}</span>)}</div>
          </div>
          <div className="crit-row"><label>Baños</label>
            <div className="crit-chips">{BANOS.map(([v, l]) => <span key={v} className={'chip' + (f.banosMin === v ? ' on' : '')} onClick={() => set('banosMin', f.banosMin === v ? '' : v)}>{l}</span>)}</div>
          </div>
          <div className="crit-row"><label>Exteriores</label>
            <div className="crit-chips">{EXT.map(([v, l]) => <span key={v} className={'chip' + (f.ext.includes(v) ? ' on' : '')} onClick={() => toggleArr('ext', v)}>{l}</span>)}
              {f.ext.length > 1 && <span className="crit-nota">cualquiera de los marcados</span>}
            </div>
          </div>
          <div className="crit-row"><label>Presupuesto desde</label>
            <div className="crit-chips">{PRESUP_MIN.map(([v, l]) => <span key={v} className={'chip' + (f.presMin === v ? ' on' : '')} onClick={() => set('presMin', v)}>{l}</span>)}</div>
          </div>
          <div className="crit-row"><label>Presupuesto máx.</label>
            <div className="crit-chips">{PRESUP.map(([v, l]) => <span key={v} className={'chip' + (f.presMax === v ? ' on' : '')} onClick={() => set('presMax', v)}>{l}</span>)}</div>
          </div>
          <div className="crit-row"><label>Entrega</label>
            <div className="crit-chips">
              <span className={'chip' + (f.entrega === '' ? ' on' : '')} onClick={() => set('entrega', '')}>Cualquiera</span>
              {ENTREGA_BUCKETS.map(([v, l]) => <span key={v} className={'chip' + (f.entrega === v ? ' on' : '')} onClick={() => set('entrega', v)}>{l}</span>)}
            </div>
          </div>
          <div className="crit-row"><label>Cajones</label>
            <div className="crit-chips">{CAJONES.map(([v, l]) => <span key={v} className={'chip' + (f.cajonesMin === v ? ' on' : '')} onClick={() => set('cajonesMin', v)}>{l}</span>)}
              <span className={'chip' + (f.bodega ? ' on' : '')} onClick={() => set('bodega', !f.bodega)}>📦 Con bodega</span>
            </div>
          </div>
          <div className="crit-row"><label>Créditos</label>
            <div className="crit-chips">{CREDITOS.map(([k, l]) => <span key={k} className={'chip' + (f.creditos.includes(k) ? ' on' : '')} onClick={() => toggleArr('creditos', k)}>{l}</span>)}</div>
          </div>
          <div className="crit-row"><label>Amenidades</label>
            <div className="crit-chips">{AMENIDADES_CLAVE.map(([k, l]) => <span key={k} className={'chip' + (f.amenidades.includes(l) ? ' on' : '')} onClick={() => toggleArr('amenidades', l)}>{l}</span>)}</div>
          </div>
          <div className="crit-row"><label>Zona</label>
            <select value={f.zona} onChange={e => { set('zona', e.target.value); set('colonia', ''); }} className="crit-sel">
              <option value="">Cualquier alcaldía</option>{zonas.map(z => <option key={z}>{z}</option>)}
            </select>
            {colonias.length > 0 && <select value={f.colonia} onChange={e => set('colonia', e.target.value)} className="crit-sel">
              <option value="">Cualquier colonia</option>{colonias.map(z => <option key={z}>{z}</option>)}
            </select>}
          </div>
          <div className="crit-row"><label>Extras</label>
            <div className="crit-chips">
              <span className={'chip' + (f.comisionMin === '4' ? ' on' : '')} onClick={() => set('comisionMin', f.comisionMin === '4' ? '' : '4')}>💰 Comisión ≥ 4%</span>
              <span className={'chip' + (f.depaMuestra ? ' on' : '')} onClick={() => set('depaMuestra', !f.depaMuestra)}>🏠 Depa muestra</span>
              <span className={'chip' + (f.descuento ? ' on' : '')} onClick={() => set('descuento', !f.descuento)}>🔻 Con promoción</span>
              <select value={f.precioM2Max} onChange={e => set('precioM2Max', e.target.value)} className="crit-sel sm">
                <option value="">Precio/m² máx.</option><option value="60000">≤ $60k/m²</option><option value="80000">≤ $80k/m²</option><option value="100000">≤ $100k/m²</option>
              </select>
            </div>
          </div>
          <div className="crit-row crit-foot">
            <div className="crit-chips"><label style={{ minWidth: 0 }}>Ordenar</label>{SORTS.map(([v, l]) => <span key={v} className={'chip' + (f.sort === v ? ' on' : '')} onClick={() => set('sort', v)}>{l}</span>)}</div>
            {activo && <button className="crit-clear" onClick={guardarVista}>☆ Guardar vista</button>}
            {activo && <button className="crit-clear" onClick={() => setF(F0)}>Limpiar</button>}
          </div>
        </div>

        {/* Acciones sobre el criterio */}
        {activo && (
          <div className="res-head">
            <div><b>{totalU}</b> unidad{totalU === 1 ? '' : 'es'} en <b>{grupos.length}</b> desarrollo{grupos.length === 1 ? '' : 's'}{relajado && <span className="relaja"> · aflojé <b>{relajado}</b> para no dejarte sin resultados</span>}</div>
            <button className="btn lim sm" onClick={() => setSaveOpen(true)}>💾 Guardar como cliente</button>
          </div>
        )}

        {!activo ? (
          <EmptyState icon="🔎" title="Empieza por lo esencial">
            Elige recámaras y presupuesto, o toca una vista inteligente arriba — con eso ya te muestro las mejores opciones para tu cliente, con match %.
          </EmptyState>
        ) : totalU === 0 ? (
          <EmptyState icon="🤔" title="Nada encaja">Prueba subir el presupuesto o quitar alguna amenidad.</EmptyState>
        ) : (
          <div className="res-grid">
            {grupos.map(({ d, us, best, min, max, pm2, comPct, comMonto, mens, ingreso, m }) => (
              <article className="match" key={d.sku} onClick={() => router.push('/portal/' + d.sku)}>
                <div className="match-h">
                  <div><h3>{d.nombre}</h3><span className="loc">📍 {d.colonia}, {d.alcaldia}</span></div>
                  {best > 0 && <span className={'fit ' + (best >= 80 ? 'hi' : best >= 55 ? 'mid' : 'lo')}>{best}%</span>}
                </div>
                <div className="match-price">{min === max ? MXN(min) : `${MXN(min)} – ${MXN(max)}`}</div>
                <div className="match-calc">
                  <span title="Mensualidad hipotecaria estimada">🏦 ~{MXN(mens)}/mes</span>
                  <span title="Ingreso mensual mínimo para calificar">💵 ingreso {MXN(ingreso)}</span>
                  {pm2 && <span title="Precio por m² desde">📐 {MXN(pm2)}/m²</span>}
                </div>
                <div className="match-meta">
                  <span>{d.etapa === 'Entrega inmediata' ? '⚡ Inmediata' : (m != null ? `🕑 ${m} meses` : 'Preventa')}</span>
                  {us.length <= 3 ? <span className="escaso">🔥 Solo {us.length}</span> : <span>🏠 {us.length} disp.</span>}
                  {comMonto ? <span className="lim">💰 {comPct}% · {MXN(comMonto)}</span> : (comPct ? <span className="lim">💰 {comPct}%</span> : null)}
                </div>
                <div className="match-foot"><span>Ver desarrollo →</span></div>
              </article>
            ))}
          </div>
        )}

        {/* Guardar como client card */}
        {saveOpen && (
          <>
            <div className="drawer-bg" onClick={() => setSaveOpen(false)} />
            <aside className="drawer rc" onClick={e => e.stopPropagation()}>
              <div className="dw-h"><div><span className="dw-tag">Nuevo cliente</span><h2>Guardar esta búsqueda</h2></div><button className="x" onClick={() => setSaveOpen(false)}>✕</button></div>
              <p className="fnote" style={{ marginTop: 0 }}>Guardamos los criterios de tu cliente. Cuando entre o cambie inventario, te avisamos qué le queda (reverse matching) desde <b>Clientes</b>.</p>
              <label className="lbl">Nombre del cliente</label>
              <input className="inp" value={saveForm.nombre} onChange={e => setSaveForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Ej. Laura Méndez" />
              <div className="row2">
                <div><label className="lbl">Teléfono</label><input className="inp" value={saveForm.telefono} onChange={e => setSaveForm(s => ({ ...s, telefono: e.target.value }))} placeholder="55…" /></div>
                <div><label className="lbl">Correo</label><input className="inp" value={saveForm.email} onChange={e => setSaveForm(s => ({ ...s, email: e.target.value }))} placeholder="cliente@correo.com" /></div>
              </div>
              <label className="lbl">Notas</label>
              <textarea className="inp" rows={2} value={saveForm.notas} onChange={e => setSaveForm(s => ({ ...s, notas: e.target.value }))} placeholder="Contexto, urgencia, etc." />
              <div className="crit-resumen">Criterios: {f.recs.length ? f.recs.join('/') + ' rec · ' : ''}{f.presMax ? 'hasta ' + MXN(+f.presMax) + ' · ' : ''}{f.zona || 'cualquier zona'}{f.creditos.length ? ' · ' + f.creditos.join('/') : ''}</div>
              <button className="btn lim block" onClick={onSave} disabled={saved}>{saved ? '✓ Guardado' : 'Guardar cliente'}</button>
            </aside>
          </>
        )}
      </main>
    </>
  );
}
