'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';
import { meses, fitScore, parseConsulta, mensualidadHipoteca, ingresoMinimo, precioM2, yieldBruto } from '../../lib/matching';

const EJEMPLOS = ['$3.5M, 2 recámaras, Cuauhtémoc, Infonavit', 'Loft entrega inmediata con roof garden', '2 cajones y bodega hasta 6 millones', 'Preventa Benito Juárez 3 recámaras bancario'];

export default function Comparar() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState([]);
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [cmp, setCmp] = useState([]); // skus a comparar

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('*').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
    })();
  }, [router]);

  const zonas = useMemo(() => devs ? [...new Set(devs.flatMap(d => [d.alcaldia, d.colonia]).filter(Boolean))] : [], [devs]);
  const byId = useMemo(() => Object.fromEntries((devs || []).map(d => [d.sku, d])), [devs]);

  function buscar(q) {
    const txt = q ?? texto;
    if (!txt.trim()) { setConsulta(null); return; }
    setConsulta(parseConsulta(txt, zonas));
  }

  const ranked = useMemo(() => {
    if (!consulta || !devs) return [];
    return units.map(u => { const d = byId[u.dev_sku]; if (!d) return null; const f = fitScore(u, d, consulta.crit); return { u, d, score: f.score, reasons: f.reasons }; })
      .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
  }, [consulta, units, byId, devs]);

  function toggleCmp(sku) { setCmp(c => c.includes(sku) ? c.filter(x => x !== sku) : (c.length >= 3 ? c : [...c, sku])); }
  const comparados = useMemo(() => cmp.map(sku => { const u = units.find(x => x.sku === sku); return u ? { u, d: byId[u.dev_sku] } : null; }).filter(Boolean), [cmp, units, byId]);

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  const filas = [
    ['Precio', o => MXN(o.u.precio)],
    ['Mensualidad estimada', o => '~' + MXN(mensualidadHipoteca(o.u.precio, o.d)) + '/mes'],
    ['Ingreso mínimo', o => MXN(ingresoMinimo(o.u.precio, o.d))],
    ['Precio / m²', o => { const p = precioM2(o.u); return p ? MXN(p) : '—'; }],
    ['Recámaras', o => o.u.rec === 0 ? 'Loft' : o.u.rec],
    ['Baños', o => o.u.banos ?? '—'],
    ['m² habitables', o => o.u.m2_hab ?? '—'],
    ['Estacionamientos', o => o.u.n_estac || '—'],
    ['Bodega', o => (o.u.bodega_m2 > 0 || o.u.sku_bodega) ? 'Sí' : '—'],
    ['Yield bruto est.', o => yieldBruto(o.u.precio) + '%'],
    ['Comisión', o => o.d.comision_broker ? Math.round(o.d.comision_broker * 100) + '% · ' + MXN(Math.round(o.d.comision_broker * o.u.precio)) : '—'],
    ['Entrega', o => o.d.etapa === 'Entrega inmediata' ? 'Inmediata' : (meses(o.d.fecha_entrega) != null ? meses(o.d.fecha_entrega) + ' meses' : 'Preventa')],
    ['Zona', o => `${o.d.colonia}, ${o.d.alcaldia}`],
  ];
  const mejorPrecio = comparados.length ? Math.min(...comparados.map(o => o.u.precio)) : null;

  return (
    <>
      <Nav me={me} current="/comparar" logo="Comparar & Matcher IA" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Descríbeme a tu cliente</h1>
          <p>Escríbelo como lo dirías: presupuesto, recámaras, zona, crédito… y te rankeo el inventario por compatibilidad. Luego compara las finalistas lado a lado.</p>
        </div>

        <div className="mia-box">
          <textarea className="mia-input" rows={2} value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) buscar(); }}
            placeholder="Ej. $3.5M, 2 recámaras en Cuauhtémoc, con Infonavit y un cajón" />
          <button className="btn mag" onClick={() => buscar()}>Buscar matches</button>
        </div>
        <div className="mia-ej">{EJEMPLOS.map(e => <button key={e} className="chip" onClick={() => { setTexto(e); buscar(e); }}>{e}</button>)}</div>

        {consulta && (
          <>
            <div className="mia-entendi">
              <span>Entendí:</span>
              {consulta.chips.length ? consulta.chips.map((c, i) => <span key={i} className="chip on">{c}</span>) : <em className="fnote">No detecté criterios claros — intenta con presupuesto y recámaras.</em>}
            </div>

            {ranked.length === 0 ? <EmptyState icon="🤔" title="Sin coincidencias">Prueba subir el presupuesto o cambiar la zona.</EmptyState> : (
              <div className="mia-list">
                {ranked.map(({ u, d, score }) => (
                  <div className={'mia-row' + (cmp.includes(u.sku) ? ' sel' : '')} key={u.sku}>
                    <span className={'fit ' + (score >= 80 ? 'hi' : score >= 55 ? 'mid' : 'lo')}>{score}%</span>
                    <div className="mia-row-main" onClick={() => router.push('/portal/' + d.sku)}>
                      <b>{d.nombre}</b><span className="mia-row-sub">T{u.torre}·{u.num_depto} · {u.rec === 0 ? 'Loft' : u.rec + ' rec'} · {u.m2_hab} m² · {d.alcaldia}</span>
                    </div>
                    <div className="mia-row-price">{MXN(u.precio)}<em>~{MXN(mensualidadHipoteca(u.precio, d))}/mes</em></div>
                    <button className={'cmp-btn' + (cmp.includes(u.sku) ? ' on' : '')} onClick={() => toggleCmp(u.sku)}>{cmp.includes(u.sku) ? '✓' : '＋'}</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!consulta && <EmptyState icon="💬" title="Empieza describiendo al cliente">Toca un ejemplo o escribe arriba. También puedes comparar cualquier unidad marcándola con ＋.</EmptyState>}

        {comparados.length >= 2 && (
          <div className="cmp-wrap">
            <div className="cmp-h"><h2>Comparación</h2><button className="crit-clear" onClick={() => setCmp([])}>Limpiar</button></div>
            <div className="cmp-tbl-wrap">
              <table className="cmp-tbl">
                <thead><tr><th></th>{comparados.map(o => <th key={o.u.sku}><b>{o.d.nombre}</b><span>T{o.u.torre}·{o.u.num_depto}</span></th>)}</tr></thead>
                <tbody>
                  {filas.map(([l, fn]) => (
                    <tr key={l}><td className="cmp-lbl">{l}</td>
                      {comparados.map(o => <td key={o.u.sku} className={l === 'Precio' && o.u.precio === mejorPrecio ? 'cmp-best' : ''}>{fn(o)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {comparados.length === 1 && <p className="fnote">Marca al menos una unidad más con ＋ para comparar lado a lado.</p>}
      </main>
    </>
  );
}
