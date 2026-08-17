'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import SuperBar from '../../components/SuperBar';
import { getViewAs } from '../../lib/viewas';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const MXNc = n => n == null ? '—' : (Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n).toLocaleString('es-MX'));
const ESTC = { Pendiente: 'pd', Apartado: 'ap', Escriturado: 'es', Cancelado: 'cx', Rechazado: 'cx' };
const FILTROS = [['', 'Todos'], ['Pendiente', 'Pendientes'], ['Apartado', 'Apartados'], ['Escriturado', 'Escriturados'], ['Cancelado', 'Cancelados'], ['Rechazado', 'Rechazados']];

export default function Comisiones() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [aps, setAps] = useState(null);
  const [leadName, setLeadName] = useState({});
  const [devName, setDevName] = useState({});
  const [persName, setPersName] = useState({});
  const [viewAs, setViewAs] = useState(null);
  const [fEst, setFEst] = useState('');

  useEffect(() => { setViewAs(getViewAs()); }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('id,nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: ap }, { data: ld }, { data: dv }, { data: pf }] = await Promise.all([
        supabase.from('apartados').select('*').order('creado', { ascending: false }),
        supabase.from('leads').select('id,nombre'),
        supabase.from('desarrollos').select('sku,nombre'),
        supabase.from('profiles').select('id,nombre'),
      ]);
      setAps(ap || []);
      const lm = {}; (ld || []).forEach(l => { lm[l.id] = l.nombre; }); setLeadName(lm);
      const dm = {}; (dv || []).forEach(d => { dm[d.sku] = d.nombre; }); setDevName(dm);
      const pm = {}; (pf || []).forEach(p => { pm[p.id] = p.nombre; }); setPersName(pm);
    })();
  }, [router]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  const superViewing = me?.rol === 'super_admin' && !!viewAs;
  const effOrg = superViewing ? viewAs.org_id : null;

  const scope = useMemo(() => (aps || []).filter(a => !effOrg || a.org_id === effOrg), [aps, effOrg]);

  const tot = useMemo(() => {
    let pipe = 0, ganada = 0, cancel = 0, pend = 0;
    scope.forEach(a => {
      if (a.estatus === 'Escriturado') ganada += a.comision_monto || 0;
      else if (a.estatus === 'Apartado') pipe += a.comision_monto || 0;
      else if (a.estatus === 'Pendiente') pend += 1;
      else cancel += 1; // Cancelado / Rechazado
    });
    return { pipe, ganada, cancel, pend };
  }, [scope]);

  const rows = useMemo(() => scope.filter(a => !fEst || a.estatus === fEst), [scope, fEst]);

  if (aps === null) return <div className="loading">Cargando comisiones…</div>;

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Comisiones</span>
        <nav className="nav">
          <a onClick={() => router.push('/crm')}>CRM</a>
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          {me?.rol === 'super_admin' && <a onClick={() => router.push('/altas')}>Altas</a>}
          {me?.rol === 'super_admin' && <span className="tag-super">SUPER ADMIN</span>}
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

      {me?.rol === 'super_admin' && <SuperBar onChange={setViewAs} />}

      <main className="wrap">
        <div className="crm-metrics">
          <div className="mtile com"><b>{MXNc(tot.pipe)}</b><span>Comisión en pipeline</span></div>
          <div className="mtile win"><b>{MXNc(tot.ganada)}</b><span>Comisión ganada</span></div>
          <div className="mtile acc"><b>{tot.pend}</b><span>Por autorizar</span></div>
          <div className="mtile"><b>{tot.cancel}</b><span>Cancelados / rechazados</span></div>
        </div>

        <div className="filters">
          {FILTROS.map(([v, l]) => <span key={v} className={'chip' + (fEst === v ? ' on' : '')} onClick={() => setFEst(v)}>{l}</span>)}
          <span className="count">{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
        </div>

        {rows.length === 0 ? (
          <div className="crm-empty">
            Aún no hay apartados{fEst ? ' en este estatus' : ''}.<br />
            Aparta una unidad desde el <a onClick={() => router.push('/crm')}>CRM</a>, en la ficha del cliente, y su comisión aparece aquí.
          </div>
        ) : (
          <div className="utbl-wrap"><table className="utbl com-tbl"><thead><tr>
            <th>Cliente</th><th>Desarrollo</th><th>Unidad</th><th>Precio</th>
            <th>Comisión</th><th>Monto</th><th>Estatus</th><th>Asesor</th><th>Fecha</th>
          </tr></thead><tbody>
            {rows.map(a => (
              <tr key={a.id}>
                <td><b>{leadName[a.lead_id] || '—'}</b></td>
                <td>{devName[a.dev_sku] || a.dev_sku || '—'}</td>
                <td>{a.unidad_sku}</td>
                <td>{MXN(a.precio)}</td>
                <td>{a.comision_pct != null ? Math.round(a.comision_pct * 100) + '%' : '—'}</td>
                <td><b>{MXN(a.comision_monto)}</b></td>
                <td><span className={'ap-badge ' + (ESTC[a.estatus] || '')}>{a.estatus}</span></td>
                <td>{persName[a.asesor_id] || '—'}</td>
                <td>{new Date(a.creado).toLocaleDateString('es-MX')}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        <p className="fnote">La comisión se congela al momento de apartar (precio × % del desarrollo). El total ganado suma sólo los apartados escriturados.</p>
      </main>
    </>
  );
}
