'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN } from '../../components/ui';

const dias = ts => ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 0;

export default function Pricing() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      if (prof?.rol !== 'super_admin') { router.replace('/portal'); return; }
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [ev, ld, un, de] = await Promise.all([
        supabase.from('eventos').select('tipo,entidad_id,meta').limit(5000),
        supabase.from('leads').select('dev_sku'),
        supabase.from('unidades').select('dev_sku,precio,estatus,creado,m2_hab,rec'),
        supabase.from('desarrollos').select('sku,nombre,comision_broker,etapa'),
      ]);
      setD({ ev: ev.data || [], ld: ld.data || [], un: un.data || [], de: de.data || [] });
    })();
  }, [router]);

  const rows = useMemo(() => {
    if (!d) return [];
    const devName = Object.fromEntries(d.de.map(x => [x.sku, x]));
    const vistas = {}; d.ev.filter(e => e.tipo === 'vista_ficha').forEach(e => { vistas[e.entidad_id] = (vistas[e.entidad_id] || 0) + 1; });
    const busq = {}; // demanda por zona/rec desde búsquedas (para contexto)
    d.ev.filter(e => e.tipo === 'busqueda').forEach(e => { const z = e.meta?.criterios?.zona; if (z) busq[z] = (busq[z] || 0) + 1; });
    const leads = {}; d.ld.forEach(l => { if (l.dev_sku) leads[l.dev_sku] = (leads[l.dev_sku] || 0) + 1; });
    const g = {};
    d.un.forEach(u => { g[u.dev_sku] = g[u.dev_sku] || { total: 0, disp: [], creados: [] }; g[u.dev_sku].total++; if (u.estatus === 'Disponible') { g[u.dev_sku].disp.push(u); g[u.dev_sku].creados.push(dias(u.creado)); } });
    return Object.entries(g).map(([sku, o]) => {
      const disponibles = o.disp.length, colocadas = o.total - disponibles;
      const absor = o.total ? Math.round(colocadas / o.total * 100) : 0;
      const v = vistas[sku] || 0, l = leads[sku] || 0;
      const interes = v + l * 3;
      const diasProm = o.creados.length ? Math.round(o.creados.reduce((a, b) => a + b, 0) / o.creados.length) : 0;
      let rec = 'mantener', razon = 'Oferta y demanda equilibradas.';
      if (disponibles > 0 && (absor >= 40 || (interes >= 10 && disponibles <= 8))) { rec = 'subir'; razon = `Alta demanda (${v} vistas, ${l} leads) vs poco inventario (${disponibles} disp., ${absor}% colocado).`; }
      else if ((interes <= 1 && disponibles >= 15) || diasProm >= 90) { rec = 'bajar'; razon = `Baja tracción (${v} vistas, ${l} leads) con ${disponibles} disponibles${diasProm >= 90 ? ` y ${diasProm} días en inventario` : ''}.`; }
      const dv = devName[sku] || {};
      return { sku, nombre: dv.nombre || sku, disponibles, absor, v, l, diasProm, rec, razon, com: dv.comision_broker ? Math.round(dv.comision_broker * 100) : null, desde: disponibles ? Math.min(...o.disp.map(x => x.precio || Infinity)) : null };
    }).sort((a, b) => ({ subir: 0, bajar: 1, mantener: 2 }[a.rec] - { subir: 0, bajar: 1, mantener: 2 }[b.rec]) || b.v - a.v);
  }, [d]);

  if (!d) return <div className="loading">Analizando…</div>;
  const n = k => rows.filter(r => r.rec === k).length;
  const BADGE = { subir: ['es', '↑ Considera subir'], bajar: ['cx', '↓ Considera bajar / promo'], mantener: ['ap', '→ Mantener'] };

  return (
    <>
      <Nav me={me} current="/pricing" logo="Pricing" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Sugerencias de precio</h1>
          <p>Señales basadas en datos —demanda (vistas, leads) vs oferta (disponibles, absorción, días en inventario)— para decidir dónde ajustar precio. Son sugerencias con evidencia; la decisión es tuya.</p>
        </div>

        <div className="mtiles" style={{ marginBottom: '1.3rem' }}>
          <div className="mtile" style={{ borderColor: 'rgba(198,255,58,.3)' }}><b style={{ color: 'var(--lime)' }}>{n('subir')}</b><span>Considera subir</span></div>
          <div className="mtile" style={{ borderColor: 'rgba(255,80,110,.3)' }}><b style={{ color: '#ff8fa3' }}>{n('bajar')}</b><span>Considera bajar</span></div>
          <div className="mtile"><b>{n('mantener')}</b><span>Mantener</span></div>
        </div>

        <div className="utbl-wrap"><table className="utbl"><thead><tr>
          <th>Desarrollo</th><th>Desde</th><th>Disp.</th><th>Absorción</th><th>Vistas</th><th>Leads</th><th>Días inv.</th><th>Sugerencia</th>
        </tr></thead><tbody>
          {rows.map(r => (
            <tr key={r.sku}>
              <td><b>{r.nombre}</b>{r.com ? <span className="pv-u" style={{ marginLeft: '.4rem' }}>{r.com}%</span> : null}</td>
              <td>{r.desde ? MXN(r.desde) : '—'}</td>
              <td>{r.disponibles}</td>
              <td>{r.absor}%</td>
              <td>{r.v}</td><td>{r.l}</td><td>{r.diasProm}</td>
              <td><span className={'ap-badge ' + BADGE[r.rec][0]} title={r.razon}>{BADGE[r.rec][1]}</span></td>
            </tr>
          ))}
        </tbody></table></div>
        <p className="fnote">Pasa el cursor sobre la sugerencia para ver el porqué. Estas señales mejoran conforme el portal acumula vistas, búsquedas y leads reales.</p>
      </main>
    </>
  );
}
