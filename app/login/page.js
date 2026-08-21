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
    const { data: sess, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setErr(error.message); return; }
    // Regresa a la pantalla de origen si vino con ?next=/ruta (solo rutas internas).
    let next = '/portal';
    try { const p = new URLSearchParams(window.location.search).get('next'); if (p && p.startsWith('/') && !p.startsWith('//')) next = p; } catch { /* noop */ }
    // Si aún no perteneces a una inmobiliaria, primero eliges/te unes a una.
    if (next === '/portal') {
      try {
        const uid = sess?.user?.id;
        if (uid) {
          const { data: prof } = await supabase.from('profiles').select('org_id,rol').eq('id', uid).single();
          // El super_admin no pertenece a ninguna inmobiliaria (org_id null es normal): va directo al portal.
          if (!prof?.org_id && prof?.rol !== 'super_admin') next = '/unirme';
        }
      } catch { /* noop */ }
    }
    setLoading(false);
    router.push(next);
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>D</b>DesarrollosMX</span>
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
