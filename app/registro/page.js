'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Registro() {
  const [tipo, setTipo] = useState('inmobiliaria');
  const [nombreOrg, setNombreOrg] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rfc, setRfc] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { nombre } },
    });
    if (error) { setLoading(false); setMsg({ t: 'err', m: error.message }); return; }
    // Si la sesión ya está activa (confirmación de correo desactivada), crea la organización.
    if (data.session) {
      const { error: e2 } = await supabase.rpc('registrar_org', {
        p_nombre: nombreOrg, p_tipo: tipo, p_rfc: rfc || null,
      });
      setLoading(false);
      if (e2) { setMsg({ t: 'err', m: e2.message }); return; }
      setMsg({ t: 'ok', m: '¡Cuenta creada! Tu registro quedó en revisión para aprobación de Quiero Casa.' });
    } else {
      setLoading(false);
      setMsg({ t: 'ok', m: 'Te enviamos un correo para confirmar tu cuenta. Al confirmar, completa el registro de tu organización.' });
    }
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>Q</b>Quiero Casa</span>
        <h1>Únete al programa</h1>
        <p className="sub">Registra tu inmobiliaria o tu cuenta de broker independiente.</p>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
        <div className="field"><label>Tipo de cuenta</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="inmobiliaria">Inmobiliaria (con equipo)</option>
            <option value="independiente">Broker independiente</option>
          </select></div>
        <div className="field"><label>{tipo === 'independiente' ? 'Nombre comercial' : 'Nombre de la inmobiliaria'}</label>
          <input value={nombreOrg} onChange={e => setNombreOrg(e.target.value)} required /></div>
        <div className="field"><label>Tu nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
        <div className="field"><label>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div className="field"><label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
        <div className="field"><label>RFC (opcional)</label>
          <input value={rfc} onChange={e => setRfc(e.target.value)} /></div>
        <button className="btn mag block" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta'}</button>
        <p className="alt">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
