'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';
import { meses, precalifica, TECHO_CREDITO } from '../../lib/matching';
import { track } from '../../lib/track';

const TIPOS = ['Bancario', 'Infonavit', 'FOVISSSTE'];
const PLAZOS = [['15', '15 años'], ['20', '20 años'], ['25', '25 años']];

export default function Precalifica() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState([]);
  const [f, setF] = useState({ ingreso: '', enganche: '', tipo: 'Bancario', plazo: '20' });
  const [calc, setCalc] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('sku,nombre,direccion,colonia,alcaldia,etapa,fecha_entrega,comision_broker').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,rec,m2_hab,precio,prototipo,estatus').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
    })();
  }, [router]);

  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const num = s => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

  function calcular() {
    const ing = num(f.ingreso); if (!ing) { setCalc(null); return; }
    setCalc(precalifica(ing, num(f.enganche), f.tipo, +f.plazo));
  }

  const elegibles = useMemo(() => {
    if (!calc || !devs) return [];
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const g = {};
    units.filter(u => u.precio <= calc.maxPrecio).forEach(u => { const d = byId[u.dev_sku]; if (!d) return; (g[u.dev_sku] = g[u.dev_sku] || { d, us: [] }).us.push(u); });
    return Object.values(g).map(({ d, us }) => ({ d, n: us.length, min: Math.min(...us.map(u => u.precio)) })).sort((a, b) => a.min - b.min);
  }, [calc, devs, units]);

  const totalEleg = elegibles.reduce((a, g) => a + g.n, 0);
  useEffect(() => { if (calc && me) track('precalifica', { tipo: f.tipo, maxPrecio: calc.maxPrecio, resultados: totalEleg }, me); }, [calc]);

  if (devs === null) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/precalifica" logo="Precalificación" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>¿Para cuánto califica tu cliente?</h1>
          <p>Con su ingreso y enganche te digo el precio máximo que puede pagar y qué inventario sí le alcanza. Estimación de referencia, no una oferta de crédito.</p>
        </div>

        <div className="pc-form">
          <div className="pc-f"><label className="lbl">Ingreso mensual del hogar</label>
            <input className="inp" inputMode="decimal" value={f.ingreso} onChange={e => set('ingreso', e.target.value)} placeholder="$45,000" /></div>
          <div className="pc-f"><label className="lbl">Enganche disponible</label>
            <input className="inp" inputMode="decimal" value={f.enganche} onChange={e => set('enganche', e.target.value)} placeholder="$500,000" /></div>
          <div className="pc-f"><label className="lbl">Tipo de crédito</label>
            <div className="crit-chips">{TIPOS.map(t => <span key={t} className={'chip' + (f.tipo === t ? ' on' : '')} onClick={() => set('tipo', t)}>{t}</span>)}</div></div>
          <div className="pc-f"><label className="lbl">Plazo</label>
            <div className="crit-chips">{PLAZOS.map(([v, l]) => <span key={v} className={'chip' + (f.plazo === v ? ' on' : '')} onClick={() => set('plazo', v)}>{l}</span>)}</div></div>
          <button className="btn mag" onClick={calcular}>Calcular</button>
        </div>

        {calc && (
          <>
            <div className="pc-result">
              <div className="pc-main"><span>Califica para hasta</span><b>{MXN(calc.maxPrecio)}</b></div>
              <div className="pc-sub">
                <div><span>Pago mensual máx.</span><b>{MXN(calc.pago)}</b></div>
                <div><span>Crédito estimado</span><b>{MXN(calc.montoCredito)}</b></div>
                <div><span>+ Enganche</span><b>{MXN(num(f.enganche))}</b></div>
              </div>
              {calc.montoCredito >= (TECHO_CREDITO[f.tipo] ?? Infinity) && <p className="fnote" style={{ margin: '.6rem 0 0' }}>Nota: {f.tipo} topa alrededor de {MXN(TECHO_CREDITO[f.tipo])} de crédito; el máximo ya considera ese tope.</p>}
            </div>

            <div className="res-head" style={{ marginTop: '1.2rem' }}>
              <div><b>{totalEleg}</b> unidad{totalEleg === 1 ? '' : 'es'} en <b>{elegibles.length}</b> desarrollo{elegibles.length === 1 ? '' : 's'} sí le alcanzan</div>
              <button className="btn lim sm" onClick={() => router.push('/buscar?presMax=' + calc.maxPrecio)}>Ver en el buscador →</button>
            </div>

            {elegibles.length === 0 ? <EmptyState icon="🤔" title="Nada en ese rango">Con esos datos aún no alcanza el inventario disponible. Prueba con más enganche o revisa Infonavit/FOVISSSTE.</EmptyState> : (
              <div className="res-grid">
                {elegibles.slice(0, 12).map(({ d, n, min }) => (
                  <article className="match" key={d.sku} onClick={() => router.push('/portal/' + d.sku)}>
                    <div className="match-h"><div><h3>{tituloDev(d)}</h3><span className="loc">📍 {d.colonia}, {d.alcaldia}</span></div></div>
                    <div className="match-price">desde {MXN(min)}</div>
                    <div className="match-meta">
                      <span>{d.etapa === 'Entrega inmediata' ? '⚡ Inmediata' : (meses(d.fecha_entrega) != null ? `🕑 ${meses(d.fecha_entrega)} meses` : 'Preventa')}</span>
                      <span>🏠 {n} le alcanzan</span>
                      {d.comision_broker ? <span className="lim">💰 {Math.round(d.comision_broker * 100)}%</span> : null}
                    </div>
                    <div className="match-foot"><span>Ver desarrollo →</span></div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {!calc && <EmptyState icon="🧮" title="Llena los datos y calcula">Con el ingreso y el enganche del cliente sabrás en segundos qué puede comprar.</EmptyState>}
      </main>
    </>
  );
}
