'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Barra de navegación compartida por todas las pantallas del portal.
const LINKS = [
  ['/hoy', 'Hoy'],
  ['/portal', 'Catálogo'],
  ['/buscar', 'Buscar'],
  ['/comparar', 'Comparar'],
  ['/clientes', 'Clientes'],
  ['/crm', 'CRM'],
  ['/calor', 'Interés'],
  ['/tablero', 'Tablero'],
  ['/comisiones', 'Comisiones'],
];
const SUPER = [
  ['/captura', 'Captura'],
  ['/altas', 'Altas'],
];

export default function Nav({ me, current, logo = 'Portal de Brokers' }) {
  const router = useRouter();
  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }
  const items = me?.rol === 'super_admin' ? [...LINKS, ...SUPER] : LINKS;
  return (
    <header className="topbar"><div className="topbar-in">
      <span className="logo" onClick={() => router.push('/portal')} style={{ cursor: 'pointer' }}><b>Q</b>{logo}</span>
      <nav className="nav">
        {items.map(([href, label]) => (
          <a key={href} onClick={() => router.push(href)} className={current === href ? 'on' : ''}>{label}</a>
        ))}
        <span className="nav-user">{me?.nombre || me?.email}</span>
        <button onClick={logout}>Salir</button>
      </nav>
    </div></header>
  );
}
