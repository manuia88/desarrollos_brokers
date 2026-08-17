'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dias = ts => ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 0;
const wa = (tel, txt) => { const d = String(tel || '').replace(/[^0-9]/g, ''); return d ? `https://wa.me/52${d.length === 10 ? d : d.replace(/^52/, '')}?text=${encodeURIComponent(txt || '')}` : null; };

export default function Hoy() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [citas, setCitas] = useState([]);
  const [devName, setDevName] = useState({});

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: l }, { data: c }, { data: d }] = await Promise.all([
        supabase.from('leads').select('id,nombre,telefono,etapa,estatus,dev_sku,creado,actualizado').order('actualizado', { ascending: true }),
        supabase.from('citas').select('*').gte('fecha', hoyStr()).order('fecha').order('hora'),
        supabase.from('desarrollos').select('sku,nombre'),
      ]);
      setLeads(l || []); setCitas(c || []);
      setDevName(Object.fromEntries((d || []).map(x => [x.sku, x.nombre])));
    })();
  }, [router]);

  const hoy = hoyStr();
  const citasHoy = useMemo(() => citas.filter(c => c.fecha === hoy && ['Solicitada', 'Confirmada'].includes(c.estatus)), [citas, hoy]);
  const citasProx = useMemo(() => citas.filter(c => c.fecha > hoy && ['Solicitada', 'Confirmada'].includes(c.estatus)).slice(0, 5), [citas, hoy]);
  const nuevos = useMemo(() => (leads || []).filter(l => (l.etapa || 'Nuevo') === 'Nuevo' && !/perd|escrit/i.test(l.estatus || '')), [leads]);
  const seguir = useMemo(() => (leads || []).filter(l => ['Contactado', 'Cita', 'Apartado'].includes(l.etapa)).sort((a, b) => dias(b.actualizado) - dias(a.actualizado)).slice(0, 15), [leads]);

  if (leads === null) return <div className="loading">Cargando tu día…</div>;
  const nombre = (me?.nombre || '').split(' ')[0];

  return (
    <>
      <Nav me={me} current="/hoy" logo="Hoy" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Hoy{nombre ? `, ${nombre}` : ''}</h1>
          <p>Tus citas del día, a quién llamar y qué leads no has movido. Empieza por arriba.</p>
        </div>

        <div className="mtiles" style={{ marginBottom: '1.3rem' }}>
          <div className="mtile acc"><b>{citasHoy.length}</b><span>Citas hoy</span></div>
          <div className="mtile"><b>{nuevos.length}</b><span>Nuevos por llamar</span></div>
          <div className="mtile"><b>{seguir.length}</b><span>En seguimiento</span></div>
        </div>

        <div className="hoy-cols">
          <section className="sec">
            <h2>📅 Citas de hoy</h2>
            {citasHoy.length === 0 ? <p className="fnote">Sin citas hoy.</p> : citasHoy.map(c => (
              <div className="hoy-cita" key={c.id}>
                <div className="hoy-hora">{c.hora || '—'}</div>
                <div className="hoy-cita-main"><b>{c.nombre}</b><span>{devName[c.dev_sku] || c.dev_sku || 'Sin desarrollo'} · {c.modalidad || 'Presencial'}</span></div>
                {wa(c.telefono, `Hola ${c.nombre?.split(' ')[0] || ''}, te escribo para confirmar tu cita de hoy.`) && <a className="cotiz-mini" href={wa(c.telefono, `Hola ${c.nombre?.split(' ')[0] || ''}, te confirmo tu cita de hoy.`)} target="_blank" rel="noopener">WhatsApp</a>}
              </div>
            ))}
            {citasProx.length > 0 && <>
              <h2 style={{ marginTop: '1.2rem' }}>Próximas</h2>
              {citasProx.map(c => <div className="hoy-prox" key={c.id}><span>{new Date(c.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {c.hora || ''}</span><b>{c.nombre}</b></div>)}
            </>}
          </section>

          <section className="sec">
            <h2>📞 Nuevos por llamar</h2>
            {nuevos.length === 0 ? <p className="fnote">Ningún lead nuevo sin contactar. 👏</p> : nuevos.slice(0, 12).map(l => (
              <div className="hoy-lead" key={l.id} onClick={() => router.push('/crm')}>
                <div><b>{l.nombre}</b><span className="hoy-lead-sub">{devName[l.dev_sku] || 'Sin desarrollo'} · hace {dias(l.creado)}d</span></div>
                {wa(l.telefono, `Hola ${l.nombre?.split(' ')[0] || ''}, gracias por tu interés. ¿Te queda bien que te llame?`) && <a className="cotiz-mini" href={wa(l.telefono, `Hola ${l.nombre?.split(' ')[0] || ''}, gracias por tu interés.`)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>Escribir</a>}
              </div>
            ))}
          </section>

          <section className="sec">
            <h2>⏳ Sin mover hace días</h2>
            {seguir.length === 0 ? <p className="fnote">Todo tu pipeline está fresco.</p> : seguir.map(l => (
              <div className="hoy-lead" key={l.id} onClick={() => router.push('/crm')}>
                <div><b>{l.nombre}</b><span className="hoy-lead-sub">{l.etapa} · {devName[l.dev_sku] || '—'}</span></div>
                <span className={'hoy-stale' + (dias(l.actualizado) >= 7 ? ' hot' : '')}>{dias(l.actualizado)}d</span>
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
