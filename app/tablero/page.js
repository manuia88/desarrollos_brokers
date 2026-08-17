'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN } from '../../components/ui';

const MXNc = n => n == null ? '—' : '$' + (Math.round(n / 100000) / 10).toLocaleString('es-MX') + 'M';

function Tile({ v, l, acc }) { return <div className={'mtile' + (acc ? ' acc' : '')}><b>{v}</b><span>{l}</span></div>; }

export default function Tablero() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [org, setOrg] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      const meObj = { id: session.user.id, email: session.user.email, ...(prof || {}) };
      setMe(meObj);
      if (meObj.org_id) { const { data: o } = await supabase.from('orgs').select('id,nombre,ruteo,sla_horas').eq('id', meObj.org_id).maybeSingle(); setOrg(o || null); }
      const [u, l, ci, ap, ev, d, pf] = await Promise.all([
        supabase.from('unidades').select('dev_sku,precio,estatus'),
        supabase.from('leads').select('id,etapa,estatus,dev_sku,creado,asesor_id'),
        supabase.from('citas').select('id,estatus,fecha,asesor_id'),
        supabase.from('apartados').select('id,estatus,precio,comision_monto,asesor_id'),
        supabase.from('eventos').select('tipo,entidad_id'),
        supabase.from('desarrollos').select('sku,nombre'),
        supabase.from('profiles').select('id,nombre,rol'),
      ]);
      setData({ u: u.data || [], l: l.data || [], ci: ci.data || [], ap: ap.data || [], ev: ev.data || [], d: d.data || [], pf: pf.data || [] });
    })();
  }, [router]);

  const k = useMemo(() => {
    if (!data) return null;
    const { u, l, ci, ap, ev, d, pf } = data;
    const devName = Object.fromEntries(d.map(x => [x.sku, x.nombre]));
    const aseName = Object.fromEntries((pf || []).map(x => [x.id, x.nombre]));
    const disp = u.filter(x => x.estatus === 'Disponible');
    const vend = u.filter(x => /vend/i.test(x.estatus || ''));
    const apar = u.filter(x => /apart|reserv/i.test(x.estatus || ''));
    const valorDisp = disp.reduce((a, x) => a + (x.precio || 0), 0);
    const etapas = ['Nuevo', 'Contactado', 'Cita', 'Apartado', 'Escriturado', 'Perdido'];
    const porEtapa = etapas.map(e => [e, l.filter(x => (x.etapa || x.estatus || 'Nuevo') === e).length]);
    const citasAct = ci.filter(x => ['Solicitada', 'Confirmada'].includes(x.estatus)).length;
    const comEst = ap.reduce((a, x) => a + (x.comision_monto || 0), 0);
    // vistas por desarrollo
    const vistas = ev.filter(x => x.tipo === 'vista_ficha');
    const vd = {}; vistas.forEach(x => { vd[x.entidad_id] = (vd[x.entidad_id] || 0) + 1; });
    const topVistas = Object.entries(vd).map(([sku, n]) => ({ sku, n, nombre: devName[sku] || sku })).sort((a, b) => b.n - a.n).slice(0, 6);
    const conv = vistas.length ? Math.round((l.length / vistas.length) * 100) : null;
    // inventario por desarrollo (valor disponible)
    const invd = {}; disp.forEach(x => { invd[x.dev_sku] = invd[x.dev_sku] || { n: 0, val: 0 }; invd[x.dev_sku].n++; invd[x.dev_sku].val += x.precio || 0; });
    const topInv = Object.entries(invd).map(([sku, o]) => ({ sku, ...o, nombre: devName[sku] || sku })).sort((a, b) => b.val - a.val).slice(0, 6);
    // Ranking del equipo (por asesor)
    const team = {};
    const bump = (id, k) => { if (!id) return; team[id] = team[id] || { leads: 0, citas: 0, apart: 0, com: 0 }; team[id][k]++; };
    l.forEach(x => bump(x.asesor_id, 'leads'));
    ci.forEach(x => bump(x.asesor_id, 'citas'));
    ap.forEach(x => { bump(x.asesor_id, 'apart'); if (x.asesor_id && team[x.asesor_id]) team[x.asesor_id].com += (x.estatus === 'Escriturado' ? (x.comision_monto || 0) : 0); });
    const ranking = Object.entries(team).map(([id, o]) => ({ id, nombre: aseName[id] || 'Asesor', ...o, score: o.leads + o.citas * 2 + o.apart * 4 }))
      .sort((a, b) => b.score - a.score).slice(0, 8);
    // Absorción por desarrollo (% colocado)
    const abs = {};
    u.forEach(x => { abs[x.dev_sku] = abs[x.dev_sku] || { tot: 0, col: 0 }; abs[x.dev_sku].tot++; if (x.estatus !== 'Disponible') abs[x.dev_sku].col++; });
    const absorcion = Object.entries(abs).map(([sku, o]) => ({ sku, nombre: devName[sku] || sku, tot: o.tot, col: o.col, pct: Math.round(o.col / o.tot * 100) }))
      .filter(x => x.tot >= 3).sort((a, b) => b.pct - a.pct).slice(0, 8);
    return { totalU: u.length, disp: disp.length, vend: vend.length, apar: apar.length, valorDisp, porEtapa, leads: l.length, citasAct, apart: ap.length, comEst, topVistas, topInv, vistas: vistas.length, conv, ranking, absorcion };
  }, [data]);

  async function guardarRuteo(campo, valor) {
    if (!org) return;
    const next = { ...org, [campo]: valor }; setOrg(next);
    await supabase.from('orgs').update({ [campo]: valor }).eq('id', org.id);
  }

  if (!k) return <div className="loading">Cargando tablero…</div>;
  const esSuper = me?.rol === 'super_admin';
  const puedeRuteo = ['super_admin', 'director', 'gerente'].includes(me?.rol) && org;
  const maxEtapa = Math.max(1, ...k.porEtapa.map(x => x[1]));
  const maxV = k.topVistas[0]?.n || 1;
  const maxI = k.topInv[0]?.val || 1;

  return (
    <>
      <Nav me={me} current="/tablero" logo="Tablero" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>{esSuper ? 'Tablero global' : 'Mi tablero'}</h1>
          <p>{esSuper ? 'Salud del inventario, embudo y uso del portal.' : 'Tu producción: leads, citas, cierres y comisión estimada.'}</p>
        </div>

        <div className="mtiles">
          <Tile v={k.disp} l="Unidades disponibles" acc />
          <Tile v={MXNc(k.valorDisp)} l="Valor del inventario" />
          <Tile v={k.vend + k.apar} l="Vendidas / apartadas" />
          <Tile v={k.leads} l="Leads" />
          <Tile v={k.citasAct} l="Citas activas" />
          <Tile v={MXN(k.comEst)} l="Comisión estimada" />
        </div>

        <div className="tb-cols">
          <section className="sec">
            <h2>Embudo de leads</h2>
            {k.porEtapa.map(([e, n]) => (
              <div className="tb-row" key={e}>
                <span className="tb-lbl">{e}</span>
                <div className="tb-bar"><i style={{ width: Math.max(4, (n / maxEtapa) * 100) + '%' }} /></div>
                <b className="tb-n">{n}</b>
              </div>
            ))}
            {k.leads === 0 && <p className="fnote">Aún no hay leads registrados.</p>}
          </section>

          <section className="sec">
            <h2>Desarrollos más vistos</h2>
            {k.topVistas.length === 0 ? <p className="fnote">Sin vistas registradas todavía. Comparte fichas para empezar a medir.</p> :
              k.topVistas.map(v => (
                <div className="tb-row" key={v.sku} onClick={() => router.push('/portal/' + v.sku)} style={{ cursor: 'pointer' }}>
                  <span className="tb-lbl">{v.nombre}</span>
                  <div className="tb-bar mag"><i style={{ width: Math.max(4, (v.n / maxV) * 100) + '%' }} /></div>
                  <b className="tb-n">{v.n}</b>
                </div>
              ))}
            {k.conv != null && <p className="fnote">Conversión vista → lead: <b style={{ color: 'var(--lime)' }}>{k.conv}%</b></p>}
          </section>

          <section className="sec">
            <h2>Inventario por valor</h2>
            {k.topInv.map(v => (
              <div className="tb-row" key={v.sku} onClick={() => router.push('/portal/' + v.sku)} style={{ cursor: 'pointer' }}>
                <span className="tb-lbl">{v.nombre}</span>
                <div className="tb-bar lim"><i style={{ width: Math.max(4, (v.val / maxI) * 100) + '%' }} /></div>
                <b className="tb-n">{v.n}</b>
              </div>
            ))}
          </section>

          <section className="sec">
            <h2>Absorción por desarrollo</h2>
            {k.absorcion.length === 0 ? <p className="fnote">Aún sin ventas/apartados para medir absorción.</p> : k.absorcion.map(v => (
              <div className="tb-row" key={v.sku} onClick={() => router.push('/portal/' + v.sku)} style={{ cursor: 'pointer' }}>
                <span className="tb-lbl">{v.nombre}</span>
                <div className="tb-bar mag"><i style={{ width: Math.max(4, v.pct) + '%' }} /></div>
                <b className="tb-n">{v.pct}%</b>
              </div>
            ))}
            <p className="fnote">% de unidades ya colocadas (apartadas o vendidas) sobre el total.</p>
          </section>
        </div>

        {/* Ruteo de leads (SLA) */}
        {puedeRuteo && (
          <section className="sec" style={{ marginTop: '1rem' }}>
            <h2>Ruteo de leads · {org.nombre}</h2>
            <div className="ruteo">
              <div>
                <label className="lbl">Asignación</label>
                <div className="crit-chips">
                  <span className={'chip' + (org.ruteo !== 'round_robin' ? ' on' : '')} onClick={() => guardarRuteo('ruteo', 'manual')}>Manual</span>
                  <span className={'chip' + (org.ruteo === 'round_robin' ? ' on' : '')} onClick={() => guardarRuteo('ruteo', 'round_robin')}>Round-robin automático</span>
                </div>
              </div>
              {org.ruteo === 'round_robin' && (
                <div>
                  <label className="lbl">SLA: reasignar si nadie lo atiende en</label>
                  <div className="crit-chips">
                    {[4, 12, 24, 48].map(h => <span key={h} className={'chip' + ((org.sla_horas || 24) === h ? ' on' : '')} onClick={() => guardarRuteo('sla_horas', h)}>{h} h</span>)}
                  </div>
                </div>
              )}
            </div>
            <p className="fnote">Con round-robin, los leads nuevos se reparten en orden entre el equipo; si uno pasa el SLA sin moverse de “Nuevo”, se reasigna solo y le avisamos al siguiente asesor.</p>
          </section>
        )}

        {/* Ranking del equipo (director / super) */}
        {(esSuper || me?.rol === 'director' || me?.rol === 'gerente') && (
          <section className="sec" style={{ marginTop: '1rem' }}>
            <h2>Ranking del equipo</h2>
            {k.ranking.length === 0 ? <p className="fnote">Aún no hay actividad por asesor.</p> : (
              <div className="utbl-wrap"><table className="utbl"><thead><tr>
                <th>#</th><th>Asesor</th><th>Leads</th><th>Citas</th><th>Apartados</th><th>Comisión ganada</th>
              </tr></thead><tbody>
                {k.ranking.map((r, i) => (
                  <tr key={r.id}>
                    <td><b>{i + 1}</b></td><td><b>{r.nombre}</b></td>
                    <td>{r.leads}</td><td>{r.citas}</td><td>{r.apart}</td>
                    <td><b style={{ color: 'var(--lime)' }}>{MXN(r.com)}</b></td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
