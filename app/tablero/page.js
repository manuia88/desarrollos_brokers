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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      const meObj = { id: session.user.id, email: session.user.email, ...(prof || {}) };
      setMe(meObj);
      const [u, l, ci, ap, ev, d] = await Promise.all([
        supabase.from('unidades').select('dev_sku,precio,estatus'),
        supabase.from('leads').select('id,etapa,estatus,dev_sku,creado'),
        supabase.from('citas').select('id,estatus,fecha'),
        supabase.from('apartados').select('id,estatus,precio,comision_monto'),
        supabase.from('eventos').select('tipo,entidad_id'),
        supabase.from('desarrollos').select('sku,nombre'),
      ]);
      setData({ u: u.data || [], l: l.data || [], ci: ci.data || [], ap: ap.data || [], ev: ev.data || [], d: d.data || [] });
    })();
  }, [router]);

  const k = useMemo(() => {
    if (!data) return null;
    const { u, l, ci, ap, ev, d } = data;
    const devName = Object.fromEntries(d.map(x => [x.sku, x.nombre]));
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
    return { totalU: u.length, disp: disp.length, vend: vend.length, apar: apar.length, valorDisp, porEtapa, leads: l.length, citasAct, apart: ap.length, comEst, topVistas, topInv, vistas: vistas.length, conv };
  }, [data]);

  if (!k) return <div className="loading">Cargando tablero…</div>;
  const esSuper = me?.rol === 'super_admin';
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
        </div>
      </main>
    </>
  );
}
