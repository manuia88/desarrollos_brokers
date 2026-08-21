'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import SuperBar from '../../components/SuperBar';
import { getViewAs } from '../../lib/viewas';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const MXNc = n => n == null ? '—' : (Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n).toLocaleString('es-MX'));
const ESTC = { Pendiente: 'pd', Apartado: 'ap', Escriturado: 'es', Cancelado: 'cx', Rechazado: 'cx', Vencido: 'cx' };
const FILTROS = [['', 'Todos'], ['Pendiente', 'Pendientes'], ['Apartado', 'Apartados'], ['Escriturado', 'Escriturados'], ['Vencido', 'Vencidos'], ['Cancelado', 'Cancelados'], ['Rechazado', 'Rechazados']];
const diasRest = ts => ts ? Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000) : null;
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Comisiones() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [aps, setAps] = useState(null);
  const [leadName, setLeadName] = useState({});
  const [devName, setDevName] = useState({});
  const [persName, setPersName] = useState({});
  const [viewAs, setViewAs] = useState(null);
  const [fEst, setFEst] = useState('');
  const [people, setPeople] = useState([]);
  const [splitEdit, setSplitEdit] = useState(null); // apartado en edición de split
  const [splitForm, setSplitForm] = useState({ asesor: '', pct: '' });

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
      setPeople(pf || []);
    })();
  }, [router]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  async function guardarSplit() {
    if (!splitEdit) return;
    await supabase.rpc('apartado_set_split', {
      p_apartado_id: splitEdit.id,
      p_split_asesor: splitForm.asesor || null,
      p_split_pct: splitForm.pct ? Number(splitForm.pct) : null,
    });
    const { data: ap } = await supabase.from('apartados').select('*').order('creado', { ascending: false });
    setAps(ap || []); setSplitEdit(null);
  }

  function exportarCSV() {
    const head = ['Cliente', 'Desarrollo', 'Unidad', 'Precio', 'Comision %', 'Comision $', 'Split asesor', 'Split %', 'Estatus', 'Asesor', 'Fecha'];
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [head.join(',')].concat(rows.map(a => [
      leadName[a.lead_id] || '', devName[a.dev_sku] || a.dev_sku || '', a.unidad_sku || '',
      a.precio || '', a.comision_pct != null ? Math.round(a.comision_pct * 100) : '', a.comision_monto || '',
      a.split_asesor_id ? (persName[a.split_asesor_id] || '') : '', a.split_pct ?? '',
      a.estatus, persName[a.asesor_id] || '', new Date(a.creado).toLocaleDateString('es-MX'),
    ].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `comisiones_${hoyStr()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

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
      <Nav me={me} current="/comisiones" />

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
          {rows.length > 0 && <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={exportarCSV}>⬇ Exportar CSV</button>}
        </div>

        {rows.length === 0 ? (
          <div className="crm-empty">
            Aún no hay apartados{fEst ? ' en este estatus' : ''}.<br />
            Aparta una unidad desde el <a onClick={() => router.push('/crm')}>CRM</a>, en la ficha del cliente, y su comisión aparece aquí.
          </div>
        ) : (
          <div className="utbl-wrap"><table className="utbl com-tbl"><thead><tr>
            <th>Cliente</th><th>Desarrollo</th><th>Unidad</th><th>Precio</th>
            <th>Comisión</th><th>Monto</th><th>Split</th><th>Estatus</th><th>Asesor</th><th>Fecha</th>
          </tr></thead><tbody>
            {rows.map(a => {
              const dr = ['Pendiente', 'Apartado'].includes(a.estatus) ? diasRest(a.vence) : null;
              const splitPct = a.split_pct != null ? Number(a.split_pct) : null;
              return (
              <tr key={a.id}>
                <td><b>{leadName[a.lead_id] || '—'}</b></td>
                <td>{devName[a.dev_sku] || a.dev_sku || '—'}</td>
                <td>{a.unidad_sku}</td>
                <td>{MXN(a.precio)}</td>
                <td>{a.comision_pct != null ? Math.round(a.comision_pct * 100) + '%' : '—'}</td>
                <td><b>{MXN(a.comision_monto)}</b></td>
                <td>
                  {splitPct != null
                    ? <span className="split-tag">{persName[a.split_asesor_id] || 'co-broker'} {splitPct}%<br /><em>{MXN(Math.round((a.comision_monto || 0) * splitPct / 100))}</em></span>
                    : <span className="split-none">—</span>}
                  {['Pendiente', 'Apartado', 'Escriturado'].includes(a.estatus) && <button className="split-edit" onClick={() => { setSplitEdit(a); setSplitForm({ asesor: a.split_asesor_id || '', pct: a.split_pct ?? '' }); }}>✎</button>}
                </td>
                <td>
                  <span className={'ap-badge ' + (ESTC[a.estatus] || '')}>{a.estatus}</span>
                  {dr != null && <div className={'vence' + (dr <= 3 ? ' hot' : '')}>{dr > 0 ? `vence en ${dr}d` : 'vence hoy'}</div>}
                </td>
                <td>{persName[a.asesor_id] || '—'}</td>
                <td>{new Date(a.creado).toLocaleDateString('es-MX')}</td>
              </tr>
            ); })}
          </tbody></table></div>
        )}
        <p className="fnote">La comisión se congela al momento de apartar (precio × % del desarrollo). El total ganado suma sólo los apartados escriturados. Los apartados pendientes vencen a 7 días y los autorizados a 30 — al vencer, la unidad se libera sola.</p>

        {splitEdit && (
          <>
            <div className="drawer-bg" onClick={() => setSplitEdit(null)} />
            <aside className="drawer" onClick={e => e.stopPropagation()}>
              <div className="dw-h"><div><span className="dw-tag">Co-brokerage</span><h2>Repartir comisión</h2>
                <div className="ud-sub">{leadName[splitEdit.lead_id]} · {MXN(splitEdit.comision_monto)}</div></div>
                <button className="x" onClick={() => setSplitEdit(null)}>✕</button></div>
              <p className="fnote" style={{ marginTop: 0 }}>Asigna a un segundo broker un % de esta comisión. El resto queda para el asesor principal.</p>
              <label className="lbl">Co-broker</label>
              <select className="inp" value={splitForm.asesor} onChange={e => setSplitForm(s => ({ ...s, asesor: e.target.value }))}>
                <option value="">— Sin split —</option>
                {people.filter(p => p.id !== splitEdit.asesor_id).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <label className="lbl">% para el co-broker</label>
              <input className="inp" inputMode="decimal" value={splitForm.pct} onChange={e => setSplitForm(s => ({ ...s, pct: e.target.value }))} placeholder="Ej. 30" />
              {splitForm.pct && splitEdit.comision_monto ? <div className="crit-resumen">Co-broker: {MXN(Math.round(splitEdit.comision_monto * Number(splitForm.pct) / 100))} · Principal: {MXN(Math.round(splitEdit.comision_monto * (100 - Number(splitForm.pct)) / 100))}</div> : null}
              <button className="btn mag block" onClick={guardarSplit}>Guardar split</button>
            </aside>
          </>
        )}
      </main>
    </>
  );
}
