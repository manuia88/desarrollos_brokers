'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { contarNoLeidos } from '../lib/notif';

// Barra de navegación compartida por todas las pantallas del portal.
const LINKS = [
  ['/hoy', 'Hoy'],
  ['/portal', 'Catálogo'],
  ['/buscar', 'Buscar'],
  ['/copiloto', 'Copiloto'],
  ['/seguimiento', 'Seguimiento'],
  ['/comparar', 'Comparar'],
  ['/precalifica', 'Precalifica'],
  ['/clientes', 'Clientes'],
  ['/crm', 'CRM'],
  ['/materiales', 'Materiales'],
  ['/escrituracion', 'Escrituración'],
  ['/calor', 'Interés'],
  ['/tablero', 'Tablero'],
  ['/metricas', 'Métricas'],
  ['/comisiones', 'Comisiones'],
  ['/conexiones', 'Conexiones'],
  ['/academia', 'Academia'],
];
const SUPER = [
  ['/kpis', 'KPIs'],
  ['/motor', 'Motor'],
  ['/captura', 'Captura'],
  ['/fichas', 'Cargar fichas'],
  ['/publicador', 'Publicador'],
  ['/pricing', 'Pricing'],
  ['/integraciones', 'Integraciones'],
  ['/altas', 'Altas'],
];

export default function Nav({ me, current, logo = 'Portal de Brokers' }) {
  const router = useRouter();
  const [noLeidos, setNoLeidos] = useState(0);
  useEffect(() => { contarNoLeidos().then(setNoLeidos).catch(() => {}); }, []);
  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }
  const items = me?.rol === 'super_admin'
    ? [...LINKS, ['/equipo', 'Equipo'], ...SUPER]
    : me?.rol === 'director'
      ? [...LINKS, ['/equipo', 'Equipo']]
      : LINKS;
  return (
    <header className="topbar"><div className="topbar-in">
      <span className="logo" onClick={() => router.push('/portal')} style={{ cursor: 'pointer' }}><b>Q</b>{logo}</span>
      <nav className="nav">
        {items.map(([href, label]) => (
          <a key={href} onClick={() => router.push(href)} className={current === href ? 'on' : ''}>{label}</a>
        ))}
        <a onClick={() => router.push('/avisos')} className={'nav-bell' + (current === '/avisos' ? ' on' : '')}>
          🔔{noLeidos > 0 && <span className="nav-badge">{noLeidos > 9 ? '9+' : noLeidos}</span>}
        </a>
        <span className="nav-user">{me?.nombre || me?.email}</span>
        <button onClick={logout}>Salir</button>
      </nav>
    </div></header>
  );
}
