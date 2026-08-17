'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';
import { meses } from '../../lib/matching';
import { listarCards, archivarCard, mejoresMatches, criteriosDeCard } from '../../lib/clientcards';

export default function Clientes() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [cards, setCards] = useState(null);
  const [devs, setDevs] = useState([]);
  const [units, setUnits] = useState([]);
  const [sel, setSel] = useState(null);

  async function recargar() { setCards(await listarCards()); }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,torre,num_depto,rec,banos,n_estac,m2_hab,precio,prototipo,bodega_m2,sku_bodega,estatus').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
      await recargar();
    })();
  }, [router]);

  const enriquecidas = useMemo(() => {
    if (!cards) return null;
    return cards.map(c => {
      const matches = mejoresMatches(c, devs, units, 8);
      return { c, matches, best: matches[0]?.score || 0, nMatch: matches.filter(m => m.score >= 55).length };
    });
  }, [cards, devs, units]);

  function abrirBusqueda(card) {
    const crit = criteriosDeCard(card);
    const q = new URLSearchParams();
    if (crit.recs?.length) q.set('recs', crit.recs.join(','));
    if (crit.presupuestoMax) q.set('presMax', String(crit.presupuestoMax));
    if (crit.zonas?.length) q.set('zona', crit.zonas[0]);
    if (crit.creditos?.length) q.set('creditos', crit.creditos.join(','));
    if (crit.cajonesMin) q.set('cajonesMin', String(crit.cajonesMin));
    if (crit.bodega) q.set('bodega', '1');
    router.push('/buscar?' + q.toString());
  }
  async function archivar(id) { await archivarCard(id); recargar(); setSel(null); }
  function linkCliente(devSku, cardId) {
    return (typeof window !== 'undefined') ? `${window.location.origin}/f/${devSku}?a=${me?.id}&c=${cardId}` : '';
  }
  function waCliente(card, devSku, devNombre) {
    const tel = String(card.telefono || '').replace(/[^0-9]/g, '');
    const link = linkCliente(devSku, card.id);
    const txt = encodeURIComponent(`Hola ${card.nombre?.split(' ')[0] || ''}, te comparto ${devNombre} que encaja con lo que buscas: ${link}`);
    return tel ? `https://wa.me/52${tel.length === 10 ? tel : tel.replace(/^52/, '')}?text=${txt}` : `https://wa.me/?text=${txt}`;
  }

  if (cards === null) return <div className="loading">Cargando clientes…</div>;

  return (
    <>
      <Nav me={me} current="/clientes" logo="Clientes" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Tus clientes y sus matches</h1>
          <p>Cada tarjeta es la búsqueda de un cliente. Cuando entra o cambia inventario, aquí ves qué le queda ahora — sin volver a buscar.</p>
        </div>

        {enriquecidas.length === 0 ? (
          <EmptyState icon="🗂️" title="Aún no guardas clientes">
            Ve al <b onClick={() => router.push('/buscar')} style={{ cursor: 'pointer', color: 'var(--mag)' }}>Buscador</b>, define los criterios de un cliente y toca “Guardar como cliente”. Aquí aparecerá con sus mejores matches.
          </EmptyState>
        ) : (
          <div className="cc-grid">
            {enriquecidas.map(({ c, matches, best, nMatch }) => (
              <article className="cc" key={c.id}>
                <div className="cc-h">
                  <div><h3>{c.nombre}</h3>
                    <span className="cc-sub">{c.telefono || 'sin tel'}{c.email ? ' · ' + c.email : ''}</span>
                  </div>
                  {best > 0 && <span className={'fit ' + (best >= 80 ? 'hi' : best >= 55 ? 'mid' : 'lo')}>{best}%</span>}
                </div>
                <div className="cc-crit">
                  {c.recamaras && <span className="chip2">{c.recamaras} rec</span>}
                  {c.presupuesto_max && <span className="chip2">≤ {MXN(c.presupuesto_max)}</span>}
                  {(c.zonas || []).slice(0, 2).map(z => <span key={z} className="chip2">{z}</span>)}
                  {c.credito && <span className="chip2">{c.credito}</span>}
                </div>
                <div className="cc-match">
                  <b>{nMatch}</b> unidad{nMatch === 1 ? '' : 'es'} le quedan bien hoy
                </div>
                {matches.slice(0, 3).map(({ u, d, score }) => (
                  <div className="cc-row" key={u.sku} onClick={() => router.push('/portal/' + d.sku)}>
                    <div><b>{d.nombre}</b><span className="cc-rowsub">T{u.torre}·{u.num_depto} · {u.rec === 0 ? 'Loft' : u.rec + ' rec'}</span></div>
                    <div className="cc-rowr"><span>{MXN(u.precio)}</span><em className={score >= 80 ? 'hi' : score >= 55 ? 'mid' : 'lo'}>{score}%</em></div>
                  </div>
                ))}
                <div className="cc-acts">
                  <button className="cotiz-mini" onClick={() => abrirBusqueda(c)}>Abrir búsqueda</button>
                  {matches[0] && <a className="cotiz-mini" href={waCliente(c, matches[0].d.sku, matches[0].d.nombre)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>Compartir top</a>}
                  <button className="cotiz-mini" onClick={() => setSel(c)}>Detalle</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {sel && (() => {
          const info = enriquecidas.find(e => e.c.id === sel.id);
          return (
            <>
              <div className="drawer-bg" onClick={() => setSel(null)} />
              <aside className="drawer" onClick={e => e.stopPropagation()}>
                <div className="dw-h"><div><span className="dw-tag">Cliente</span><h2>{sel.nombre}</h2>
                  <div className="ud-sub">{sel.telefono || 'sin tel'}{sel.email ? ' · ' + sel.email : ''}</div></div>
                  <button className="x" onClick={() => setSel(null)}>✕</button></div>
                {sel.notas && <p className="fnote" style={{ marginTop: 0 }}>{sel.notas}</p>}
                <h3 className="mdrawer-h">Mejores matches ahora</h3>
                <div className="ulist">
                  {info.matches.map(({ u, d, score, reasons }) => (
                    <div className="urow" key={u.sku}>
                      <div><b>{d.nombre} · T{u.torre}·{u.num_depto}</b>
                        <span className="urow-piso">{u.rec === 0 ? 'Loft' : u.rec + ' rec'} · {reasons.filter(r => r.m >= 1).slice(0, 2).map(r => r.label).join(' · ')}</span></div>
                      <div className="urow-price">{MXN(u.precio)}<em className={'fit-mini ' + (score >= 80 ? 'hi' : score >= 55 ? 'mid' : 'lo')}> {score}%</em></div>
                    </div>
                  ))}
                </div>
                <div className="cotiz-actions" style={{ marginTop: '1rem' }}>
                  <button className="btn mag block" onClick={() => abrirBusqueda(sel)}>Abrir su búsqueda</button>
                  <button className="btn ghost block" onClick={() => archivar(sel.id)}>Archivar cliente</button>
                </div>
              </aside>
            </>
          );
        })()}
      </main>
    </>
  );
}
