'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { subirLogo, subirFotoAsesor, guardarTelefono } from '../../lib/marca';

export default function Marca() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [org, setOrg] = useState(null);
  const [tel, setTel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }
    const { data: prof } = await supabase.from('profiles').select('id,nombre,rol,org_id,telefono,foto_url').eq('id', session.user.id).single();
    setMe({ email: session.user.email, ...(prof || {}) });
    setTel(prof?.telefono || '');
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

  if (!me) return <div className="loading">Cargando…</div>;
  const puedeLogo = org && (me.rol === 'director' || me.rol === 'super_admin' || me.rol === 'independiente');

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Mi marca</span>
        <nav className="nav">
          <a onClick={() => router.push('/crm')}>CRM</a>
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

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
      </main>
    </>
  );
}
