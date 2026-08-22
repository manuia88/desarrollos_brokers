'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { tituloDev } from '../../lib/nombre';
import Nav from '../../components/Nav';
import { MXN, Kpi, EmptyState } from '../../components/ui';

// Diario de inventario: lee cambios_inventario (lo llenan triggers en Postgres
// con cada sync del Sheet o edición manual) y lo agrupa por día CDMX.

const TIPO = {
  alta:    { ic: '🆕', lbl: 'Nueva unidad' },
  baja:    { ic: '🗑️', lbl: 'Baja (salió del Sheet)' },
  precio:  { ic: '💲', lbl: 'Cambio de precio' },
  estatus: { ic: '🔄', lbl: 'Cambio de estatus' },
};
const diaCDMX = ts => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
const diaBonito = k => new Date(k + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Cambios() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [cambios, setCambios] = useState(null);
  const [devs, setDevs] = useState([]);
  const [filtroDev, setFiltroDev] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: cs }, { data: dv }] = await Promise.all([
        supabase.from('cambios_inventario').select('*').order('fecha', { ascending: false }).limit(20000),
        supabase.from('desarrollos').select('sku,nombre,direccion'),
      ]);
      setCambios(cs || []); setDevs(dv || []);
    })();
  }, [router]);

  const devName = useMemo(() => Object.fromEntries(devs.map(d => [d.sku, tituloDev(d)])), [devs]);

  const dias = useMemo(() => {
    if (!cambios) return [];
    const porDia = new Map();
    for (const c of cambios) {
      if (filtroDev && c.dev_sku !== filtroDev) continue;
      const k = diaCDMX(c.fecha);
      if (!porDia.has(k)) porDia.set(k, []);
      porDia.get(k).push(c);
    }
    return [...porDia.entries()].map(([k, rows]) => {
      const n = t => rows.filter(r => r.tipo === t).length;
      const subieron = rows.filter(r => r.tipo === 'precio' && (r.despues?.precio || 0) > (r.antes?.precio || 0)).length;
      const devsAf = [...new Set(rows.map(r => r.dev_sku).filter(Boolean))];
      return { k, rows, altas: n('alta'), bajas: n('baja'), precios: n('precio'), subieron, estatus: n('estatus'), devsAf };
    });
  }, [cambios, filtroDev]);

  if (cambios === null) return <div className="loading">Cargando cambios…</div>;
  const tot = t => dias.reduce((s, d) => s + d[t], 0);
  const devsConCambios = [...new Set(cambios.map(c => c.dev_sku).filter(Boolean))];

  return (
    <>
      <Nav me={me} current="/cambios" logo="Cambios" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Cambios de inventario</h1>
          <p>Diario automático: cada sync del Sheet (o edición manual) deja registro de altas, bajas y cambios de precio o estatus.</p>
        </div>

        {cambios.length === 0 ? (
          <EmptyState icon="🔁" title="Aún sin cambios registrados">
            El diario empezó a grabar hoy. Con el próximo sync del Sheet que traiga altas, bajas o cambios de precio/estatus, aquí aparecerá el resumen por día.
          </EmptyState>
        ) : (
          <>
            <div className="mgrid" style={{ marginBottom: '1rem' }}>
              <Kpi value={tot('altas')} label="Unidades nuevas" />
              <Kpi value={tot('bajas')} label="Bajas" />
              <Kpi value={tot('precios')} label="Cambios de precio" accent />
              <Kpi value={tot('estatus')} label="Cambios de estatus" />
            </div>

            {devsConCambios.length > 1 && (
              <div className="cmb-filtro">
                <span className={'chip' + (!filtroDev ? ' on' : '')} onClick={() => setFiltroDev('')}>Todos</span>
                {devsConCambios.map(sku => (
                  <span key={sku} className={'chip' + (filtroDev === sku ? ' on' : '')} onClick={() => setFiltroDev(filtroDev === sku ? '' : sku)}>
                    {devName[sku] || sku}
                  </span>
                ))}
              </div>
            )}

            {dias.map((d, i) => (
              <details className="cmb-dia" key={d.k} open={i === 0}>
                <summary>
                  <b>{diaBonito(d.k)}</b>
                  <span className="cmb-resumen">
                    {d.altas > 0 && <em className="cmb-tag alta">🆕 {d.altas}</em>}
                    {d.bajas > 0 && <em className="cmb-tag baja">🗑️ {d.bajas}</em>}
                    {d.precios > 0 && <em className="cmb-tag precio">💲 {d.precios} ({d.subieron}↑ {d.precios - d.subieron}↓)</em>}
                    {d.estatus > 0 && <em className="cmb-tag">🔄 {d.estatus}</em>}
                    <em className="cmb-devs">{d.devsAf.length} {d.devsAf.length === 1 ? 'desarrollo' : 'desarrollos'}</em>
                  </span>
                </summary>
                <div className="cmb-devchips">
                  {d.devsAf.map(sku => <span key={sku} className="chip sm" onClick={() => router.push('/portal/' + sku)}>{devName[sku] || sku}</span>)}
                </div>
                <div className="cmb-rows">
                  {d.rows.map(c => (
                    <div className="cmb-row" key={c.id}>
                      <span className="cmb-ic">{TIPO[c.tipo]?.ic || '•'}</span>
                      <span className="cmb-dev">{devName[c.dev_sku] || c.dev_sku || '—'}</span>
                      <span className="cmb-sku">{c.sku}</span>
                      <span className="cmb-det">
                        {c.tipo === 'precio' && <>{MXN(c.antes?.precio)} → <b>{MXN(c.despues?.precio)}</b></>}
                        {c.tipo === 'estatus' && <>{c.antes?.estatus || '—'} → <b>{c.despues?.estatus || '—'}</b></>}
                        {c.tipo === 'alta' && <>{TIPO.alta.lbl}{c.despues?.precio ? ` · ${MXN(c.despues.precio)}` : ''}</>}
                        {c.tipo === 'baja' && <>{TIPO.baja.lbl}{c.antes?.precio ? ` · era ${MXN(c.antes.precio)}` : ''}</>}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </>
        )}
      </main>
    </>
  );
}
