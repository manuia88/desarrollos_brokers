'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';

function hace(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export default function Calor() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [ev, setEv] = useState(null);
  const [cards, setCards] = useState([]);
  const [devs, setDevs] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: e }, { data: c }, { data: d }] = await Promise.all([
        supabase.from('eventos').select('*').order('creado', { ascending: false }).limit(1000),
        supabase.from('client_cards').select('id,nombre,telefono'),
        supabase.from('desarrollos').select('sku,nombre,direccion'),
      ]);
      setEv(e || []); setCards(c || []); setDevs(d || []);
    })();
  }, [router]);

  const devName = useMemo(() => Object.fromEntries(devs.map(d => [d.sku, tituloDev(d)])), [devs]);
  const cardById = useMemo(() => Object.fromEntries(cards.map(c => [String(c.id), c])), [cards]);

  const { porDev, porCliente, feed, totalVistas } = useMemo(() => {
    if (!ev) return { porDev: [], porCliente: [], feed: [], totalVistas: 0 };
    const vistas = ev.filter(x => x.tipo === 'vista_ficha');
    const dev = {}, cli = {};
    vistas.forEach(x => {
      const sku = x.entidad_id;
      (dev[sku] = dev[sku] || { sku, n: 0, last: x.creado }); dev[sku].n++; if (x.creado > dev[sku].last) dev[sku].last = x.creado;
      const cid = x.meta?.client != null ? String(x.meta.client) : null;
      if (cid) { (cli[cid] = cli[cid] || { cid, n: 0, last: x.creado, skus: new Set() }); cli[cid].n++; cli[cid].skus.add(sku); if (x.creado > cli[cid].last) cli[cid].last = x.creado; }
    });
    const porDev = Object.values(dev).sort((a, b) => b.n - a.n);
    const porCliente = Object.values(cli).map(c => ({ ...c, skus: [...c.skus] })).sort((a, b) => (b.last > a.last ? 1 : -1) || b.n - a.n);
    return { porDev, porCliente, feed: ev.slice(0, 40), totalVistas: vistas.length };
  }, [ev]);

  if (ev === null) return <div className="loading">Cargando actividad…</div>;

  const maxDev = porDev[0]?.n || 1;

  return (
    <>
      <Nav me={me} current="/calor" logo="Panel de interés" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Panel de interés</h1>
          <p>Quién está viendo qué. Cuando compartes una ficha con un cliente desde <b onClick={() => router.push('/clientes')} style={{ cursor: 'pointer', color: 'var(--mag)' }}>Clientes</b>, sus aperturas caen aquí — señal de compra en tiempo real.</p>
        </div>

        {totalVistas === 0 ? (
          <EmptyState icon="📡" title="Aún no hay aperturas registradas">
            Comparte una ficha con un cliente (desde Clientes o el botón “Compartir” de un desarrollo). Cada vez que la abra, aparecerá aquí ordenado por interés reciente.
          </EmptyState>
        ) : (
          <div className="calor-grid">
            {/* Clientes calientes */}
            <section className="calor-col">
              <h2 className="calor-h">🔥 Clientes por interés reciente</h2>
              {porCliente.length === 0 ? (
                <p className="fnote">Todavía no hay aperturas ligadas a un cliente. Usa “Compartir” desde una tarjeta de cliente para que se atribuyan.</p>
              ) : porCliente.map(c => {
                const card = cardById[c.cid];
                return (
                  <div className="calor-cli" key={c.cid} onClick={() => router.push('/clientes')}>
                    <div className="calor-cli-h"><b>{card?.nombre || 'Cliente'}</b><span className="hot">{c.n} apertura{c.n === 1 ? '' : 's'}</span></div>
                    <div className="calor-cli-sub">{c.skus.map(s => devName[s] || s).slice(0, 3).join(' · ')}</div>
                    <div className="calor-cli-t">{hace(c.last)}</div>
                  </div>
                );
              })}
            </section>

            {/* Interés por desarrollo */}
            <section className="calor-col">
              <h2 className="calor-h">🏙️ Interés por desarrollo</h2>
              {porDev.map(d => (
                <div className="calor-bar" key={d.sku} onClick={() => router.push('/portal/' + d.sku)}>
                  <div className="calor-bar-h"><b>{devName[d.sku] || d.sku}</b><span>{d.n}</span></div>
                  <div className="calor-bar-t"><i style={{ width: Math.max(6, (d.n / maxDev) * 100) + '%' }} /></div>
                  <div className="calor-bar-s">{hace(d.last)}</div>
                </div>
              ))}
            </section>

            {/* Feed */}
            <section className="calor-col">
              <h2 className="calor-h">🕑 Actividad reciente</h2>
              {feed.map(x => (
                <div className="calor-feed" key={x.id}>
                  <span className="calor-dot" />
                  <div>
                    <b>{x.tipo === 'vista_ficha' ? 'Vio ficha' : x.tipo}</b> — {devName[x.entidad_id] || x.entidad_id}
                    {x.meta?.client != null && cardById[String(x.meta.client)] && <span className="calor-who"> · {cardById[String(x.meta.client)].nombre}</span>}
                    <div className="calor-feed-t">{hace(x.creado)}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
