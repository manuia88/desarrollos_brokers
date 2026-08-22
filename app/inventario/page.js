'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

export default function Inventario() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [conteo, setConteo] = useState({});     // dev_sku -> { total, pub, disp }
  const [abierto, setAbierto] = useState(null);  // dev_sku expandido
  const [unis, setUnis] = useState({});          // dev_sku -> [unidades]
  const [busy, setBusy] = useState(null);
  const [puede, setPuede] = useState(true);

  async function cargarDevs(m) {
    let q = supabase.from('desarrollos').select('sku,nombre,direccion,publicado,etapa,estado,dev_org_id').order('nombre');
    const { data } = await q;
    let list = data || [];
    if (m.rol !== 'super_admin' && m.org_id) list = list.filter(d => d.dev_org_id === m.org_id);
    setDevs(list);
    const { data: u } = await supabase.from('unidades').select('dev_sku,publicado,estatus');
    const c = {};
    (u || []).forEach(x => {
      const k = c[x.dev_sku] || (c[x.dev_sku] = { total: 0, pub: 0, disp: 0 });
      k.total++; if (x.publicado) k.pub++;
      if (/disponible/i.test(x.estatus || '')) k.disp++;
    });
    setConteo(c);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/inventario'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      let tipoOrg = null, master = false;
      if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('tipo,es_master_broker').eq('id', prof.org_id).maybeSingle(); tipoOrg = o?.tipo; master = o?.es_master_broker; }
      const ok = prof?.rol === 'super_admin' || ((tipoOrg === 'desarrollador' || master) && ['director', 'gerente'].includes(prof?.rol));
      const m = { id: session.user.id, email: session.user.email, ...(prof || {}) };
      setMe(m);
      if (!ok) { setPuede(false); setDevs([]); return; }
      await cargarDevs(m);
    })();
  }, [router]);

  async function toggleDev(d) {
    setBusy(d.sku);
    const { error } = await supabase.from('desarrollos').update({ publicado: !d.publicado }).eq('sku', d.sku);
    setBusy(null);
    if (error) { alert('No se pudo: ' + error.message); return; }
    setDevs(list => list.map(x => x.sku === d.sku ? { ...x, publicado: !x.publicado } : x));
  }

  async function abrir(sku) {
    if (abierto === sku) { setAbierto(null); return; }
    setAbierto(sku);
    if (!unis[sku]) {
      const { data } = await supabase.from('unidades').select('sku,num_depto,torre,nivel,precio,estatus,publicado').eq('dev_sku', sku).order('num_depto');
      setUnis(u => ({ ...u, [sku]: data || [] }));
    }
  }

  async function toggleUni(sku, u) {
    const { error } = await supabase.from('unidades').update({ publicado: !u.publicado }).eq('sku', u.sku);
    if (error) { alert('No se pudo: ' + error.message); return; }
    setUnis(s => ({ ...s, [sku]: s[sku].map(x => x.sku === u.sku ? { ...x, publicado: !x.publicado } : x) }));
    setConteo(c => ({ ...c, [sku]: { ...c[sku], pub: (c[sku]?.pub || 0) + (u.publicado ? -1 : 1) } }));
  }

  async function bulk(sku, val) {
    setBusy(sku);
    const { error } = await supabase.from('unidades').update({ publicado: val }).eq('dev_sku', sku);
    setBusy(null);
    if (error) { alert('No se pudo: ' + error.message); return; }
    setUnis(s => ({ ...s, [sku]: (s[sku] || []).map(x => ({ ...x, publicado: val })) }));
    setConteo(c => ({ ...c, [sku]: { ...c[sku], pub: val ? (c[sku]?.total || 0) : 0 } }));
  }

  const resumen = useMemo(() => {
    const pubDevs = (devs || []).filter(d => d.publicado).length;
    return { pubDevs, totalDevs: (devs || []).length };
  }, [devs]);

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  return (
    <>
      <Nav me={me} current="/inventario" logo="Inventario para brokers" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Disponibilidad para brokers</h1>
          <p>Elige qué inventario abres a la red de brokers. Puedes publicar un desarrollo completo o esconder unidades sueltas. Lo que no publiques, ningún broker lo ve.</p>
        </div>

        {!puede ? (
          <EmptyState icon="🔒" title="Solo para desarrolladores">
            Esta sección es para el desarrollador dueño del inventario (o el administrador).
          </EmptyState>
        ) : (
          <>
            <div className="crm-metrics">
              <div className="mtile acc"><b>{resumen.pubDevs}/{resumen.totalDevs}</b><span>Desarrollos abiertos a brokers</span></div>
            </div>

            <div className="alta-grid">
              {devs.map(d => {
                const c = conteo[d.sku] || { total: 0, pub: 0, disp: 0 };
                const ocultas = c.total - c.pub;
                const on = !!d.publicado;
                return (
                  <article className="alta" key={d.sku}>
                    <div className="alta-h">
                      <div>
                        <h3>{tituloDev(d)}</h3>
                        <span className="loc">{d.etapa || '—'} · {c.total} unidad{c.total === 1 ? '' : 'es'} · {c.disp} disponible{c.disp === 1 ? '' : 's'}</span>
                      </div>
                      <button
                        className={'ap-badge ' + (on ? 'es' : 'cx')}
                        style={{ cursor: 'pointer', border: 'none' }}
                        disabled={busy === d.sku}
                        onClick={() => toggleDev(d)}
                        title={on ? 'Abierto a brokers — clic para ocultar' : 'Oculto — clic para abrir a brokers'}
                      >{on ? '● Abierto a brokers' : '○ Oculto'}</button>
                    </div>

                    {on && ocultas > 0 && <p className="ap-hint">De este desarrollo, {ocultas} unidad{ocultas === 1 ? ' está oculta' : 'es están ocultas'} a brokers.</p>}

                    <div className="ap-actions">
                      <button className="btn ghost sm" onClick={() => abrir(d.sku)}>{abierto === d.sku ? 'Ocultar unidades' : 'Ver / elegir unidades'}</button>
                    </div>

                    {abierto === d.sku && (
                      <div style={{ marginTop: '.6rem' }}>
                        <div className="ap-actions" style={{ marginBottom: '.5rem' }}>
                          <button className="btn ok sm" disabled={busy === d.sku} onClick={() => bulk(d.sku, true)}>Publicar todas</button>
                          <button className="btn no sm" disabled={busy === d.sku} onClick={() => bulk(d.sku, false)}>Ocultar todas</button>
                        </div>
                        {!unis[d.sku] ? <p className="fnote">Cargando unidades…</p> : unis[d.sku].length === 0 ? <p className="fnote">Sin unidades cargadas.</p> : (
                          <div className="utbl-wrap"><table className="utbl">
                            <thead><tr><th>Depto</th><th>Torre/Nivel</th><th>Precio</th><th>Estatus</th><th>Brokers</th></tr></thead>
                            <tbody>
                              {unis[d.sku].map(u => (
                                <tr key={u.sku}>
                                  <td>{u.num_depto || u.sku}</td>
                                  <td>{[u.torre, u.nivel].filter(Boolean).join(' / ') || '—'}</td>
                                  <td>{MXN(u.precio)}</td>
                                  <td>{u.estatus || '—'}</td>
                                  <td><button className={'ap-badge ' + (u.publicado ? 'es' : 'cx')} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleUni(d.sku, u)}>{u.publicado ? '● Visible' : '○ Oculta'}</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table></div>
                        )}
                      </div>
                    )}
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
