'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { MXN, meses, Chip, EmptyState } from '../../components/ui';

const RECS = [['','Cualquiera'],['0','Loft'],['1','1'],['2','2'],['3','3+']];
const ENTREGAS = [['','Cualquiera'],['inmediata','Inmediata'],['12','≤ 12 meses'],['24','≤ 24 meses']];
const PRESUP = [['','Sin tope'],['2500000','$2.5M'],['3500000','$3.5M'],['4500000','$4.5M'],['6000000','$6M'],['9000000','$9M']];

export default function Buscar() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState(null);
  // criterios del cliente
  const [rec, setRec] = useState('');
  const [pres, setPres] = useState('');
  const [zona, setZona] = useState('');
  const [entrega, setEntrega] = useState('');
  const [credito, setCredito] = useState(false); // acepta crédito bancario

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol').eq('id', session.user.id).single();
      setMe({ email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,torre,num_depto,rec,banos,n_estac,m2_hab,precio,prototipo').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
    })();
  }, [router]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  const zonas = useMemo(() => devs ? [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort() : [], [devs]);

  const grupos = useMemo(() => {
    if (!devs || !units) return null;
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const devOk = d => {
      if (zona && d.alcaldia !== zona) return false;
      if (entrega === 'inmediata' && d.etapa !== 'Entrega inmediata') return false;
      if (entrega === '12' || entrega === '24') { const m = meses(d.fecha_entrega); if (m == null || m > +entrega) return false; }
      if (credito && !/s/i.test(d.credito_bancario || '')) return false;
      return true;
    };
    const ok = units.filter(u => {
      const d = byId[u.dev_sku]; if (!d || !devOk(d)) return false;
      if (rec !== '') { if (rec === '3') { if (!(u.rec >= 3)) return false; } else if (u.rec !== +rec) return false; }
      if (pres && u.precio > +pres) return false;
      return true;
    });
    const g = {};
    ok.forEach(u => { (g[u.dev_sku] = g[u.dev_sku] || []).push(u); });
    return Object.entries(g)
      .map(([sku, us]) => ({ dev: byId[sku], units: us.sort((a, b) => a.precio - b.precio) }))
      .sort((a, b) => a.units[0].precio - b.units[0].precio);
  }, [devs, units, rec, pres, zona, entrega, credito]);

  const totalU = grupos ? grupos.reduce((a, g) => a + g.units.length, 0) : 0;
  const tocado = rec || pres || zona || entrega || credito;

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Buscador para tu cliente</span>
        <nav className="nav">
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          <a onClick={() => router.push('/crm')}>CRM</a>
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

      <main className="wrap">
        <div className="buscar-intro">
          <h1>¿Qué busca tu cliente?</h1>
          <p>Define sus criterios y te digo qué le queda de los {devs.length} desarrollos y {units.length.toLocaleString('es-MX')} unidades disponibles.</p>
        </div>

        {/* criterios */}
        <div className="crit">
          <div className="crit-row">
            <label>Recámaras</label>
            <div className="crit-chips">{RECS.map(([v, l]) => <Chip key={v} on={rec === v} onClick={() => setRec(v)}>{l}</Chip>)}</div>
          </div>
          <div className="crit-row">
            <label>Presupuesto máx.</label>
            <div className="crit-chips">{PRESUP.map(([v, l]) => <Chip key={v} on={pres === v} onClick={() => setPres(v)}>{l}</Chip>)}</div>
          </div>
          <div className="crit-row">
            <label>Entrega</label>
            <div className="crit-chips">{ENTREGAS.map(([v, l]) => <Chip key={v} on={entrega === v} onClick={() => setEntrega(v)}>{l}</Chip>)}</div>
          </div>
          <div className="crit-row">
            <label>Zona</label>
            <select value={zona} onChange={e => setZona(e.target.value)} className="crit-sel">
              <option value="">Cualquier alcaldía</option>
              {zonas.map(z => <option key={z}>{z}</option>)}
            </select>
            <Chip on={credito} onClick={() => setCredito(c => !c)}>🏦 Acepta crédito bancario</Chip>
            {tocado && <button className="crit-clear" onClick={() => { setRec(''); setPres(''); setZona(''); setEntrega(''); setCredito(false); }}>Limpiar</button>}
          </div>
        </div>

        {/* resultado */}
        {!tocado ? (
          <EmptyState icon="🔎" title="Empieza por lo esencial">
            Elige recámaras y presupuesto — con eso ya te muestro las mejores opciones para tu cliente.
          </EmptyState>
        ) : totalU === 0 ? (
          <EmptyState icon="🤔" title="Nada encaja con esos criterios">
            Prueba subir el presupuesto, ampliar la zona o la fecha de entrega.
          </EmptyState>
        ) : (
          <>
            <div className="res-head"><b>{totalU}</b> unidad{totalU === 1 ? '' : 'es'} en <b>{grupos.length}</b> desarrollo{grupos.length === 1 ? '' : 's'} le quedan a tu cliente</div>
            <div className="res-grid">
              {grupos.map(({ dev: d, units: us }) => {
                const min = us[0].precio, max = us[us.length - 1].precio;
                const protos = [...new Set(us.map(u => u.prototipo).filter(Boolean))];
                const m = meses(d.fecha_entrega);
                return (
                  <article className="match" key={d.sku} onClick={() => router.push('/portal/' + d.sku)}>
                    <div className="match-h">
                      <div>
                        <h3>{d.nombre}</h3>
                        <span className="loc">📍 {d.colonia}, {d.alcaldia}</span>
                      </div>
                      <span className="match-n">{us.length}</span>
                    </div>
                    <div className="match-price">{min === max ? MXN(min) : `${MXN(min)} – ${MXN(max)}`}</div>
                    <div className="match-meta">
                      <span>{d.etapa === 'Entrega inmediata' ? '⚡ Inmediata' : (m != null ? `🕑 ${m} meses` : 'Preventa')}</span>
                      {d.comision_broker && <span>💰 {Math.round(d.comision_broker * 100)}% comisión</span>}
                    </div>
                    {protos.length > 0 && <div className="match-protos">{protos.slice(0, 4).map(p => <span key={p} className="chip2">{p}</span>)}</div>}
                    <div className="match-foot"><span>Ver {us.length} unidad{us.length === 1 ? '' : 'es'} →</span></div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
