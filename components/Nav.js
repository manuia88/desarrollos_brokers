'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { contarNoLeidos } from '../lib/notif';

// Sidebar con grupos colapsables + Paleta de comandos (⌘K) + Favoritos fijables.
// Interfaz igual que antes: <Nav me current logo />.

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

const FAV_KEY = 'dmx_favs';
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }
function writeFavs(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch { /* noop */ } }

export default function Nav({ me, current }) {
  const router = useRouter();
  const [noLeidos, setNoLeidos] = useState(0);
  const [esDev, setEsDev] = useState(false);
  const [openG, setOpenG] = useState(null);
  const [menu, setMenu] = useState(false);       // sidebar abierto en móvil
  const [favs, setFavs] = useState([]);
  const [pal, setPal] = useState(false);         // paleta ⌘K abierta
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setFavs(readFavs());
    contarNoLeidos().then(setNoLeidos).catch(() => {});
    (async () => {
      if (!me?.org_id) return;
      const { data } = await supabase.from('orgs').select('tipo,es_master_broker').eq('id', me.org_id).maybeSingle();
      if (data && (data.tipo === 'desarrollador' || data.es_master_broker)) setEsDev(true);
    })();
  }, [me?.org_id]);

  // Arma grupos según rol.
  const groups = useMemo(() => {
    const gs = BASE.map(g => ({ ...g }));
    const equipo = [];
    if (me?.rol === 'director' || me?.rol === 'super_admin') equipo.push(['/equipo', 'Equipo', '🧑‍🤝‍🧑']);
    if (esDev || me?.rol === 'super_admin') equipo.push(['/inventario', 'Inventario', '🗂️']);
    if (equipo.length) gs.push({ t: 'Equipo & inventario', items: equipo });
    if (me?.rol === 'super_admin') gs.push(GROUP_ADMIN);
    return gs;
  }, [me?.rol, esDev]);

  const allItems = useMemo(() => groups.flatMap(g => g.items.map(([href, label, ic]) => ({ href, label, ic, group: g.t }))), [groups]);
  const favItems = favs.map(h => allItems.find(i => i.href === h)).filter(Boolean);

  const activeGroup = groups.find(g => g.items.some(([href]) => href === current))?.t;
  const shownOpen = openG ?? activeGroup ?? groups[0].t;

  // Resultados de la paleta (+ acción de preguntar al Copiloto cuando hay texto).
  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return favItems.length ? favItems : allItems;
    const scored = allItems
      .map(it => ({ it, s: norm(it.label).indexOf(nq), g: norm(it.group).indexOf(nq) }))
      .filter(x => x.s >= 0 || x.g >= 0)
      .sort((a, b) => (a.s === 0 ? -1 : b.s === 0 ? 1 : 0) || (a.s < 0 ? 1 : b.s < 0 ? -1 : a.s - b.s));
    const list = scored.map(x => x.it);
    list.push({ ask: true, ic: '🤖', label: `Preguntar al Copiloto: “${q.trim()}”`, group: 'IA' });
    return list;
  }, [q, allItems, favItems]);

  function activar(it) {
    if (!it) return;
    if (it.ask) go(`/copiloto?q=${encodeURIComponent(q.trim())}`);
    else go(it.href);
  }

  // Atajo global ⌘K / Ctrl+K.
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(p => !p); setQ(''); setSel(0); }
      if (e.key === 'Escape') setPal(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => { if (pal && inputRef.current) inputRef.current.focus(); }, [pal]);
  useEffect(() => { setSel(0); }, [q]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }
  function go(href) { setMenu(false); setPal(false); router.push(href); }
  function toggleFav(href, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setFavs(prev => { const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]; writeFavs(next); return next; });
  }
  function moveFav(href, dir, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setFavs(prev => {
      const i = prev.indexOf(href); const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; writeFavs(next); return next;
    });
  }
  function palKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); activar(results[sel]); }
  }

  const linkRow = (it, inFav) => (
    <a key={(inFav ? 'f' : '') + it.href} className={'sb-link' + (current === it.href ? ' on' : '')} onClick={() => go(it.href)}>
      <span className="ic">{it.ic}</span><span className="lbl">{it.label}</span>
      {it.href === '/avisos' && noLeidos > 0 && <span className="sb-badge">{noLeidos > 9 ? '9+' : noLeidos}</span>}
      <button className={'sb-star' + (favs.includes(it.href) ? ' on' : '')} title={favs.includes(it.href) ? 'Quitar de favoritos' : 'Fijar en favoritos'}
        onClick={(e) => toggleFav(it.href, e)}>{favs.includes(it.href) ? '★' : '☆'}</button>
    </a>
  );

  return (
    <>
      <button className="sb-burger" onClick={() => setMenu(m => !m)} aria-label="Menú">☰</button>
      <div className={'sb-backdrop' + (menu ? ' show' : '')} onClick={() => setMenu(false)} />

      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="sb-logo" onClick={() => go('/portal')}><b>D</b><span>DesarrollosMX</span></div>

        <button className="sb-search" onClick={() => { setPal(true); setQ(''); setSel(0); }}>
          <span>🔎 Buscar o ir a…</span><kbd className="sb-kbd">⌘K</kbd>
        </button>

        <div className="sb-scroll">
          {favItems.length > 0 && (
            <div className="sb-group open">
              <div className="sb-ghead static">★ Favoritos <span className="sb-hint">tú eliges el orden</span></div>
              <div className="sb-items">
                {favItems.map((it, i) => (
                  <div className="sb-favrow" key={it.href}>
                    <a className={'sb-link' + (current === it.href ? ' on' : '')} onClick={() => go(it.href)}>
                      <span className="ic">{it.ic}</span><span className="lbl">{it.label}</span>
                      {it.href === '/avisos' && noLeidos > 0 && <span className="sb-badge">{noLeidos > 9 ? '9+' : noLeidos}</span>}
                    </a>
                    <div className="sb-favctl">
                      <button disabled={i === 0} onClick={e => moveFav(it.href, -1, e)} title="Subir">▴</button>
                      <button disabled={i === favItems.length - 1} onClick={e => moveFav(it.href, 1, e)} title="Bajar">▾</button>
                      <button className="star" onClick={e => toggleFav(it.href, e)} title="Quitar de favoritos">★</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {groups.map(g => {
            const abierto = shownOpen === g.t;
            return (
              <div className={'sb-group' + (abierto ? ' open' : '')} key={g.t}>
                <button className="sb-ghead" onClick={() => setOpenG(abierto ? '__none__' : g.t)}>
                  {g.t}<span className="chev">›</span>
                </button>
                {abierto && <div className="sb-items">{g.items.map(([href, label, ic]) => linkRow({ href, label, ic, group: g.t }, false))}</div>}
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

      {pal && (
        <div className="cmdk-overlay" onClick={() => setPal(false)}>
          <div className="cmdk" onClick={e => e.stopPropagation()}>
            <div className="cmdk-inrow">
              <span className="cmdk-ic">🔎</span>
              <input ref={inputRef} className="cmdk-input" placeholder="¿A dónde vas? Escribe una pantalla…"
                value={q} onChange={e => setQ(e.target.value)} onKeyDown={palKey} />
              <kbd className="sb-kbd">esc</kbd>
            </div>
            <div className="cmdk-list">
              {!q.trim() && favItems.length > 0 && <div className="cmdk-glabel">Favoritos</div>}
              {results.length === 0 && <div className="cmdk-empty">Sin resultados para “{q}”.</div>}
              {results.map((it, i) => (
                <div key={it.href || 'ask'} className={'cmdk-item' + (i === sel ? ' on' : '') + (it.ask ? ' ask' : '')} onMouseEnter={() => setSel(i)} onClick={() => activar(it)}>
                  <span className="ic">{it.ic}</span>
                  <span className="cmdk-lbl">{it.label}</span>
                  <span className="cmdk-group">{it.group}</span>
                </div>
              ))}
            </div>
            <div className="cmdk-foot"><kbd className="sb-kbd">↑↓</kbd> moverte <kbd className="sb-kbd">↵</kbd> ir <kbd className="sb-kbd">esc</kbd> cerrar</div>
          </div>
        </div>
      )}
    </>
  );
}
