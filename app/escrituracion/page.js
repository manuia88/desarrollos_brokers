'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';

const fFecha = f => f ? new Date(f + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const diasA = f => f ? Math.ceil((new Date(f + 'T12:00').getTime() - Date.now()) / 86400000) : null;

export default function Escrituracion() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [aps, setAps] = useState(null);
  const [leadName, setLeadName] = useState({});
  const [devName, setDevName] = useState({});
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ fecha_escritura: '', notaria: '', fecha_entrega_llaves: '' });

  async function recargar() {
    const { data: ap } = await supabase.from('apartados').select('*').in('estatus', ['Apartado', 'Escriturado']).order('fecha_escritura', { ascending: true, nullsFirst: false });
    setAps(ap || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: ld }, { data: dv }] = await Promise.all([
        supabase.from('leads').select('id,nombre'),
        supabase.from('desarrollos').select('sku,nombre,direccion'),
      ]);
      setLeadName(Object.fromEntries((ld || []).map(l => [l.id, l.nombre])));
      setDevName(Object.fromEntries((dv || []).map(d => [d.sku, tituloDev(d)])));
      await recargar();
    })();
  }, [router]);

  function abrir(a) { setEdit(a); setForm({ fecha_escritura: a.fecha_escritura || '', notaria: a.notaria || '', fecha_entrega_llaves: a.fecha_entrega_llaves || '' }); }
  async function guardar() {
    await supabase.rpc('escritura_set', { p_apartado_id: edit.id, p_fecha: form.fecha_escritura || null, p_notaria: form.notaria || null, p_llaves: form.fecha_entrega_llaves || null });
    setEdit(null); recargar();
  }

  const alertas = useMemo(() => (aps || []).filter(a => a.estatus === 'Apartado' && a.fecha_escritura && diasA(a.fecha_escritura) != null && diasA(a.fecha_escritura) <= 10).length, [aps]);

  if (aps === null) return <div className="loading">Cargando escrituración…</div>;

  return (
    <>
      <Nav me={me} current="/escrituracion" logo="Escrituración" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Escrituración</h1>
          <p>Las operaciones que van a cierre: fecha de firma, notaría y entrega de llaves. {alertas > 0 ? `Tienes ${alertas} con fecha próxima.` : ''}</p>
        </div>

        {aps.length === 0 ? (
          <EmptyState icon="🖊️" title="Sin operaciones en escrituración">Cuando un apartado quede autorizado, aparece aquí para darle seguimiento a su firma y entrega.</EmptyState>
        ) : (
          <div className="utbl-wrap"><table className="utbl"><thead><tr>
            <th>Cliente</th><th>Desarrollo</th><th>Unidad</th><th>Precio</th><th>Estatus</th><th>Firma</th><th>Notaría</th><th>Entrega llaves</th><th></th>
          </tr></thead><tbody>
            {aps.map(a => {
              const dr = a.fecha_escritura ? diasA(a.fecha_escritura) : null;
              const alerta = a.estatus === 'Apartado' && dr != null && dr <= 10;
              return (
                <tr key={a.id}>
                  <td><b>{leadName[a.lead_id] || '—'}</b></td>
                  <td>{devName[a.dev_sku] || a.dev_sku}</td>
                  <td>{a.unidad_sku}</td>
                  <td>{MXN(a.precio)}</td>
                  <td><span className={'ap-badge ' + (a.estatus === 'Escriturado' ? 'es' : 'ap')}>{a.estatus}</span></td>
                  <td>{fFecha(a.fecha_escritura)}{alerta && <div className="vence hot">{dr > 0 ? `en ${dr}d` : dr === 0 ? 'hoy' : 'vencida'}</div>}</td>
                  <td>{a.notaria || '—'}</td>
                  <td>{fFecha(a.fecha_entrega_llaves)}</td>
                  <td><button className="cotiz-mini" onClick={() => abrir(a)}>Editar</button></td>
                </tr>
              );
            })}
          </tbody></table></div>
        )}
        <p className="fnote">Para marcar como escriturado (y pasar la unidad a Vendido) usa el flujo de apartados en Comisiones. Aquí llevas las fechas y la notaría.</p>

        {edit && (
          <>
            <div className="drawer-bg" onClick={() => setEdit(null)} />
            <aside className="drawer" onClick={e => e.stopPropagation()}>
              <div className="dw-h"><div><span className="dw-tag">Escrituración</span><h2>{leadName[edit.lead_id] || 'Operación'}</h2>
                <div className="ud-sub">{devName[edit.dev_sku]} · {edit.unidad_sku}</div></div>
                <button className="x" onClick={() => setEdit(null)}>✕</button></div>
              <label className="lbl">Fecha de firma</label>
              <input className="inp" type="date" value={form.fecha_escritura} onChange={e => setForm(s => ({ ...s, fecha_escritura: e.target.value }))} />
              <label className="lbl">Notaría</label>
              <input className="inp" value={form.notaria} onChange={e => setForm(s => ({ ...s, notaria: e.target.value }))} placeholder="Notaría 123, Lic. …" />
              <label className="lbl">Entrega de llaves</label>
              <input className="inp" type="date" value={form.fecha_entrega_llaves} onChange={e => setForm(s => ({ ...s, fecha_entrega_llaves: e.target.value }))} />
              <button className="btn mag block" style={{ marginTop: '1rem' }} onClick={guardar}>Guardar fechas</button>
            </aside>
          </>
        )}
      </main>
    </>
  );
}
