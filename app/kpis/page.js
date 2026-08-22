'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const K = n => n == null ? '—' : '$' + (Math.round(n / 100000) / 10).toFixed(1) + 'M';
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
const DAY = 86400000;
const PERIODOS = [['30', '30 días'], ['90', '90 días'], ['365', '12 meses'], ['0', 'Todo']];

export default function Kpis() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [dias, setDias] = useState('90');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      if (prof?.rol !== 'super_admin') { setData({ denied: true }); return; }
      const [l, c, a, d, p] = await Promise.all([
        supabase.from('leads').select('id,creado,asignado_en,asesor_id,dev_sku,fuente,estatus'),
        supabase.from('citas').select('id,creado,fecha,asesor_id,dev_sku,lead_id,estatus'),
        supabase.from('apartados').select('id,creado,asesor_id,dev_sku,estatus,precio,comision_monto,fecha_escritura'),
        supabase.from('desarrollos').select('sku,nombre,direccion'),
        supabase.from('profiles').select('id,nombre'),
      ]);
      setData({ leads: l.data || [], citas: c.data || [], apartados: a.data || [], devs: d.data || [], people: p.data || [] });
    })();
  }, [router]);

  const kpi = useMemo(() => {
    if (!data || data.denied) return null;
    const { leads, citas, apartados, devs, people } = data;
    const corte = dias === '0' ? 0 : Date.now() - Number(dias) * DAY;
    const enRango = t => !corte || (t && new Date(t).getTime() >= corte);
    const L = leads.filter(x => enRango(x.creado));
    const C = citas.filter(x => enRango(x.creado));
    const A = apartados.filter(x => enRango(x.creado));
    const escritos = A.filter(x => x.fecha_escritura || /escritur|cerrad/i.test(x.estatus || ''));
    const nombreDev = Object.fromEntries(devs.map(d => [d.sku, tituloDev(d)]));
    const nombrePers = Object.fromEntries(people.map(p => [p.id, p.nombre]));

    // SLA de asignación (horas) y días a primera cita
    const slaHrs = L.filter(x => x.asignado_en && x.creado).map(x => (new Date(x.asignado_en) - new Date(x.creado)) / 3600000).filter(h => h >= 0);
    const slaMed = slaHrs.length ? slaHrs.sort((a, b) => a - b)[Math.floor(slaHrs.length / 2)] : null;
    const leadCreado = Object.fromEntries(leads.map(l => [l.id, l.creado]));
    const diasCita = C.filter(x => x.lead_id && leadCreado[x.lead_id]).map(x => (new Date(x.creado) - new Date(leadCreado[x.lead_id])) / DAY).filter(d => d >= 0);
    const diasCitaMed = diasCita.length ? Math.round(diasCita.sort((a, b) => a - b)[Math.floor(diasCita.length / 2)]) : null;

    // Por asesor
    const asAgg = {};
    const bump = (id, k) => { if (!id) return; (asAgg[id] = asAgg[id] || { leads: 0, citas: 0, apartados: 0 })[k]++; };
    L.forEach(x => bump(x.asesor_id, 'leads'));
    C.forEach(x => bump(x.asesor_id, 'citas'));
    A.forEach(x => bump(x.asesor_id, 'apartados'));
    const porAsesor = Object.entries(asAgg).map(([id, v]) => ({ id, nombre: nombrePers[id] || '—', ...v, conv: pct(v.apartados, v.leads) })).sort((a, b) => b.apartados - a.apartados || b.leads - a.leads).slice(0, 12);

    // Por desarrollo
    const dvAgg = {};
    const dbump = (sku, k) => { if (!sku) return; (dvAgg[sku] = dvAgg[sku] || { leads: 0, apartados: 0, valor: 0 }); dvAgg[sku][k]++; };
    L.forEach(x => dbump(x.dev_sku, 'leads'));
    A.forEach(x => { dbump(x.dev_sku, 'apartados'); if (x.dev_sku) dvAgg[x.dev_sku].valor += (x.precio || 0); });
    const porDev = Object.entries(dvAgg).map(([sku, v]) => ({ sku, nombre: nombreDev[sku] || sku, ...v, conv: pct(v.apartados, v.leads) })).sort((a, b) => b.leads - a.leads).slice(0, 12);

    // Por fuente
    const fuAgg = {};
    L.forEach(x => { const f = x.fuente || 'directo'; fuAgg[f] = (fuAgg[f] || 0) + 1; });
    const porFuente = Object.entries(fuAgg).map(([f, n]) => ({ f, n })).sort((a, b) => b.n - a.n);

    const valorPipe = A.reduce((s, x) => s + (x.precio || 0), 0);
    const comision = A.reduce((s, x) => s + (x.comision_monto || 0), 0);

    return {
      funnel: [
        { k: 'Leads', n: L.length },
        { k: 'Citas', n: C.length, conv: pct(C.length, L.length) },
        { k: 'Apartados', n: A.length, conv: pct(A.length, C.length) },
        { k: 'Escrituras', n: escritos.length, conv: pct(escritos.length, A.length) },
      ],
      slaMed, diasCitaMed, valorPipe, comision, porAsesor, porDev, porFuente,
      convGlobal: pct(A.length, L.length),
    };
  }, [data, dias]);

  if (me && me.rol !== 'super_admin') return (<><Nav me={me} current="/kpis" /><main className="wrap"><div className="loading">Solo para super administradores.</div></main></>);
  if (!kpi) return <div className="loading">Calculando KPIs…</div>;

  const maxFunnel = kpi.funnel[0].n || 1;

  return (
    <>
      <Nav me={me} current="/kpis" logo="Tablero ejecutivo" />
      <main className="wrap">
        <div className="buscar-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div><h1>Tablero ejecutivo</h1><p>Embudo de venta, conversión por asesor y desarrollo, y tiempos de respuesta — en todo tu piso.</p></div>
          <div className="kpi-periodo">{PERIODOS.map(([v, l]) => <button key={v} className={'sg-fchip' + (dias === v ? ' on' : '')} onClick={() => setDias(v)}>{l}</button>)}</div>
        </div>

        {/* Tarjetas resumen */}
        <div className="mtr-kpis">
          <div className="mtr-kpi"><span>Conversión lead→apartado</span><b>{kpi.convGlobal}%</b></div>
          <div className="mtr-kpi lime"><span>Valor apartado</span><b>{K(kpi.valorPipe)}</b></div>
          <div className="mtr-kpi"><span>Comisión generada</span><b>{K(kpi.comision)}</b></div>
          <div className="mtr-kpi"><span>SLA asignación (mediana)</span><b>{kpi.slaMed != null ? (kpi.slaMed < 1 ? Math.round(kpi.slaMed * 60) + ' min' : kpi.slaMed.toFixed(1) + ' h') : '—'}</b></div>
          <div className="mtr-kpi amber"><span>Días a 1ª cita (mediana)</span><b>{kpi.diasCitaMed != null ? kpi.diasCitaMed + ' d' : '—'}</b></div>
        </div>

        {/* Embudo */}
        <section className="mtr-sec">
          <h2>Embudo de venta</h2>
          <div className="kpi-funnel">
            {kpi.funnel.map((f, i) => (
              <div className="kpi-fstep" key={f.k}>
                <div className="kpi-fbar" style={{ width: Math.max(8, pct(f.n, maxFunnel)) + '%' }}><b>{f.n.toLocaleString('es-MX')}</b></div>
                <div className="kpi-flbl">{f.k}{i > 0 && <span> · {f.conv}% del previo</span>}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Por asesor */}
        <section className="mtr-sec">
          <h2>Desempeño por asesor</h2>
          <div className="loc-grid-wrap">
            <table className="mtr-tbl">
              <thead><tr><th>Asesor</th><th className="tr">Leads</th><th className="tr">Citas</th><th className="tr">Apartados</th><th className="tr">Conversión</th></tr></thead>
              <tbody>
                {kpi.porAsesor.map(a => (
                  <tr key={a.id}><td><b>{a.nombre}</b></td><td className="tr">{a.leads}</td><td className="tr">{a.citas}</td><td className="tr">{a.apartados}</td>
                    <td className="tr"><span className={'mtr-hs ' + (a.conv >= 15 ? 'hi' : a.conv >= 5 ? 'mid' : 'lo')}>{a.conv}%</span></td></tr>
                ))}
                {kpi.porAsesor.length === 0 && <tr><td colSpan={5} className="fnote">Sin datos en el periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Por desarrollo */}
        <section className="mtr-sec">
          <h2>Desempeño por desarrollo</h2>
          <div className="loc-grid-wrap">
            <table className="mtr-tbl">
              <thead><tr><th>Desarrollo</th><th className="tr">Leads</th><th className="tr">Apartados</th><th className="tr">Conversión</th><th className="tr">Valor apartado</th></tr></thead>
              <tbody>
                {kpi.porDev.map(d => (
                  <tr key={d.sku} onClick={() => router.push('/portal/' + d.sku)} style={{ cursor: 'pointer' }}>
                    <td><b>{d.nombre}</b></td><td className="tr">{d.leads}</td><td className="tr">{d.apartados}</td>
                    <td className="tr"><span className={'mtr-hs ' + (d.conv >= 15 ? 'hi' : d.conv >= 5 ? 'mid' : 'lo')}>{d.conv}%</span></td>
                    <td className="tr">{d.valor ? K(d.valor) : '—'}</td></tr>
                ))}
                {kpi.porDev.length === 0 && <tr><td colSpan={5} className="fnote">Sin datos en el periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Por fuente */}
        {kpi.porFuente.length > 0 && (
          <section className="mtr-sec">
            <h2>Origen de los leads</h2>
            <div className="kpi-fuentes">
              {kpi.porFuente.map(f => <div className="kpi-fuente" key={f.f}><b>{f.n}</b><span>{f.f}</span></div>)}
            </div>
          </section>
        )}
        <p className="fnote">Datos en vivo de tu inventario, leads, citas y apartados. La conversión a escritura usa fecha de escritura o estatus escriturado del apartado.</p>
      </main>
    </>
  );
}
