'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { abrirDocumento } from '../../lib/docs';

const ESTADOS = [['pendiente', 'Pendientes'], ['activo', 'Activas'], ['rechazado', 'Rechazadas'], ['', 'Todas']];
const EBADGE = { pendiente: 'pd', activo: 'es', rechazado: 'cx', suspendido: 'cx' };
const DOCLABELS = {
  ine: 'INE', csf: 'CSF', comprobante_domicilio: 'Comprobante domicilio', curp: 'CURP',
  acta_constitutiva: 'Acta constitutiva', ine_representante: 'INE rep. legal',
};
const docLabel = t => DOCLABELS[t] || t;

export default function Altas() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [orgs, setOrgs] = useState(null);
  const [people, setPeople] = useState([]);
  const [docs, setDocs] = useState([]);
  const [fEstado, setFEstado] = useState('pendiente');
  const [busy, setBusy] = useState(false);
  const [rej, setRej] = useState(null);
  const [motivo, setMotivo] = useState('');

  async function load() {
    const [{ data: o }, { data: p }, { data: d }] = await Promise.all([
      supabase.from('orgs').select('id,nombre,tipo,estado,rfc,creado').order('creado', { ascending: false }),
      supabase.from('profiles').select('id,nombre,email,rol,org_id'),
      supabase.from('documentos').select('id,org_id,tipo,nombre_archivo,path,creado').eq('ambito', 'broker').order('creado'),
    ]);
    setOrgs(o || []); setPeople(p || []); setDocs(d || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol').eq('id', session.user.id).single();
      setMe({ email: session.user.email, ...(prof || {}) });
      if (prof?.rol !== 'super_admin') { setOrgs([]); return; }
      await load();
    })();
  }, [router]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  async function decidir(orgId, aprobar, mot) {
    setBusy(true);
    const { error } = await supabase.rpc('aprobar_org', { p_org_id: orgId, p_aprobar: aprobar, p_motivo: mot || null });
    setBusy(false);
    if (error) { alert('No se pudo procesar: ' + error.message); return; }
    setRej(null); setMotivo('');
    await load();
  }

  const docsByOrg = useMemo(() => { const m = {}; docs.forEach(d => { (m[d.org_id] = m[d.org_id] || []).push(d); }); return m; }, [docs]);
  const ownerByOrg = useMemo(() => { const m = {}; people.forEach(p => { if (['director', 'independiente'].includes(p.rol) && !m[p.org_id]) m[p.org_id] = p; }); return m; }, [people]);
  const rows = useMemo(() => (orgs || []).filter(o => !fEstado || o.estado === fEstado), [orgs, fEstado]);

  if (orgs === null) return <div className="loading">Cargando…</div>;
  if (me && me.rol !== 'super_admin') return (
    <div className="loading">Esta sección es solo para super-admin. <a onClick={() => router.push('/crm')} style={{ cursor: 'pointer' }}>Ir al CRM</a></div>
  );

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Altas de brokers</span>
        <nav className="nav">
          <a onClick={() => router.push('/crm')}>CRM</a>
          <a onClick={() => router.push('/comisiones')}>Comisiones</a>
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          <span className="tag-super">SUPER ADMIN</span>
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

      <main className="wrap">
        <div className="buscar-intro">
          <h1>Altas por aprobar</h1>
          <p>Revisa las inmobiliarias y brokers que se registraron, valida sus documentos y aprueba o rechaza. Sólo al aprobar, su equipo puede empezar a operar.</p>
        </div>

        <div className="filters">
          {ESTADOS.map(([v, l]) => <span key={v} className={'chip' + (fEstado === v ? ' on' : '')} onClick={() => setFEstado(v)}>{l}</span>)}
          <span className="count">{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
        </div>

        {rows.length === 0 ? (
          <div className="crm-empty">No hay altas en este estatus.</div>
        ) : (
          <div className="alta-grid">
            {rows.map(o => {
              const owner = ownerByOrg[o.id];
              const ds = docsByOrg[o.id] || [];
              return (
                <article className="alta" key={o.id}>
                  <div className="alta-h">
                    <div>
                      <h3>{o.nombre}</h3>
                      <span className="loc">{o.tipo === 'independiente' ? 'Broker independiente' : 'Inmobiliaria'}{o.rfc ? ' · RFC ' + o.rfc : ''}</span>
                    </div>
                    <span className={'ap-badge ' + (EBADGE[o.estado] || '')}>{o.estado}</span>
                  </div>

                  <div className="alta-owner">
                    {owner ? <><b>{owner.nombre}</b><span>{owner.email || 's/correo'} · {owner.rol}</span></> : <span className="fnote">Sin responsable registrado</span>}
                    <span className="alta-date">Registrado {new Date(o.creado).toLocaleDateString('es-MX')}</span>
                  </div>

                  <div className="alta-docs">
                    <div className="alta-docs-h">Documentos ({ds.length})</div>
                    {ds.length === 0 ? <p className="fnote">Sin documentos subidos.</p> :
                      <div className="alta-doc-chips">{ds.map(d => <button key={d.id} className="doc-open" onClick={() => abrirDocumento(d.path)}>📄 {docLabel(d.tipo)}</button>)}</div>}
                  </div>

                  {o.estado === 'pendiente' && (
                    rej === o.id ? (
                      <div className="alta-rej">
                        <input placeholder="Motivo del rechazo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
                        <div className="ap-actions">
                          <button className="btn no sm" disabled={busy} onClick={() => decidir(o.id, false, motivo)}>Confirmar rechazo</button>
                          <button className="btn ghost sm" onClick={() => { setRej(null); setMotivo(''); }}>Volver</button>
                        </div>
                      </div>
                    ) : (
                      <div className="ap-actions">
                        <button className="btn ok sm" disabled={busy} onClick={() => decidir(o.id, true)}>Aprobar</button>
                        <button className="btn no sm" disabled={busy} onClick={() => setRej(o.id)}>Rechazar</button>
                      </div>
                    )
                  )}
                  {o.estado === 'rechazado' && <div className="ap-actions"><button className="btn lim sm" disabled={busy} onClick={() => decidir(o.id, true)}>Reactivar / aprobar</button></div>}
                  {o.estado === 'activo' && <div className="ap-hint">✅ Activa. Su equipo ya puede operar.</div>}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
