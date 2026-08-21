'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Unirme() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [sol, setSol] = useState(null);        // solicitud pendiente actual
  const [msg, setMsg] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/unirme'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      if (prof?.org_id) { router.replace('/portal'); return; }   // ya pertenece a una org
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const { data: ms } = await supabase.rpc('mi_solicitud');
      if (ms && ms[0] && ms[0].estado === 'pendiente') setSol(ms[0]);
      setReady(true);
    })();
  }, [router]);

  function onQ(v) {
    setQ(v); setMsg(null);
    clearTimeout(timer.current);
    if (v.trim().length < 2) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      const { data } = await supabase.rpc('buscar_orgs', { q: v.trim() });
      setRes(data || []); setBuscando(false);
    }, 300);
  }

  async function pedir(org) {
    setMsg(null);
    const { error } = await supabase.rpc('solicitar_ingreso', { p_org: org.id });
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setSol({ org_id: org.id, org_nombre: org.nombre, estado: 'pendiente' });
  }

  async function cancelar() {
    // Cancelar = pedir de nuevo cambia; para "cambiar" simplemente reabrimos el buscador.
    setSol(null); setRes([]); setQ('');
  }

  if (!ready) return <div className="loading">Cargando…</div>;

  return (
    <div className="authwrap">
      <div className="authcard" style={{ maxWidth: 520 }}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>D</b>DesarrollosMX</span>

        {sol ? (
          <>
            <h1>Solicitud enviada</h1>
            <p className="sub">Le pediste ingreso a <b>{sol.org_nombre}</b>. En cuanto el director la apruebe, entras a tu portal.</p>
            <div className="msg ok" style={{ marginTop: '.4rem' }}>Estado: pendiente de aprobación.</div>
            <button className="btn ghost block" style={{ marginTop: '1rem' }} onClick={cancelar}>Elegir otra inmobiliaria</button>
            <p className="alt">Mientras tanto puedes <button type="button" onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }} style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', font: 'inherit', padding: 0 }}>salir</button> y volver luego.</p>
          </>
        ) : (
          <>
            <h1>Elige tu inmobiliaria</h1>
            <p className="sub">Escribe el nombre de la inmobiliaria a la que perteneces y selecciónala de la lista. Así te unes a la que ya existe (sin crear duplicados).</p>
            {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
            <div className="field">
              <label>Nombre de la inmobiliaria</label>
              <input value={q} onChange={e => onQ(e.target.value)} placeholder="Ej. Pulppo, Century 21 Reforma…" autoFocus />
            </div>

            {buscando && <p className="fnote">Buscando…</p>}

            {!buscando && q.trim().length >= 2 && res.length === 0 && (
              <div className="msg" style={{ background: 'var(--panel2)', color: 'var(--sub)', border: '1px solid var(--line)' }}>
                No encontramos una inmobiliaria así. Revisa el nombre, o si aún no está en el portal,{' '}
                <Link href="/registro?modo=inmobiliaria">regístrala</Link>.
              </div>
            )}

            {res.map(o => (
              <div className="rev-row" key={o.id}>
                <div className="who"><b>{o.nombre}</b><small>{o.estado === 'activo' ? 'Activa' : 'En revisión'}{o.sim < 1 ? ' · coincidencia aproximada' : ''}</small></div>
                <button className="btn ok sm" onClick={() => pedir(o)}>Solicitar unirme</button>
              </div>
            ))}

            <p className="alt" style={{ marginTop: '1.2rem' }}>¿Eres tú la inmobiliaria (no un asesor)? <Link href="/registro?modo=inmobiliaria">Regístrala aquí</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
