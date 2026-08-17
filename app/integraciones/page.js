'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

export default function Integraciones() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [token, setToken] = useState('');
  const [estado, setEstado] = useState(null);
  const [err, setErr] = useState(null);
  const [sync, setSync] = useState(null);
  const [copiado, setCopiado] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      const meObj = { id: session.user.id, email: session.user.email, ...(prof || {}) };
      setMe(meObj);
      if (prof?.rol !== 'super_admin') { router.replace('/portal'); return; }
      setToken(session.access_token);
      try {
        const r = await fetch('/api/integraciones/status', { headers: { Authorization: 'Bearer ' + session.access_token } });
        const j = await r.json();
        if (j.error) setErr(j.error); else setEstado(j);
      } catch (e) { setErr(String(e?.message || e)); }
    })();
  }, [router]);

  function copiar(txt, id) { if (navigator.clipboard) { navigator.clipboard.writeText(txt); setCopiado(id); setTimeout(() => setCopiado(''), 1500); } }
  async function sincronizar() {
    setSync({ loading: true });
    try {
      const r = await fetch('/api/integraciones/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      setSync(await r.json());
    } catch (e) { setSync({ error: String(e?.message || e) }); }
  }

  if (!me) return <div className="loading">Cargando…</div>;

  const webhooks = [
    ['Webhook universal de leads (POST)', `${origin}/api/webhooks/lead`, 'lead'],
    ['Meta Lead Ads (Callback URL)', `${origin}/api/webhooks/meta`, 'meta'],
    ['Empujar leads a CRMs (dispatch)', `${origin}/api/integraciones/dispatch`, 'disp'],
  ];

  return (
    <>
      <Nav me={me} current="/integraciones" logo="Integraciones" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Integraciones</h1>
          <p>Todo está cableado. Cada conector se enciende solo cuando agregas sus llaves en Vercel (Production → Environment Variables) y haces redeploy. Aquí ves qué está conectado.</p>
        </div>

        {err && <div className="cap-msg err">{err}</div>}

        <div className="mat-grid">
          {estado && Object.entries(estado.estado).map(([k, p]) => (
            <article className="intg" key={k}>
              <div className="intg-h">
                <div><h3>{p.label}</h3><span className={'intg-dir ' + p.dir}>{p.dir === 'entrada' ? '↓ entrada' : '↑ salida'}</span></div>
                <span className={'intg-st ' + (p.configured ? 'on' : 'off')}>{p.configured ? '● Conectado' : '○ Falta configurar'}</span>
              </div>
              <p className="intg-doc">{p.doc}</p>
              <div className="intg-env">Variables: {p.env.map(e => <code key={e} className={estado ? '' : ''}>{e}</code>)}</div>
            </article>
          ))}
        </div>

        <section className="sec" style={{ marginTop: '1.4rem' }}>
          <h2>URLs para configurar en cada proveedor</h2>
          {webhooks.map(([label, url, id]) => (
            <div className="wh-row" key={id}>
              <div><b>{label}</b><div className="wh-url">{url}</div></div>
              <button className="btn ghost sm" onClick={() => copiar(url, id)}>{copiado === id ? '¡Copiado!' : 'Copiar'}</button>
            </div>
          ))}
          <p className="fnote">El webhook universal y el de dispatch requieren el header <code>x-webhook-secret</code> con el valor de <code>INTEGRACIONES_WEBHOOK_SECRET</code>. Para Meta, el <b>Verify Token</b> es <code>META_VERIFY_TOKEN</code>.</p>
        </section>

        <section className="sec">
          <h2>EasyBroker · importar listados</h2>
          <p className="fnote" style={{ marginTop: 0 }}>Trae los listados de EasyBroker como desarrollos en borrador (los revisas y publicas en Captura). Requiere <code>EASYBROKER_API_KEY</code>.</p>
          <button className="btn mag sm" onClick={sincronizar} disabled={sync?.loading}>{sync?.loading ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
          {sync && !sync.loading && (sync.error
            ? <div className="cap-msg err" style={{ marginTop: '.6rem' }}>{sync.error}</div>
            : <div className="cap-msg ok" style={{ marginTop: '.6rem' }}>✓ {sync.importados} de {sync.total} listados importados como borrador.</div>)}
        </section>

        <p className="fnote">¿Qué llave necesita cada quién? Está en <b>SETUP-INTEGRACIONES.md</b> dentro del repo. También define <code>DEFAULT_ORG_ID</code> para saber a qué inmobiliaria caen los leads de entrada.</p>
      </main>
    </>
  );
}
