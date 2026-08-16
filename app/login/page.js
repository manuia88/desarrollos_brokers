'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push('/portal');
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>Q</b>Quiero Casa</span>
        <h1>Iniciar sesión</h1>
        <p className="sub">Entra a tu portal de brokers.</p>
        {err && <div className="msg err">{err}</div>}
        <div className="field"><label>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        <button className="btn mag block" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <p className="alt">¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
      </form>
    </div>
  );
}
