'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
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
          <div style={{ position: 'relative' }}>
            <input type={verPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: '3rem' }} />
            <button type="button" onClick={() => setVerPass(v => !v)} aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{ position: 'absolute', right: '.5rem', top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center', width: '2rem', height: '2rem', background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', padding: 0 }}>
              {verPass ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div></div>
        <button className="btn mag block" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <p className="alt">¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
      </form>
    </div>
  );
}
