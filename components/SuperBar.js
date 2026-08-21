'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getViewAs, setViewAs, getPins, togglePin, isPinned } from '../lib/viewas';

// Barra de super-admin para "ver como" una inmobiliaria / asesor sin cerrar sesión.
// Incluye "Mis inmobiliarias": accesos rápidos a las orgs que el super administra.
// onChange(ctx) avisa a la página para re-filtrar sus datos.
export default function SuperBar({ onChange }) {
  const [orgs, setOrgs] = useState([]);
  const [people, setPeople] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [pins, setPins] = useState([]);

  useEffect(() => {
    setCtx(getViewAs());
    setPins(getPins());
    (async () => {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from('orgs').select('id,nombre,tipo').order('nombre'),
        supabase.from('profiles').select('id,nombre,rol,org_id').order('nombre'),
      ]);
      setOrgs(o || []);
      setPeople(p || []);
    })();
  }, []);

  function apply(next) {
    setCtx(next);
    setViewAs(next);
    if (onChange) onChange(next);
  }

  function pickOrg(org_id) {
    if (!org_id) return apply(null);
    const org = orgs.find(o => o.id === org_id);
    apply({ org_id, org_nombre: org ? org.nombre : '', rol: 'director', asesor_id: null, asesor_nombre: null });
  }

  function pickAsesor(asesor_id) {
    if (!ctx) return;
    if (!asesor_id) return apply({ ...ctx, asesor_id: null, asesor_nombre: null, rol: 'director' });
    const a = people.find(x => x.id === asesor_id);
    apply({ ...ctx, asesor_id, asesor_nombre: a ? a.nombre : '', rol: (a && a.rol) || 'asesor' });
  }

  function fijarActual() {
    if (!ctx) return;
    setPins(togglePin({ org_id: ctx.org_id, org_nombre: ctx.org_nombre }));
  }

  const teamOfOrg = ctx ? people.filter(p => p.org_id === ctx.org_id && p.rol !== 'super_admin') : [];
  const pinBtn = (on) => ({
    fontSize: '.78rem', fontWeight: 700, padding: '.32rem .7rem', borderRadius: 8, cursor: 'pointer',
    border: '1px solid ' + (on ? 'var(--lime)' : 'var(--line)'),
    background: on ? 'var(--lime-soft)' : 'var(--panel)', color: on ? 'var(--lime)' : 'var(--ink)',
  });

  return (
    <div className="superbar">
      <span className="sb-tag">Ver como</span>

      {pins.length > 0 && (
        <>
          <span className="sb-now" style={{ marginRight: '.1rem' }}>Mis inmobiliarias:</span>
          {pins.map(p => (
            <button key={p.org_id} onClick={() => pickOrg(p.org_id)} style={pinBtn(ctx?.org_id === p.org_id)}>{p.org_nombre}</button>
          ))}
        </>
      )}

      <select value={ctx ? ctx.org_id : ''} onChange={e => pickOrg(e.target.value)}>
        <option value="">Mi vista de super-admin (todo)</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      {ctx && (
        <select value={ctx.asesor_id || ''} onChange={e => pickAsesor(e.target.value)}>
          <option value="">Toda la inmobiliaria (director)</option>
          {teamOfOrg.map(a => <option key={a.id} value={a.id}>{a.nombre} · {a.rol}</option>)}
        </select>
      )}
      {ctx && <span className="sb-now">Viendo: <b>{ctx.org_nombre}{ctx.asesor_nombre ? ' · ' + ctx.asesor_nombre : ' · director'}</b></span>}
      {ctx && (
        <button onClick={fijarActual} title="Fijar/quitar de Mis inmobiliarias" style={pinBtn(isPinned(ctx.org_id))}>
          {isPinned(ctx.org_id) ? '★ Fijada' : '☆ Fijar'}
        </button>
      )}
      {ctx && <button className="sb-exit" onClick={() => apply(null)}>Salir del modo</button>}
    </div>
  );
}
