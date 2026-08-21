'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';

const ROL_LABEL = { director: 'Director', asesor: 'Asesor', independiente: 'Independiente', super_admin: 'Super' };

export default function Equipo() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [sols, setSols] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  async function cargar(prof) {
    const { data: pend } = await supabase.rpc('solicitudes_pendientes');
    setSols(pend || []);
    if (prof?.org_id) {
      const { data: eq } = await supabase.from('profiles').select('id,nombre,email,rol,activo').eq('org_id', prof.org_id).order('rol');
      setEquipo(eq || []);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/equipo'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      const m = { id: session.user.id, email: session.user.email, ...(prof || {}) };
      setMe(m);
      if (m.rol === 'director' || m.rol === 'super_admin') await cargar(m);
      else setSols([]);
    })();
  }, [router]);

  async function resolver(id, aprobar) {
    setBusy(id); setMsg(null);
    const { error } = await supabase.rpc('resolver_ingreso', { p_sol: id, p_aprobar: aprobar });
    setBusy(null);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: aprobar ? 'Asesor aprobado y agregado a tu equipo.' : 'Solicitud rechazada.' });
    await cargar(me);
  }

  if (sols === null) return <div className="loading">Cargando…</div>;

  const puede = me?.rol === 'director' || me?.rol === 'super_admin';

  return (
    <>
      <Nav me={me} current="/equipo" logo="Equipo" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Mi equipo</h1>
          <p>Aprueba a los asesores que piden unirse a tu inmobiliaria y revisa quién está en tu equipo.</p>
        </div>

        {!puede ? (
          <EmptyState icon="🔒" title="Solo para directores">
            Esta sección es para el director de la inmobiliaria. Si crees que debería ser tuya, contacta al administrador.
          </EmptyState>
        ) : (
          <>
            {msg && <div className={'msg ' + msg.t} style={{ marginBottom: '1rem' }}>{msg.m}</div>}

            <div className="inbox">
              <h2><span className="warn-ic">📥</span> Solicitudes de ingreso</h2>
              <p className="sub">Asesores que quieren unirse a tu inmobiliaria. Al aprobar, entran a tu equipo.</p>
              {sols.length === 0 ? (
                <p className="fnote" style={{ padding: '.4rem 0 .2rem' }}>No hay solicitudes pendientes.</p>
              ) : sols.map(s => (
                <div className="rev-row" key={s.id}>
                  <div className="who">
                    <b>{s.asesor_nombre || 'Asesor'}</b>
                    <small>{s.asesor_email || ''}{s.asesor_tel ? ' · ' + s.asesor_tel : ''}{me.rol === 'super_admin' ? ' · ' + s.org_nombre : ''}</small>
                  </div>
                  <button className="btn ok sm" disabled={busy === s.id} onClick={() => resolver(s.id, true)}>Aprobar</button>
                  <button className="btn no sm" disabled={busy === s.id} onClick={() => resolver(s.id, false)}>Rechazar</button>
                </div>
              ))}
            </div>

            <section className="sec" style={{ marginTop: '1.2rem' }}>
              <h2>Equipo ({equipo.length})</h2>
              {equipo.length === 0 ? <p className="fnote">Aún no hay miembros.</p> : (
                <div className="kv" style={{ marginTop: '.4rem' }}>
                  {equipo.map(p => (
                    <div className="kvrow" key={p.id}>
                      <span>{p.nombre || p.email}{!p.activo ? ' (inactivo)' : ''}</span>
                      <b>{ROL_LABEL[p.rol] || p.rol}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
