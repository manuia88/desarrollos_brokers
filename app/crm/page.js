'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import SuperBar from '../../components/SuperBar';
import { getViewAs } from '../../lib/viewas';

const ETAPAS = ['Nuevo', 'Contactado', 'Cita', 'Apartado', 'Contrato', 'Escriturado', 'Perdido'];
const TERM = { Escriturado: 'win', Perdido: 'lost' };
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const GESTOR = ['director', 'gerente', 'super_admin'];

function dias(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function ageClass(d) { return d >= 5 ? 'hot' : d >= 2 ? 'warm' : 'cool'; }
function soloDigitos(s) { return String(s == null ? '' : s).split('').filter(c => c >= '0' && c <= '9').join(''); }
function presupNum(p) {
  if (!p) return null;
  const n = +soloDigitos(p);
  return n > 0 ? n : null;
}

export default function CRM() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [team, setTeam] = useState([]);
  const [devName, setDevName] = useState({});
  const [drag, setDrag] = useState(null);        // etapa column being hovered
  const [sel, setSel] = useState(null);          // lead id open in drawer
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [fDev, setFDev] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewAs, setViewAs] = useState(null);

  useEffect(() => { setViewAs(getViewAs()); }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads').select('*').order('actualizado', { ascending: false });
    if (!error) setLeads(data || []);
    else setLeads([]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase
        .from('profiles').select('id,nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: ppl }, { data: devs }] = await Promise.all([
        supabase.from('profiles').select('id,nombre,rol,org_id').order('nombre'),
        supabase.from('desarrollos').select('sku,nombre'),
      ]);
      setTeam(ppl || []);
      const m = {}; (devs || []).forEach(d => { m[d.sku] = d.nombre; });
      setDevName(m);
      await load();
    })();
  }, [router, load]);

  // Contexto efectivo: si el super-admin está "viendo como", manda ese contexto.
  const superViewing = me?.rol === 'super_admin' && !!viewAs;
  const effRol = superViewing ? viewAs.rol : me?.rol;
  const effId = superViewing ? viewAs.asesor_id : me?.id;
  const effOrg = superViewing ? viewAs.org_id : null;
  const puedeGestionar = !!effRol && GESTOR.includes(effRol);
  const nombreDe = id => team.find(t => t.id === id)?.nombre || '—';

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }

  // ---- mutations (RLS-scoped; leads_update permite org members) ----
  async function patch(id, fields) {
    setBusy(true);
    const payload = { ...fields, actualizado: new Date().toISOString() };
    // optimista
    setLeads(ls => ls.map(l => l.id === id ? { ...l, ...payload } : l));
    const { error } = await supabase.from('leads').update(payload).eq('id', id);
    setBusy(false);
    if (error) { await load(); alert('No se pudo guardar: ' + error.message); }
  }
  const mover = (id, etapa) => patch(id, { etapa });
  const aprobar = id => patch(id, { estatus: 'ok' });
  const rechazar = id => patch(id, { estatus: 'duplicado' });
  const reasignar = (id, asesor_id) => patch(id, { asesor_id });

  async function agendar(lead, { fecha, hora, modalidad, notas }) {
    if (!fecha) { alert('Falta la fecha'); return false; }
    setBusy(true);
    const { error } = await supabase.from('citas').insert({
      org_id: lead.org_id, lead_id: lead.id, asesor_id: lead.asesor_id,
      nombre: lead.nombre, email: lead.email, telefono: lead.telefono,
      dev_sku: lead.dev_sku, fecha, hora, modalidad, notas,
    });
    setBusy(false);
    if (error) { alert('No se pudo agendar: ' + error.message); return false; }
    if (lead.etapa === 'Nuevo' || lead.etapa === 'Contactado') await mover(lead.id, 'Cita');
    return true;
  }

  // ---- derived ----
  const visibles = useMemo(() => {
    if (!leads) return [];
    const s = q.trim().toLowerCase();
    return leads.filter(l =>
      l.estatus !== 'duplicado' &&
      (!effOrg || l.org_id === effOrg) &&
      (!mine || l.asesor_id === effId) &&
      (!fDev || l.dev_sku === fDev) &&
      (!s || (l.nombre || '').toLowerCase().includes(s) || (l.telefono || '').includes(s))
    );
  }, [leads, mine, effId, effOrg, fDev, q]);

  const revision = useMemo(
    () => (leads || []).filter(l => l.estatus === 'en_revision' && (!effOrg || l.org_id === effOrg)),
    [leads, effOrg]
  );
  const cols = useMemo(() => {
    const g = Object.fromEntries(ETAPAS.map(e => [e, []]));
    visibles.filter(l => l.estatus !== 'en_revision').forEach(l => {
      (g[l.etapa] || g.Nuevo).push(l);
    });
    return g;
  }, [visibles]);

  const kpi = useMemo(() => {
    const act = visibles.filter(l => l.estatus !== 'en_revision');
    const ganados = act.filter(l => l.etapa === 'Escriturado').length;
    const perdidos = act.filter(l => l.etapa === 'Perdido').length;
    const abiertos = act.filter(l => !TERM[l.etapa]).length;
    const cerrados = ganados + perdidos;
    return {
      total: act.length, abiertos, ganados,
      conv: cerrados ? Math.round(ganados / cerrados * 100) : null,
      revision: revision.length,
    };
  }, [visibles, revision]);

  const selLead = sel != null ? (leads || []).find(l => l.id === sel) : null;
  const devFiltros = useMemo(() => {
    const set = new Map();
    (leads || []).forEach(l => { if (l.dev_sku) set.set(l.dev_sku, devName[l.dev_sku] || l.dev_sku); });
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads, devName]);

  if (leads === null) return <div className="loading">Cargando CRM…</div>;

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>CRM · Pipeline</span>
        <nav className="nav">
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          {me?.rol === 'super_admin' && <span className="tag-super">SUPER ADMIN</span>}
          <span style={{ color: 'var(--sub)', fontSize: '.85rem' }}>{me?.nombre || me?.email}</span>
          <button onClick={logout}>Salir</button>
        </nav>
      </div></header>

      {me?.rol === 'super_admin' && <SuperBar onChange={setViewAs} />}

      <main className="wrap">
        <div className="crm-metrics">
          <div className="mtile"><b>{kpi.total}</b><span>Leads activos</span></div>
          <div className="mtile"><b>{kpi.abiertos}</b><span>En pipeline</span></div>
          <div className="mtile win"><b>{kpi.ganados}</b><span>Escriturados</span></div>
          <div className="mtile"><b>{kpi.conv == null ? '—' : kpi.conv + '%'}</b><span>Tasa de cierre</span></div>
          {puedeGestionar && <div className="mtile acc"><b>{kpi.revision}</b><span>Por revisar</span></div>}
        </div>

        {puedeGestionar && revision.length > 0 && (
          <section className="inbox">
            <h2><span className="warn-ic">⚠️</span> Bandeja de aprobación · anti-duplicados</h2>
            <p className="sub">Estos registros coinciden en teléfono o correo con un lead que ya existe en tu organización. Apruébalos si son legítimos o recházalos para proteger la asignación de comisión.</p>
            {revision.map(l => (
              <div className="rev-row" key={l.id}>
                <div className="who">
                  <b>{l.nombre}</b>
                  <small>{l.telefono || 's/tel'} · {l.email || 's/correo'} · {devName[l.dev_sku] || l.dev_sku || 'sin desarrollo'} · registró {nombreDe(l.asesor_id)}</small>
                </div>
                <span className="why">Posible duplicado</span>
                <button className="btn ok sm" disabled={busy} onClick={() => aprobar(l.id)}>Aprobar</button>
                <button className="btn no sm" disabled={busy} onClick={() => rechazar(l.id)}>Rechazar</button>
              </div>
            ))}
          </section>
        )}

        <div className="filters">
          <input
            style={{ appearance: 'none', padding: '.55rem .85rem', border: '1px solid var(--line)', borderRadius: 99, background: 'var(--panel)', color: 'var(--ink)', fontSize: '.86rem', minWidth: 200 }}
            placeholder="Buscar por nombre o teléfono…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={fDev} onChange={e => setFDev(e.target.value)}>
            <option value="">Todos los desarrollos</option>
            {devFiltros.map(([sku, nom]) => <option key={sku} value={sku}>{nom}</option>)}
          </select>
          <span className={'chip' + (mine ? ' on' : '')} onClick={() => setMine(m => !m)}>👤 Solo mis leads</span>
          <span className="count">{visibles.filter(l => l.estatus !== 'en_revision').length} en tablero</span>
        </div>

        {kpi.total === 0 && revision.length === 0 ? (
          <div className="crm-empty">
            Todavía no hay clientes registrados.<br />
            Ve al <a onClick={() => router.push('/portal')}>catálogo</a>, abre una ficha y usa <b>“Registrar cliente”</b> para capturar tu primer lead.
          </div>
        ) : (
          <div className="kboard">
            {ETAPAS.map(etapa => {
              const items = cols[etapa] || [];
              const suma = items.reduce((a, l) => a + (presupNum(l.presupuesto) || 0), 0);
              return (
                <div
                  key={etapa}
                  className={'kcol' + (TERM[etapa] ? ' ' + TERM[etapa] : '') + (drag === etapa ? ' drag' : '')}
                  onDragOver={e => { e.preventDefault(); if (drag !== etapa) setDrag(etapa); }}
                  onDragLeave={() => setDrag(d => d === etapa ? null : d)}
                  onDrop={e => {
                    e.preventDefault();
                    const id = +e.dataTransfer.getData('text/plain');
                    if (id) { const l = leads.find(x => x.id === id); if (l && l.etapa !== etapa) mover(id, etapa); }
                    setDrag(null);
                  }}
                >
                  <div className="kcol-h">
                    <b>{etapa}</b>
                    <div style={{ textAlign: 'right' }}>
                      <span className="n">{items.length}</span>
                      {suma > 0 && <span className="sum">{MXN(suma)}</span>}
                    </div>
                  </div>
                  <div className="kcol-body">
                    {items.map(l => {
                      const d = dias(l.actualizado);
                      return (
                        <article
                          key={l.id} className="lcard" draggable
                          onDragStart={e => e.dataTransfer.setData('text/plain', String(l.id))}
                          onClick={() => setSel(l.id)}
                        >
                          <h4>{l.nombre}{!TERM[etapa] && <span className={'age ' + ageClass(d)}>{d}d</span>}</h4>
                          <div className="dev">{devName[l.dev_sku] || l.dev_sku || 'Sin desarrollo'}{l.unidad_sku ? ' · ' + l.unidad_sku : ''}</div>
                          <div className="lmeta">
                            {presupNum(l.presupuesto) && <span className="lchip">{MXN(presupNum(l.presupuesto))}</span>}
                            {l.telefono && <span className="lchip">📞 {l.telefono}</span>}
                          </div>
                          <div className="asig">{nombreDe(l.asesor_id)}</div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selLead && (
        <LeadDrawer
          lead={selLead} devName={devName} team={team} puedeGestionar={puedeGestionar}
          busy={busy} nombreDe={nombreDe}
          onClose={() => setSel(null)}
          onMover={mover} onReasignar={reasignar} onNotas={(id, notas) => patch(id, { notas })}
          onAgendar={agendar}
        />
      )}
    </>
  );
}

function LeadDrawer({ lead, devName, team, puedeGestionar, busy, nombreDe, onClose, onMover, onReasignar, onNotas, onAgendar }) {
  const [notas, setNotas] = useState(lead.notas || '');
  const [showCita, setShowCita] = useState(false);
  const [cita, setCita] = useState({ fecha: '', hora: '', modalidad: 'Presencial', notas: '' });
  useEffect(() => { setNotas(lead.notas || ''); }, [lead.id]);

  const asesores = team.filter(t => t.rol !== 'super_admin' && t.org_id === lead.org_id);
  const p = presupNum(lead.presupuesto);
  const telDig = lead.telefono ? soloDigitos(lead.telefono) : '';
  const waHref = telDig ? 'https://wa.me/' + (telDig.length === 10 ? '52' : '') + telDig : null;

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div>
            <span className="dw-tag">{lead.etapa}</span>
            <h2>{lead.nombre}</h2>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="dw-sec">
          <h3>Mover en el pipeline</h3>
          <div className="dw-stages">
            {ETAPAS.map(e => (
              <span key={e} className={'st' + (lead.etapa === e ? ' on' : '')}
                onClick={() => lead.etapa !== e && onMover(lead.id, e)}>{e}</span>
            ))}
          </div>
        </div>

        <div className="dw-sec">
          <h3>Datos del cliente</h3>
          <div className="dw-kv"><span>Teléfono</span><b>{lead.telefono || '—'}</b></div>
          <div className="dw-kv"><span>Correo</span><b>{lead.email || '—'}</b></div>
          <div className="dw-kv"><span>Desarrollo</span><b>{devName[lead.dev_sku] || lead.dev_sku || '—'}</b></div>
          {lead.unidad_sku && <div className="dw-kv"><span>Unidad</span><b>{lead.unidad_sku}</b></div>}
          <div className="dw-kv"><span>Presupuesto</span><b>{p ? MXN(p) : (lead.presupuesto || '—')}</b></div>
          <div className="dw-kv"><span>Fuente</span><b>{lead.fuente}</b></div>
          <div className="dw-kv"><span>Registrado</span><b>{new Date(lead.creado).toLocaleDateString('es-MX')}</b></div>
          {lead.mensaje && <div style={{ color: 'var(--sub)', fontSize: '.85rem', marginTop: '.5rem' }}>“{lead.mensaje}”</div>}
          {waHref && <div style={{ marginTop: '.7rem' }}><a className="wa-link" href={waHref} target="_blank" rel="noopener">💬 Abrir WhatsApp</a></div>}
        </div>

        <div className="dw-sec">
          <h3>Asesor asignado</h3>
          {puedeGestionar ? (
            <div className="dw-field">
              <select value={lead.asesor_id || ''} onChange={e => onReasignar(lead.id, e.target.value || null)}>
                <option value="">— Sin asignar —</option>
                {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre} · {a.rol}</option>)}
              </select>
            </div>
          ) : <div className="dw-kv"><span>Responsable</span><b>{nombreDe(lead.asesor_id)}</b></div>}
        </div>

        <div className="dw-sec">
          <h3>Notas de seguimiento</h3>
          <div className="dw-field">
            <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Última llamada, objeciones, siguiente paso…" />
          </div>
          <button className="btn mag sm" disabled={busy || notas === (lead.notas || '')} onClick={() => onNotas(lead.id, notas)}>Guardar notas</button>
        </div>

        <div className="dw-sec">
          <h3>Cita</h3>
          {!showCita ? (
            <button className="btn ghost sm" onClick={() => setShowCita(true)}>+ Agendar cita / visita</button>
          ) : (
            <>
              <div className="dw-row">
                <div className="dw-field"><label>Fecha</label><input type="date" value={cita.fecha} onChange={e => setCita({ ...cita, fecha: e.target.value })} /></div>
                <div className="dw-field"><label>Hora</label><input type="time" value={cita.hora} onChange={e => setCita({ ...cita, hora: e.target.value })} /></div>
              </div>
              <div className="dw-field">
                <label>Modalidad</label>
                <select value={cita.modalidad} onChange={e => setCita({ ...cita, modalidad: e.target.value })}>
                  <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                </select>
              </div>
              <div className="dw-field"><textarea placeholder="Notas de la cita…" value={cita.notas} onChange={e => setCita({ ...cita, notas: e.target.value })} /></div>
              <button className="btn lim sm" disabled={busy} onClick={async () => {
                const ok = await onAgendar(lead, cita);
                if (ok) { setShowCita(false); setCita({ fecha: '', hora: '', modalidad: 'Presencial', notas: '' }); }
              }}>Confirmar cita</button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
