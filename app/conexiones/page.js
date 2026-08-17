'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const STAGING_KEY = 'l7u502p8v46ba3ppgvj5y2aad50lb9';

export default function Conexiones() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [token, setToken] = useState('');
  const [conns, setConns] = useState([]);
  const [modo, setModo] = useState('org');
  const [form, setForm] = useState({ ambiente: 'produccion', api_key: '', etiqueta: '' });
  const [msg, setMsg] = useState(null);

  const esDirectivo = me && ['director', 'gerente', 'independiente', 'super_admin'].includes(me.rol);
  const scope = me && me.rol === 'asesor' ? 'asesor' : 'org';

  async function cargar() {
    const { data } = await supabase.rpc('mis_conexiones');
    setConns(data || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      setToken(session.access_token);
      if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('eb_modo').eq('id', prof.org_id).maybeSingle(); if (o?.eb_modo) setModo(o.eb_modo); }
      await cargar();
    })();
  }, [router]);

  async function guardarModo(m) { setModo(m); await supabase.rpc('set_eb_modo', { p_modo: m }); }
  async function conectar() {
    setMsg({ t: 'load' });
    try {
      const r = await fetch('/api/integraciones/conectar', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor: 'easybroker', scope, ambiente: form.ambiente, api_key: form.api_key, etiqueta: form.etiqueta }),
      });
      const j = await r.json();
      if (j.error) setMsg({ t: 'err', m: j.error });
      else { setMsg({ t: 'ok', m: j.valida ? '✓ Cuenta conectada y validada.' : '⚠ Guardada, pero la llave no validó (revisa que sea correcta y el ambiente).' }); setForm({ ambiente: 'produccion', api_key: '', etiqueta: '' }); cargar(); }
    } catch (e) { setMsg({ t: 'err', m: String(e?.message || e) }); }
  }
  async function desconectar(id) {
    await fetch('/api/integraciones/conectar', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    cargar();
  }

  if (!me) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/conexiones" logo="Conexiones" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Conecta tu cuenta de EasyBroker</h1>
          <p>Aquí guardas tu API key para publicar tu inventario y recibir tus leads. La llave se guarda cifrada en el servidor y nunca se muestra de vuelta.</p>
        </div>

        {me.rol === 'super_admin' && <div className="cap-msg" style={{ background: 'var(--panel2)', border: '1px solid var(--line)', color: 'var(--sub)' }}>Como super-admin (desarrollador), tu inventario usa la llave global <code>EASYBROKER_API_KEY</code> de Vercel. Esta pantalla es para que cada inmobiliaria o broker conecte SU cuenta.</div>}

        {/* Política de la inmobiliaria */}
        {esDirectivo && me.rol !== 'independiente' && (
          <section className="sec">
            <h2>¿Cómo publica tu inmobiliaria?</h2>
            <div className="crit-chips">
              <span className={'chip' + (modo === 'org' ? ' on' : '')} onClick={() => guardarModo('org')}>Una cuenta para todos</span>
              <span className={'chip' + (modo === 'asesor' ? ' on' : '')} onClick={() => guardarModo('asesor')}>Cada asesor su cuenta</span>
            </div>
            <p className="fnote" style={{ marginTop: '.5rem' }}>{modo === 'org' ? 'Todos publican con la cuenta de la inmobiliaria (una sola presencia en portales).' : 'Cada asesor conecta y publica con su propia cuenta de EasyBroker.'} Para portales inmobiliarios conviene una sola cuenta por inmobiliaria.</p>
          </section>
        )}

        {/* Conectar */}
        {(scope === 'org' ? esDirectivo && me.rol !== 'super_admin' : true) ? (
          <section className="sec">
            <h2>Conectar {scope === 'org' ? 'la cuenta de la inmobiliaria' : 'mi cuenta'}</h2>
            <div className="crit-chips" style={{ marginBottom: '.6rem' }}>
              <span className={'chip' + (form.ambiente === 'produccion' ? ' on' : '')} onClick={() => setForm(f => ({ ...f, ambiente: 'produccion' }))}>Producción</span>
              <span className={'chip' + (form.ambiente === 'staging' ? ' on' : '')} onClick={() => setForm(f => ({ ...f, ambiente: 'staging' }))}>Pruebas (staging)</span>
              {form.ambiente === 'staging' && <button className="chip" onClick={() => setForm(f => ({ ...f, api_key: STAGING_KEY }))}>Usar llave de prueba</button>}
            </div>
            <label className="lbl">API Key de EasyBroker</label>
            <input className="inp" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="Pega tu API key aquí" />
            <label className="lbl">Etiqueta (opcional)</label>
            <input className="inp" value={form.etiqueta} onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))} placeholder="Ej. Cuenta principal" />
            <button className="btn mag block" style={{ marginTop: '.8rem' }} disabled={!form.api_key || msg?.t === 'load'} onClick={conectar}>{msg?.t === 'load' ? 'Validando…' : 'Conectar'}</button>
            {msg && msg.t !== 'load' && <div className={'cap-msg ' + (msg.t === 'ok' ? 'ok' : 'err')} style={{ marginTop: '.7rem' }}>{msg.m}</div>}
            <p className="fnote">Tu API key la sacas de EasyBroker → Configuración → API. Para probar sin cuenta, usa el ambiente de pruebas con la llave de prueba.</p>
          </section>
        ) : (
          <section className="sec"><p className="fnote" style={{ margin: 0 }}>Tu inmobiliaria está en modo “una cuenta para todos”: la conexión la hace el director. Si el modo es “cada asesor su cuenta”, aquí conectarás la tuya.</p></section>
        )}

        {/* Conexiones actuales */}
        {conns.length > 0 && (
          <section className="sec">
            <h2>Cuentas conectadas</h2>
            {conns.map(c => (
              <div className="camp" key={c.id}>
                <div className="camp-main"><b>{c.proveedor} · {c.scope === 'org' ? 'inmobiliaria' : 'asesor'}</b>
                  <span className="camp-sub">{c.ambiente}{c.etiqueta ? ' · ' + c.etiqueta : ''} · {c.valida ? '✓ validada' : '⚠ sin validar'}</span></div>
                <button className="regla-x" onClick={() => desconectar(c.id)}>✕</button>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
