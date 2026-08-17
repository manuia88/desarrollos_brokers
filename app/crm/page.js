'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import SuperBar from '../../components/SuperBar';
import RegistroCliente from '../../components/RegistroCliente';
import DocsCliente from '../../components/DocsCliente';
import { getViewAs } from '../../lib/viewas';
import { googleCalUrl, descargarIcs, crearEventoGoogle, cancelarEventoGoogle } from '../../lib/calendario';

const ETAPAS = ['Nuevo', 'Contactado', 'Cita', 'Apartado', 'Escriturado', 'Perdido'];
const TERM = { Escriturado: 'win', Perdido: 'lost' };
const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const MXNc = n => n == null ? '—' : (Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n).toLocaleString('es-MX'));
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
  const [showReg, setShowReg] = useState(false);
  const [devsFull, setDevsFull] = useState([]);
  const [apartados, setApartados] = useState([]);

  useEffect(() => { setViewAs(getViewAs()); }, []);

  const load = useCallback(async () => {
    const [{ data: ld }, { data: ap }] = await Promise.all([
      supabase.from('leads').select('*').order('actualizado', { ascending: false }),
      supabase.from('apartados').select('*').order('creado', { ascending: false }),
    ]);
    setLeads(ld || []);
    setApartados(ap || []);
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
        supabase.from('desarrollos').select('sku,nombre,comision_broker').order('nombre'),
      ]);
      setTeam(ppl || []);
      setDevsFull(devs || []);
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
    const { data: nueva, error } = await supabase.from('citas').insert({
      org_id: lead.org_id, lead_id: lead.id, asesor_id: lead.asesor_id,
      nombre: lead.nombre, email: lead.email, telefono: lead.telefono,
      dev_sku: lead.dev_sku, fecha, hora, modalidad, notas, estatus: 'Solicitada',
    }).select('id').single();
    setBusy(false);
    if (error) { alert('No se pudo agendar: ' + error.message); return false; }
    if (nueva?.id) crearEventoGoogle(nueva.id);
    if (lead.etapa === 'Nuevo' || lead.etapa === 'Contactado') await mover(lead.id, 'Cita');
    return true;
  }

  async function apartar(unidadSku, leadId) {
    setBusy(true);
    const { error } = await supabase.rpc('apartar_unidad', { p_unidad_sku: unidadSku, p_lead_id: leadId, p_notas: null });
    setBusy(false);
    if (error) { alert('No se pudo apartar: ' + error.message); return false; }
    await load(); return true;
  }
  async function apartadoEstatus(apId, estatus, motivo) {
    setBusy(true);
    const { error } = await supabase.rpc('apartado_set_estatus', { p_apartado_id: apId, p_estatus: estatus, p_motivo: motivo || null });
    setBusy(false);
    if (error) { alert('No se pudo actualizar: ' + error.message); return false; }
    await load(); return true;
  }
  async function autorizar(apId, aprobar, motivo) {
    setBusy(true);
    const { error } = await supabase.rpc('autorizar_apartado', { p_apartado_id: apId, p_aprobar: aprobar, p_motivo: motivo || null });
    setBusy(false);
    if (error) { alert('No se pudo procesar: ' + error.message); return false; }
    await load(); return true;
  }

  // Apartado activo (no cancelado/rechazado) por lead
  const apByLead = useMemo(() => {
    const m = {};
    (apartados || []).forEach(a => { if (!['Cancelado', 'Rechazado'].includes(a.estatus) && a.lead_id != null && !m[a.lead_id]) m[a.lead_id] = a; });
    return m;
  }, [apartados]);
  const pendientes = useMemo(() => (apartados || []).filter(a => a.estatus === 'Pendiente'), [apartados]);
  const leadById = useMemo(() => Object.fromEntries((leads || []).map(l => [l.id, l])), [leads]);

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

  const comision = useMemo(() => {
    let pipe = 0, ganada = 0;
    visibles.forEach(l => {
      const a = apByLead[l.id]; if (!a) return;
      if (a.estatus === 'Escriturado') ganada += a.comision_monto || 0;
      else if (a.estatus === 'Apartado') pipe += a.comision_monto || 0;
    });
    return { pipe, ganada };
  }, [visibles, apByLead]);

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
          <a onClick={() => router.push('/buscar')}>Buscar</a>
          <a onClick={() => router.push('/portal')}>Catálogo</a>
          <a onClick={() => router.push('/comisiones')}>Comisiones</a>
          <a onClick={() => router.push('/marca')}>Mi marca</a>
          {me?.rol === 'super_admin' && <a onClick={() => router.push('/altas')}>Altas</a>}
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
          <div className="mtile com" onClick={() => router.push('/comisiones')} style={{ cursor: 'pointer' }}
            title="Ver comisiones"><b>{MXNc(comision.pipe)}</b><span>Comisión en pipeline →</span></div>
          {me?.rol === 'super_admin' && <div className="mtile acc"><b>{pendientes.length}</b><span>Apartados por autorizar</span></div>}
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

        {me?.rol === 'super_admin' && pendientes.length > 0 && (
          <section className="inbox">
            <h2><span className="warn-ic">🔖</span> Apartados por autorizar</h2>
            <p className="sub">Ninguna unidad sale del inventario hasta que tú autorices. Aprueba para descontarla y confirmar la comisión, o rechaza la solicitud.</p>
            {pendientes.map(a => {
              const l = leadById[a.lead_id];
              return (
                <div className="rev-row" key={a.id}>
                  <div className="who">
                    <b>{l?.nombre || 'Cliente'}</b>
                    <small>{devName[a.dev_sku] || a.dev_sku} · {a.unidad_sku} · {MXN(a.precio)} · comisión {MXN(a.comision_monto)} · solicitó {nombreDe(a.asesor_id)}</small>
                  </div>
                  <span className="why">Pendiente</span>
                  <button className="btn ok sm" disabled={busy} onClick={() => autorizar(a.id, true)}>Autorizar</button>
                  <button className="btn no sm" disabled={busy} onClick={() => autorizar(a.id, false)}>Rechazar</button>
                </div>
              );
            })}
          </section>
        )}

        <div className="filters">
          <button className="btn mag sm" onClick={() => setShowReg(true)}>+ Nuevo cliente</button>
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
            Captura tu primer lead con <b>“+ Nuevo cliente”</b>, o ve al <a onClick={() => router.push('/portal')}>catálogo</a> y regístralo desde una ficha.
            <div style={{ marginTop: '1rem' }}><button className="btn mag" onClick={() => setShowReg(true)}>+ Nuevo cliente</button></div>
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
                            {apByLead[l.id] && <span className="lchip com">🔖 {MXNc(apByLead[l.id].comision_monto)}</span>}
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
          apartado={apByLead[selLead.id]} devsFull={devsFull} esSuper={me?.rol === 'super_admin'}
          onClose={() => setSel(null)}
          onMover={mover} onReasignar={reasignar} onNotas={(id, notas) => patch(id, { notas })}
          onAgendar={agendar} onApartar={apartar} onApartadoEstatus={apartadoEstatus} onAutorizar={autorizar}
        />
      )}

      {showReg && (
        <RegistroCliente me={me} onClose={() => setShowReg(false)} onDone={() => load()} />
      )}
    </>
  );
}

function LeadDrawer({ lead, devName, team, puedeGestionar, busy, nombreDe, apartado, devsFull, esSuper, onClose, onMover, onReasignar, onNotas, onAgendar, onApartar, onApartadoEstatus, onAutorizar }) {
  const [notas, setNotas] = useState(lead.notas || '');
  const [showCita, setShowCita] = useState(false);
  const [cita, setCita] = useState({ fecha: '', hora: '', modalidad: 'Presencial', notas: '' });
  const [citas, setCitas] = useState([]);
  useEffect(() => { setNotas(lead.notas || ''); }, [lead.id]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('citas').select('*').eq('lead_id', lead.id).order('fecha');
      setCitas(data || []);
    })();
  }, [lead.id]);
  async function cancelarCita(c) {
    await supabase.from('citas').update({ estatus: 'Cancelada' }).eq('id', c.id);
    cancelarEventoGoogle(c.id);
    const { data } = await supabase.from('citas').select('*').eq('lead_id', lead.id).order('fecha');
    setCitas(data || []);
  }

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
          <div className="dw-kv"><span>Forma de pago</span><b>{lead.forma_pago || '—'}</b></div>
          {lead.rec_interes != null && <div className="dw-kv"><span>Recámaras</span><b>{lead.rec_interes === 3 ? '3+' : lead.rec_interes}</b></div>}
          {lead.zona_interes && <div className="dw-kv"><span>Zona de interés</span><b>{lead.zona_interes}</b></div>}
          {lead.urgencia && <div className="dw-kv"><span>Horizonte de compra</span><b>{lead.urgencia}</b></div>}
          <div className="dw-kv"><span>Fuente</span><b>{lead.fuente}</b></div>
          <div className="dw-kv"><span>Registrado</span><b>{new Date(lead.creado).toLocaleDateString('es-MX')}</b></div>
          {lead.mensaje && <div style={{ color: 'var(--sub)', fontSize: '.85rem', marginTop: '.5rem' }}>“{lead.mensaje}”</div>}
          {waHref && <div style={{ marginTop: '.7rem' }}><a className="wa-link" href={waHref} target="_blank" rel="noopener">💬 Abrir WhatsApp</a></div>}
        </div>

        <ApartadoSection lead={lead} apartado={apartado} devsFull={devsFull} busy={busy} esSuper={esSuper}
          onApartar={onApartar} onEstatus={onApartadoEstatus} onAutorizar={onAutorizar} />

        <DocsCliente lead={lead} />

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
          {citas.length > 0 && (
            <div className="cita-list">
              {citas.map(c => {
                const cal = {
                  titulo: `Cita — ${devName[c.dev_sku] || c.dev_sku || lead.nombre}`,
                  fecha: c.fecha, hora: c.hora,
                  detalles: `Cliente: ${c.nombre || lead.nombre} · Tel ${c.telefono || lead.telefono || ''}. ${c.notas || ''}`,
                  ubicacion: '',
                };
                return (
                  <div className="cita-row" key={c.id}>
                    <div>
                      <b>{new Date(c.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}{c.hora ? ` · ${c.hora}` : ''}</b>
                      <span>{[c.modalidad, c.estatus].filter(Boolean).join(' · ')}{c.notas ? ' · ' + c.notas : ''}</span>
                    </div>
                    <div className="cita-cal">
                      <a className="cita-btn" href={googleCalUrl(cal)} target="_blank" rel="noopener" title="Agregar a Google Calendar">📅</a>
                      <button className="cita-btn" onClick={() => descargarIcs(cal)} title="Descargar .ics">⬇</button>
                      {c.estatus !== 'Cancelada' && <button className="cita-btn" onClick={() => cancelarCita(c)} title="Cancelar cita">✕</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function ApartadoSection({ lead, apartado, devsFull, busy, esSuper, onApartar, onEstatus, onAutorizar }) {
  const [open, setOpen] = useState(false);
  const [dev, setDev] = useState(lead.dev_sku || '');
  const [units, setUnits] = useState(null);
  const [unit, setUnit] = useState('');
  const [cancel, setCancel] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open || !dev) { setUnits(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.from('unidades')
        .select('sku,torre,num_depto,prototipo,precio,apartado,estatus')
        .eq('dev_sku', dev).eq('estatus', 'Disponible').order('num_depto');
      if (alive) setUnits(data || []);
    })();
    return () => { alive = false; };
  }, [open, dev]);

  const ESTC = { Pendiente: 'pd', Apartado: 'ap', Escriturado: 'es', Cancelado: 'cx', Rechazado: 'cx' };

  if (apartado) {
    const e = apartado.estatus;
    return (
      <div className="dw-sec">
        <h3>Apartado y comisión</h3>
        <div className="ap-card">
          <div className="ap-top">
            <div>
              <b>{apartado.unidad_sku}</b>
              <div className="ap-sub">{MXN(apartado.precio)} · apartado {MXN(apartado.monto_apartado)}</div>
            </div>
            <span className={'ap-badge ' + (ESTC[e] || '')}>{e}</span>
          </div>
          <div className="ap-com">
            <span>Comisión {apartado.comision_pct != null ? Math.round(apartado.comision_pct * 100) + '%' : ''}</span>
            <b>{MXN(apartado.comision_monto)}</b>
          </div>

          {e === 'Pendiente' && !esSuper && (
            <div className="ap-hint">⏳ Solicitud enviada. La unidad se aparta cuando un super-admin la autorice.</div>
          )}
          {e === 'Pendiente' && esSuper && (
            <div className="ap-actions">
              <button className="btn ok sm" disabled={busy} onClick={() => onAutorizar(apartado.id, true)}>Autorizar</button>
              <button className="btn no sm" disabled={busy} onClick={() => onAutorizar(apartado.id, false)}>Rechazar</button>
            </div>
          )}
          {e === 'Apartado' && !esSuper && (
            <div className="ap-hint">Apartado autorizado. La escrituración y la cancelación las gestiona el super-admin.</div>
          )}
          {e === 'Apartado' && esSuper && !cancel && (
            <div className="ap-actions">
              <button className="btn mag sm" disabled={busy} onClick={() => onEstatus(apartado.id, 'Escriturado')}>Escriturar</button>
              <button className="btn ghost sm" disabled={busy} onClick={() => setCancel(true)}>Cancelar</button>
            </div>
          )}
          {e === 'Escriturado' && <div className="ap-won">✅ Comisión ganada</div>}

          {cancel && e === 'Apartado' && esSuper && (
            <div className="ap-cancel">
              <input placeholder="Motivo (opcional)" value={motivo} onChange={ev => setMotivo(ev.target.value)} />
              <div className="ap-actions">
                <button className="btn no sm" disabled={busy} onClick={async () => { const ok = await onEstatus(apartado.id, 'Cancelado', motivo); if (ok) setCancel(false); }}>Confirmar cancelación</button>
                <button className="btn ghost sm" onClick={() => setCancel(false)}>Volver</button>
              </div>
              <p className="ap-hint">La unidad vuelve a inventario disponible.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const d = devsFull.find(x => x.sku === dev);
  const u = (units || []).find(x => x.sku === unit);
  const com = u ? Math.round((u.precio || 0) * (d?.comision_broker || 0)) : null;

  return (
    <div className="dw-sec">
      <h3>{esSuper ? 'Apartar unidad' : 'Solicitar apartado'}</h3>
      {!open ? (
        <button className="btn lim sm" onClick={() => setOpen(true)}>🔖 {esSuper ? 'Apartar una unidad para este cliente' : 'Solicitar apartado de una unidad'}</button>
      ) : (
        <>
          <div className="dw-field">
            <label>Desarrollo</label>
            <select value={dev} onChange={e => { setDev(e.target.value); setUnit(''); }}>
              <option value="">Elige…</option>
              {devsFull.map(x => <option key={x.sku} value={x.sku}>{x.nombre}</option>)}
            </select>
          </div>
          {dev && (
            <div className="dw-field">
              <label>Unidad disponible</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="">{units == null ? 'Cargando…' : units.length ? 'Elige unidad…' : 'Sin unidades disponibles'}</option>
                {(units || []).map(x => <option key={x.sku} value={x.sku}>T{x.torre} · {x.num_depto}{x.prototipo ? ' · ' + x.prototipo : ''} — {MXN(x.precio)}</option>)}
              </select>
            </div>
          )}
          {u && (
            <div className="ap-preview">
              <div><span>Precio</span><b>{MXN(u.precio)}</b></div>
              <div><span>Apartado</span><b>{MXN(u.apartado)}</b></div>
              <div className="acc"><span>Comisión ({d?.comision_broker != null ? Math.round(d.comision_broker * 100) + '%' : '—'})</span><b>{MXN(com)}</b></div>
            </div>
          )}
          {!esSuper && <p className="ap-hint">Tu solicitud pasa a autorización del super-admin antes de descontar el inventario.</p>}
          <div className="ap-actions">
            <button className="btn mag sm" disabled={busy || !unit} onClick={async () => { const ok = await onApartar(unit, lead.id); if (ok) setOpen(false); }}>{esSuper ? 'Confirmar apartado' : 'Enviar solicitud'}</button>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
