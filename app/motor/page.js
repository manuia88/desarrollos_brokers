'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const K = n => n == null ? '—' : '$' + (Math.round(n / 1000) / 1000).toFixed(1) + 'M';
const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const recLabel = r => r == null ? '—' : (r === 0 ? 'Loft' : `${r} rec`);
const presBucket = p => !p ? '—' : (p <= 2500000 ? '≤$2.5M' : p <= 3500000 ? '≤$3.5M' : p <= 4500000 ? '≤$4.5M' : p <= 6000000 ? '≤$6M' : '>$6M');

export default function Motor() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState([]);
  const [leads, setLeads] = useState([]);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      if (prof?.rol !== 'super_admin') { setDevs([]); return; }
      const [d, u, l, c] = await Promise.all([
        supabase.from('desarrollos').select('sku,nombre,alcaldia,colonia,precio_min,m2_min,m2_max,unidades_totales,ficha'),
        supabase.from('unidades').select('dev_sku,rec,precio,m2_hab').eq('estatus', 'Disponible'),
        supabase.from('leads').select('zona_interes,rec_interes,presupuesto,presupuesto_max,creado'),
        supabase.from('client_cards').select('zonas,recamaras,presupuesto_max,criterios').eq('activo', true),
      ]);
      setDevs(d.data || []); setUnits(u.data || []); setLeads(l.data || []); setCards(c.data || []);
    })();
  }, [router]);

  const analisis = useMemo(() => {
    if (!devs) return null;
    const devById = Object.fromEntries(devs.map(d => [d.sku, d]));
    // Oferta por zona×rec + medianas de precio/m² por zona
    const pm2Zona = {};
    units.forEach(u => { const d = devById[u.dev_sku]; if (d && u.m2_hab) (pm2Zona[d.alcaldia] = pm2Zona[d.alcaldia] || []).push(u.precio / u.m2_hab); });
    const medZona = Object.fromEntries(Object.entries(pm2Zona).map(([z, a]) => [z, median(a)]));

    // Demanda normalizada
    const demanda = [];
    leads.forEach(l => demanda.push({ zona: l.zona_interes || null, rec: (l.rec_interes ?? null), presMax: (+l.presupuesto || l.presupuesto_max || null), src: 'lead' }));
    cards.forEach(c => { const rec = parseInt(String(c.recamaras || '').match(/\d+/)?.[0] ?? '', 10); demanda.push({ zona: (c.zonas && c.zonas[0]) || null, rec: isNaN(rec) ? null : rec, presMax: c.presupuesto_max || null, src: 'card' }); });

    const matchInv = dz => units.some(u => { const d = devById[u.dev_sku]; if (!d) return false; if (dz.zona && d.alcaldia !== dz.zona) return false; if (dz.rec != null && u.rec !== dz.rec) return false; if (dz.presMax && u.precio > dz.presMax) return false; return true; });
    const conMatch = demanda.filter(matchInv).length;
    const unmet = demanda.filter(d => !matchInv(d));

    // Demanda insatisfecha agregada por zona×rec
    const uAgg = {};
    unmet.forEach(d => { const k = `${d.zona || 'Sin zona'}|${d.rec ?? 'x'}`; (uAgg[k] = uAgg[k] || { zona: d.zona || 'Sin zona', rec: d.rec, n: 0, pres: [] }); uAgg[k].n++; if (d.presMax) uAgg[k].pres.push(d.presMax); });
    const insatisfecha = Object.values(uAgg).sort((a, b) => b.n - a.n).slice(0, 10)
      .map(x => ({ ...x, presMed: median(x.pres) }));

    // Matriz zona × rec (demanda vs oferta)
    const zonas = [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort();
    const recs = [0, 1, 2, 3];
    const cell = (z, r) => {
      const of = units.filter(u => { const d = devById[u.dev_sku]; return d && d.alcaldia === z && (r === 3 ? u.rec >= 3 : u.rec === r); }).length;
      const de = demanda.filter(x => x.zona === z && (x.rec != null && (r === 3 ? x.rec >= 3 : x.rec === r))).length;
      return { of, de };
    };
    const matriz = zonas.map(z => ({ z, cells: recs.map(r => ({ r, ...cell(z, r) })), totDe: demanda.filter(x => x.zona === z).length }))
      .filter(row => row.totDe > 0 || row.cells.some(c => c.of > 0))
      .sort((a, b) => b.totDe - a.totDe);

    // Salud de desarrollos — heurístico multifactor y explicable.
    const salud = devs.map(d => {
      const us = units.filter(u => u.dev_sku === d.sku);
      const disp = us.length;
      const f = d.ficha || {};
      const total = d.unidades_totales || (parseInt(String(f['Unidades totales'] || '')) || null);
      const vendPct = (() => { const v = f['% vendido']; if (v) return parseInt(String(v)) || null; const ven = parseInt(String(f['Unidades vendidas'] || '')) || null; return (total && ven != null) ? Math.round(ven / total * 100) : null; })();
      // Absorción: % colocado (de total o, si no hay total, usa % vendido de la ficha).
      const absorb = (total && total > 0) ? Math.round((1 - disp / total) * 100) : vendPct;
      const pm2 = us.filter(u => u.m2_hab).map(u => u.precio / u.m2_hab);
      const pm2Med = median(pm2);
      const zMed = medZona[d.alcaldia];
      const precioVs = (pm2Med && zMed) ? Math.round((pm2Med / zMed - 1) * 100) : null; // % vs mediana zona
      const demMatch = demanda.filter(x => (!x.zona || x.zona === d.alcaldia) && x.rec != null && us.some(u => u.rec === x.rec && (!x.presMax || u.precio <= x.presMax))).length;
      const presion = disp > 0 ? demMatch / disp : (demMatch > 0 ? 2 : 0); // demanda por unidad disponible

      let hs = 50; const factores = [];
      const push = (k, v, pts) => { hs += pts; factores.push({ k, v, pts }); };
      if (absorb != null) push('Absorción', absorb + '% colocado', Math.max(-18, Math.min(20, Math.round((absorb - 45) * 0.35))));
      if (precioVs != null) push('Precio vs zona', (precioVs > 0 ? '+' : '') + precioVs + '%', Math.max(-18, Math.min(18, -precioVs)));
      push('Demanda que calza', demMatch + ' señal' + (demMatch === 1 ? '' : 'es'), Math.min(22, Math.round(presion * 8) + Math.min(10, demMatch * 2)));
      if (disp === 0) { hs = Math.min(hs, 38); factores.push({ k: 'Inventario', v: 'agotado', pts: 0 }); }
      else if (demMatch === 0 && disp > 8) push('Inventario sin demanda', disp + ' disp.', -8);
      hs = Math.max(0, Math.min(100, Math.round(hs)));
      factores.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
      const top = factores[0];
      return { sku: d.sku, nombre: d.nombre, zona: d.alcaldia, disp, vendPct, absorb, precioVs, demMatch, hs, factores, top };
    }).sort((a, b) => a.hs - b.hs); // los que más necesitan atención primero

    const valorInv = units.reduce((s, u) => s + (u.precio || 0), 0);
    return {
      kpi: { disp: units.length, valor: valorInv, demanda: demanda.length, matchRate: demanda.length ? Math.round(conMatch / demanda.length * 100) : 0, unmet: unmet.length },
      insatisfecha, matriz, recs, salud,
    };
  }, [devs, units, leads, cards]);

  if (me && me.rol !== 'super_admin') return (<><Nav me={me} current="/motor" /><main className="wrap"><div className="loading">Solo para super administradores.</div></main></>);
  if (!analisis) return <div className="loading">Calculando oferta vs demanda…</div>;

  const { kpi, insatisfecha, matriz, recs, salud } = analisis;
  const cellClass = c => c.de === 0 && c.of > 0 ? 'sobra' : c.de > 0 && c.of === 0 ? 'falta' : c.de > 0 && c.of > 0 ? 'ok' : 'vacio';

  return (
    <>
      <Nav me={me} current="/motor" logo="Motor Oferta–Demanda" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Motor Oferta ↔ Demanda</h1>
          <p>Qué pide el mercado contra lo que tienes en inventario. Detecta demanda insatisfecha (oportunidad) e inventario sin demanda (riesgo).</p>
        </div>

        <div className="mtr-kpis">
          <div className="mtr-kpi"><span>Inventario disponible</span><b>{kpi.disp.toLocaleString('es-MX')}</b></div>
          <div className="mtr-kpi"><span>Valor del inventario</span><b>{K(kpi.valor)}</b></div>
          <div className="mtr-kpi"><span>Señales de demanda</span><b>{kpi.demanda.toLocaleString('es-MX')}</b></div>
          <div className="mtr-kpi lime"><span>Match con inventario</span><b>{kpi.matchRate}%</b></div>
          <div className="mtr-kpi amber"><span>Demanda insatisfecha</span><b>{kpi.unmet.toLocaleString('es-MX')}</b></div>
        </div>

        <section className="mtr-sec">
          <h2>🔴 Demanda insatisfecha — dónde hay clientes y no tienes producto</h2>
          {insatisfecha.length === 0 ? <p className="fnote">Todo lo que se busca tiene inventario que le queda. 🎉</p> : (
            <div className="mtr-unmet">
              {insatisfecha.map((x, i) => (
                <div className="mtr-unmet-card" key={i}>
                  <div className="mtr-unmet-n">{x.n}</div>
                  <div><b>{recLabel(x.rec)} en {x.zona}</b><span>{x.presMed ? `presupuesto ~${K(x.presMed)}` : 'presupuesto variable'} · sin inventario que califique</span></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mtr-sec">
          <h2>Matriz zona × recámaras</h2>
          <p className="fnote" style={{ marginTop: 0 }}>Cada celda: <b>demanda</b> / <b>oferta</b>. Rojo = piden y no hay. Ámbar = hay y nadie pide. Verde = equilibrado.</p>
          <div className="loc-grid-wrap">
            <table className="mtr-grid">
              <thead><tr><th>Zona</th>{recs.map(r => <th key={r}>{r === 3 ? '3+ rec' : recLabel(r)}</th>)}</tr></thead>
              <tbody>
                {matriz.map(row => (
                  <tr key={row.z}>
                    <th className="mtr-z">{row.z}</th>
                    {row.cells.map(c => (
                      <td key={c.r} className={'mtr-cell ' + cellClass(c)}>
                        {(c.de > 0 || c.of > 0) ? <><b>{c.de}</b><i>/</i><span>{c.of}</span></> : '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mtr-sec">
          <h2>Salud de desarrollos <span className="fnote" style={{ fontWeight: 400 }}>(los que más necesitan atención primero)</span></h2>
          <div className="loc-grid-wrap">
            <table className="mtr-tbl">
              <thead><tr><th>Desarrollo</th><th>Zona</th><th className="tr">Disp.</th><th className="tr">Absorción</th><th className="tr">$/m² vs zona</th><th className="tr">Demanda</th><th>Factor clave</th><th className="tr">Salud</th></tr></thead>
              <tbody>
                {salud.map(s => (
                  <tr key={s.sku} onClick={() => router.push('/portal/' + s.sku)} style={{ cursor: 'pointer' }}>
                    <td><b>{s.nombre}</b></td><td>{s.zona || '—'}</td>
                    <td className="tr">{s.disp}</td>
                    <td className="tr">{s.absorb != null ? s.absorb + '%' : '—'}</td>
                    <td className="tr">{s.precioVs != null ? (s.precioVs > 0 ? '+' : '') + s.precioVs + '%' : '—'}</td>
                    <td className="tr">{s.demMatch}</td>
                    <td className="mtr-factor">{s.top ? `${s.top.pts > 0 ? '▲' : s.top.pts < 0 ? '▼' : '•'} ${s.top.k}` : '—'}</td>
                    <td className="tr"><span className={'mtr-hs ' + (s.hs >= 66 ? 'hi' : s.hs >= 40 ? 'mid' : 'lo')}
                      title={s.factores.map(f => `${f.k}: ${f.v} (${f.pts > 0 ? '+' : ''}${f.pts})`).join('  ·  ')}>{s.hs}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="fnote">Demanda = leads + búsquedas guardadas (client cards). Cálculo analítico sobre tu inventario en vivo; el score de salud pondera absorción (ritmo de colocación), precio vs mediana de su zona y presión de demanda por unidad disponible. Pasa el cursor sobre el número de salud para ver el desglose de factores.</p>
      </main>
    </>
  );
}
