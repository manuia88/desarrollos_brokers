'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { subirLogo, subirFotoAsesor, guardarTelefono } from '../../lib/marca';

export default function Marca() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [org, setOrg] = useState(null);
  const [tel, setTel] = useState('');
  const [calcom, setCalcom] = useState('');
  const [gmsg, setGmsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('google');
    if (p === 'ok') setGmsg({ t: 'ok', m: 'Google Calendar conectado.' });
    else if (p === 'error') setGmsg({ t: 'err', m: 'No se pudo conectar Google Calendar. Revisa la configuración de credenciales.' });
  }, []);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }
    const { data: prof } = await supabase.from('profiles').select('id,nombre,rol,org_id,telefono,foto_url,calcom_url,google_email').eq('id', session.user.id).single();
    setMe({ email: session.user.email, ...(prof || {}) });
    setTel(prof?.telefono || '');
    setCalcom(prof?.calcom_url || '');
    if (prof?.org_id) {
      const { data: o } = await supabase.from('orgs').select('id,nombre,logo_url,tipo').eq('id', prof.org_id).single();
      setOrg(o || null);
    } else setOrg(null);
  }
  useEffect(() => { load(); }, []);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  async function onLogo(file) {
    if (!file || !org) return;
    setBusy(true); setMsg(null);
    const { error } = await subirLogo({ file, org_id: org.id });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Logo actualizado.' }); await load();
  }
  async function onFoto(file) {
    if (!file) return;
    setBusy(true); setMsg(null);
    const { error } = await subirFotoAsesor({ file, user_id: me.id });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Foto actualizada.' }); await load();
  }
  async function onTel() {
    setBusy(true); setMsg(null);
    const { error } = await guardarTelefono(me.id, tel.trim() || null);
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Teléfono guardado.' }); await load();
  }
  async function onCalcom() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('profiles').update({ calcom_url: calcom.trim() || null }).eq('id', me.id);
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Cal.com guardado.' }); await load();
  }
  async function conectarGoogle() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    // El token va en el header (no en la URL); el servidor devuelve un nonce de un solo uso.
    const r = await fetch('/api/google/connect', { method: 'POST', headers: { authorization: 'Bearer ' + session.access_token } });
    const j = await r.json().catch(() => ({}));
    if (j.n) window.location.href = '/api/google/connect?n=' + j.n;
    else setMsg({ t: 'err', m: 'No se pudo iniciar la conexión con Google.' });
  }
  async function desconectarGoogle() {
    const { data: { session } } = await supabase.auth.getSession();
    setBusy(true);
    await fetch('/api/google/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session?.access_token }) });
    setBusy(false); setGmsg(null); await load();
  }

  if (!me) return <div className="loading">Cargando…</div>;
  const puedeLogo = org && (me.rol === 'director' || me.rol === 'super_admin' || me.rol === 'independiente');

  return (
    <>
      <Nav me={me} current="/marca" />

      <main className="wrap" style={{ maxWidth: 720 }}>
        <div className="buscar-intro">
          <h1>Mi marca</h1>
          <p>Con estos datos salen brandeadas las fichas que compartes: el logo de tu inmobiliaria y tu contacto como asesor.</p>
        </div>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        <section className="marca-card">
          <h3>Inmobiliaria</h3>
          {org ? <>
            <div className="marca-row">
              <div className="marca-logo">{org.logo_url ? <img src={org.logo_url} alt="logo" /> : <span>Sin logo</span>}</div>
              <div>
                <b>{org.nombre}</b>
                {puedeLogo ? (
                  <label className="marca-upload">Subir logo
                    <input type="file" accept="image/*" hidden onChange={e => onLogo(e.target.files?.[0])} />
                  </label>
                ) : <p className="fnote" style={{ marginTop: '.3rem' }}>Solo el director puede cambiar el logo.</p>}
              </div>
            </div>
          </> : <p className="fnote">Aún no perteneces a una inmobiliaria aprobada.</p>}
        </section>

        <section className="marca-card">
          <h3>Mi contacto como asesor</h3>
          <div className="marca-row">
            <div className="marca-foto">{me.foto_url ? <img src={me.foto_url} alt="foto" /> : <span>{(me.nombre || '?').slice(0, 1)}</span>}</div>
            <div style={{ flex: 1 }}>
              <b>{me.nombre}</b>
              <label className="marca-upload">Subir foto
                <input type="file" accept="image/*" hidden onChange={e => onFoto(e.target.files?.[0])} />
              </label>
            </div>
          </div>
          <div className="dw-field" style={{ marginTop: '.8rem' }}><label>Teléfono / WhatsApp (con lada)</label>
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="55 1234 5678" /></div>
          <button className="btn mag sm" disabled={busy} onClick={onTel}>Guardar teléfono</button>
        </section>

        <section className="marca-card">
          <h3>Agenda y calendario</h3>
          {gmsg && <div className={'msg ' + gmsg.t} style={{ marginBottom: '.6rem' }}>{gmsg.m}</div>}
          <div className="dw-field"><label>Tu link de Cal.com</label>
            <input value={calcom} onChange={e => setCalcom(e.target.value)} placeholder="cal.com/tu-usuario" /></div>
          <button className="btn mag sm" disabled={busy} onClick={onCalcom}>Guardar Cal.com</button>
          <p className="fnote">Cuando lo pones, tu ficha pública muestra <b>“Reservar un horario”</b> con tu calendario en vivo — Cal.com sincroniza a Google/Outlook por su cuenta.</p>

          <div style={{ borderTop: '1px solid var(--line)', margin: '1.1rem 0 .9rem' }} />
          <div className="marca-row" style={{ justifyContent: 'space-between' }}>
            <div><b>Google Calendar (directo)</b>
              <div className="fnote" style={{ marginTop: '.2rem' }}>{me.google_email ? 'Conectado como ' + me.google_email : 'No conectado'}</div></div>
            {me.google_email
              ? <button className="btn ghost sm" disabled={busy} onClick={desconectarGoogle}>Desconectar</button>
              : <button className="btn lim sm" onClick={conectarGoogle}>Conectar Google Calendar</button>}
          </div>
          <p className="fnote">Al conectarlo, las citas que agenden tus clientes se crean solas en tu Google Calendar. Requiere que DesarrollosMX haya configurado las credenciales de Google.</p>
        </section>
      </main>
    </>
  );
}
