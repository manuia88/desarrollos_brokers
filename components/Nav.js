'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { contarNoLeidos } from '../lib/notif';

// Sidebar con grupos colapsables (acordeón): en lugar de ~25 tabs en fila,
// se agrupan por función y solo se expande el grupo de la sección actual.
// Mantiene la misma interfaz que el Nav viejo: <Nav me current logo />.

// Grupos base (todos los roles).
const BASE = [
  { t: 'Principal', items: [
    ['/hoy', 'Hoy', '🏠'],
    ['/tablero', 'Tablero', '📊'],
    ['/avisos', 'Avisos', '🔔'],
  ] },
  { t: 'Inventario', items: [
    ['/portal', 'Catálogo', '🏙️'],
    ['/buscar', 'Buscar', '🔎'],
    ['/comparar', 'Comparar', '⚖️'],
  ] },
  { t: 'Clientes & ventas', items: [
    ['/clientes', 'Clientes', '👥'],
    ['/crm', 'CRM', '🧭'],
    ['/seguimiento', 'Seguimiento', '📌'],
    ['/copiloto', 'Copiloto', '🤖'],
    ['/precalifica', 'Precalifica', '🧮'],
    ['/escrituracion', 'Escrituración', '🖋️'],
    ['/comisiones', 'Comisiones', '💰'],
  ] },
  { t: 'Análisis', items: [
    ['/metricas', 'Métricas', '📈'],
    ['/calor', 'Interés', '🔥'],
  ] },
  { t: 'Recursos', items: [
    ['/materiales', 'Materiales', '🎨'],
    ['/marca', 'Mi marca', '🏷️'],
    ['/academia', 'Academia', '🎓'],
    ['/conexiones', 'Conexiones', '🔌'],
  ] },
];

const GROUP_ADMIN = { t: 'Administración', items: [
  ['/kpis', 'KPIs', '📌'],
  ['/motor', 'Motor', '⚙️'],
  ['/captura', 'Captura', '📥'],
  ['/fichas', 'Cargar fichas', '📄'],
  ['/publicador', 'Publicador', '📤'],
  ['/pricing', 'Pricing', '🏷️'],
  ['/integraciones', 'Integraciones', '🔗'],
  ['/altas', 'Altas', '➕'],
] };

export default function Nav({ me, current, logo = 'DesarrollosMX' }) {
  const router = useRouter();
  const [noLeidos, setNoLeidos] = useState(0);
  const [esDev, setEsDev] = useState(false);
  const [openG, setOpenG] = useState(null);   // grupo abierto (override manual)
  const [menu, setMenu] = useState(false);     // sidebar abierto en móvil

  useEffect(() => {
    contarNoLeidos().then(setNoLeidos).catch(() => {});
    (async () => {
      if (!me?.org_id) return;
      const { data } = await supabase.from('orgs').select('tipo,es_master_broker').eq('id', me.org_id).maybeSingle();
      if (data && (data.tipo === 'desarrollador' || data.es_master_broker)) setEsDev(true);
    })();
  }, [me?.org_id]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  // Arma los grupos según el rol.
  const groups = [...BASE];
  const equipo = [];
  if (me?.rol === 'director' || me?.rol === 'super_admin') equipo.push(['/equipo', 'Equipo', '🧑‍🤝‍🧑']);
  if (esDev || me?.rol === 'super_admin') equipo.push(['/inventario', 'Inventario', '🗂️']);
  if (equipo.length) groups.push({ t: 'Equipo & inventario', items: equipo });
  if (me?.rol === 'super_admin') groups.push(GROUP_ADMIN);

  const activeGroup = groups.find(g => g.items.some(([href]) => href === current))?.t;
  const shownOpen = openG ?? activeGroup ?? groups[0].t;

  function go(href) { setMenu(false); router.push(href); }

  return (
    <>
      <button className="sb-burger" onClick={() => setMenu(m => !m)} aria-label="Menú">☰</button>
      <div className={'sb-backdrop' + (menu ? ' show' : '')} onClick={() => setMenu(false)} />

      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="sb-logo" onClick={() => go('/portal')}><b>D</b><span>DesarrollosMX</span></div>

        <div className="sb-scroll">
          {groups.map(g => {
            const abierto = shownOpen === g.t;
            return (
              <div className={'sb-group' + (abierto ? ' open' : '')} key={g.t}>
                <button className="sb-ghead" onClick={() => setOpenG(abierto ? '__none__' : g.t)}>
                  {g.t}<span className="chev">›</span>
                </button>
                {abierto && (
                  <div className="sb-items">
                    {g.items.map(([href, label, ic]) => (
                      <a key={href} className={'sb-link' + (current === href ? ' on' : '')} onClick={() => go(href)}>
                        <span className="ic">{ic}</span><span>{label}</span>
                        {href === '/avisos' && noLeidos > 0 && <span className="sb-badge">{noLeidos > 9 ? '9+' : noLeidos}</span>}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sb-foot">
          <div className="sb-user">
            <span>{me?.nombre || me?.email}</span>
            {me?.rol === 'super_admin' && <span className="sb-super">SUPER</span>}
          </div>
          <button className="sb-salir" onClick={logout}>Salir</button>
        </div>
      </aside>
    </>
  );
}
