'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { scoreLead, accionSugerida, diasSin } from '../../lib/leadscore';

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dias = ts => ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 0;
const first = n => String(n || '').split(' ')[0];
const MXN = n => n == null ? null : '$' + Math.round(n).toLocaleString('es-MX');
const wa = (tel, txt) => { const d = String(tel || '').replace(/[^0-9]/g, ''); return d ? `https://wa.me/52${d.length === 10 ? d : d.replace(/^52/, '')}?text=${encodeURIComponent(txt || '')}` : null; };

export default function Hoy() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [citas, setCitas] = useState([]);
  const [devName, setDevName] = useState({});
  const [devById, setDevById] = useState({});
  // Briefing IA
  const [brief, setBrief] = useState(null);   // { nombre, texto, loading, disabled }
  const [resIA, setResIA] = useState(null);   // resumen afinado por IA { texto, loading, disabled }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [{ data: l }, { data: c }, { data: d }] = await Promise.all([
        supabase.from('leads').select('*').order('actualizado', { ascending: true }),
        supabase.from('citas').select('*').gte('fecha', hoyStr()).order('fecha').order('hora'),
        supabase.from('desarrollos').select('sku,nombre,direccion,alcaldia'),
      ]);
      setLeads(l || []); setCitas(c || []);
      setDevName(Object.fromEntries((d || []).map(x => [x.sku, tituloDev(x)])));
      setDevById(Object.fromEntries((d || []).map(x => [x.sku, x])));
    })();
  }, [router]);

  const hoy = hoyStr();
  const citasHoy = useMemo(() => citas.filter(c => c.fecha === hoy && ['Solicitada', 'Confirmada'].includes(c.estatus)), [citas, hoy]);
  const citasProx = useMemo(() => citas.filter(c => c.fecha > hoy && ['Solicitada', 'Confirmada'].includes(c.estatus)).slice(0, 5), [citas, hoy]);
  const nuevos = useMemo(() => (leads || []).filter(l => (l.etapa || 'Nuevo') === 'Nuevo' && !/perd|escrit/i.test(l.estatus || '')), [leads]);

  // Lead-score real: rankea el pipeline vivo (excluye perdidos/cerrados).
  const scored = useMemo(() => {
    const vivos = (leads || []).filter(l => !/perd|cerrad|escrit/i.test((l.etapa || '') + ' ' + (l.estatus || '')));
    return vivos.map(l => ({ l, sc: scoreLead(l, { devById }) })).sort((a, b) => b.sc.score - a.sc.score);
  }, [leads, devById]);
  const calientes = useMemo(() => scored.filter(x => x.sc.temp === 'caliente').slice(0, 8), [scored]);
  const seguir = useMemo(() => (leads || []).filter(l => ['Contactado', 'Cita', 'Apartado'].includes(l.etapa)).sort((a, b) => dias(b.actualizado) - dias(a.actualizado)).slice(0, 15), [leads]);

  // Prioridad ahora: próxima cita de hoy > lead más caliente > lead más estancado.
  const prioridad = useMemo(() => {
    const cita = citasHoy[0];
    if (cita) return { tipo: 'cita', titulo: `Cita ${cita.hora || 'hoy'} con ${first(cita.nombre)}`, sub: `${devName[cita.dev_sku] || 'Sin desarrollo'} · ${cita.modalidad || 'Presencial'}`, cita, nombre: cita.nombre, tel: cita.telefono };
    const hot = calientes[0];
    if (hot) return { tipo: 'lead', titulo: `Llama a ${first(hot.l.nombre)} — está caliente`, sub: accionSugerida(hot.l, hot.sc), lead: hot.l, nombre: hot.l.nombre, tel: hot.l.telefono, sc: hot.sc };
    const stale = seguir[0];
    if (stale) return { tipo: 'lead', titulo: `Reactiva a ${first(stale.nombre)}`, sub: `${dias(stale.actualizado)} días sin moverse · ${stale.etapa}`, lead: stale, nombre: stale.nombre, tel: stale.telefono };
    return null;
  }, [citasHoy, calientes, seguir, devName]);

  async function pedirBriefing(payload, nombre) {
    setBrief({ nombre, loading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/ia/briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      setBrief({ nombre, texto: j.briefing || j.error || 'Sin respuesta.', disabled: !!j.disabled });
    } catch (e) {
      setBrief({ nombre, texto: 'No se pudo generar el briefing: ' + (e.message || 'error') });
    }
  }

  // Resumen del día por reglas (instantáneo, sin IA). La IA solo lo "afina".
  const resumenReglas = useMemo(() => {
    const arranque = prioridad ? prioridad.titulo.charAt(0).toLowerCase() + prioridad.titulo.slice(1) : (nuevos.length ? 'tus nuevos por llamar' : 'tu seguimiento');
    const p1 = `Hoy tienes ${citasHoy.length} cita${citasHoy.length === 1 ? '' : 's'} y ${calientes.length} lead${calientes.length === 1 ? '' : 's'} caliente${calientes.length === 1 ? '' : 's'}.`;
    const p2 = `Arranca con ${arranque}.`;
    const p3 = `Te quedan ${nuevos.length} nuevo${nuevos.length === 1 ? '' : 's'} por llamar y ${seguir.length} en seguimiento.`;
    return `${p1} ${p2} ${p3}`;
  }, [citasHoy, calientes, nuevos, seguir, prioridad]);

  async function afinarResumen() {
    setResIA({ loading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/ia/resumen', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ citas: citasHoy.length, calientes: calientes.length, nuevos: nuevos.length, seguir: seguir.length, prioridad: prioridad?.titulo, top: calientes[0]?.l?.nombre }),
      });
      const j = await r.json();
      setResIA({ texto: j.resumen || j.error, disabled: !!j.disabled });
    } catch (e) {
      setResIA({ texto: 'No se pudo afinar: ' + (e.message || 'error') });
    }
  }

  // #5 — "¿Qué le queda?": abre el Copiloto con una pregunta armada del perfil del lead.
  function queLeQueda(l) {
    const rec = l.rec_interes != null ? (l.rec_interes === 0 ? 'un loft' : `${l.rec_interes} recámaras`) : null;
    const pres = MXN(l.presupuesto_max || l.presupuesto);
    const partes = [
      `Cliente ${first(l.nombre)}:`,
      rec && `busca ${rec}`,
      l.zona_interes && `en ${l.zona_interes}`,
      pres && `con presupuesto hasta ${pres}`,
      l.forma_pago && !/definir/i.test(l.forma_pago) && `paga con ${l.forma_pago}`,
    ].filter(Boolean).join(' ');
    const q = `${partes}. ¿Qué unidades de mi inventario le quedan y por qué?`;
    router.push('/copiloto?q=' + encodeURIComponent(q));
  }

  if (leads === null) return <div className="loading">Cargando tu día…</div>;
  const nombre = first(me?.nombre);
  const tempCls = t => 'ck-temp ' + t;

  return (
    <>
      <Nav me={me} current="/hoy" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Hoy{nombre ? `, ${nombre}` : ''}</h1>
          <p>Tu cabina del día: la acción más importante primero, tus leads calientes y tus citas. Empieza por arriba.</p>
        </div>

        <div className="ck-resumen">
          <span className="ck-res-ic">📝</span>
          <p>{resIA?.loading ? 'Afinando tu resumen con IA…' : (resIA?.texto || resumenReglas)}</p>
          {resIA?.disabled
            ? <span className="ck-res-note">Conecta tu IA en <a onClick={() => router.push('/conexiones')}>Conexiones</a> para afinarlo</span>
            : !resIA && <button className="cotiz-mini ghost" onClick={afinarResumen}>✨ Afínalo con IA</button>}
        </div>

        {prioridad && (
          <div className="ck-hero">
            <div className="ck-hero-tag">⚡ Prioridad ahora</div>
            <div className="ck-hero-main">
              <div>
                <h2>{prioridad.titulo}</h2>
                <p>{prioridad.sub}</p>
              </div>
              <div className="ck-hero-actions">
                {wa(prioridad.tel, `Hola ${first(prioridad.nombre)}, `) && (
                  <a className="btn lim" href={wa(prioridad.tel, `Hola ${first(prioridad.nombre)}, `)} target="_blank" rel="noopener">WhatsApp</a>
                )}
                <button className="btn ghost" onClick={() => pedirBriefing(prioridad.cita ? { citaId: prioridad.cita.id } : { leadId: prioridad.lead.id }, prioridad.nombre)}>⚡ Prepárame (IA)</button>
                {prioridad.lead && <button className="btn ghost" onClick={() => queLeQueda(prioridad.lead)}>🏠 ¿Qué le queda?</button>}
                <button className="btn ghost" onClick={() => router.push('/crm')}>Ver en CRM</button>
              </div>
            </div>
          </div>
        )}

        <div className="mtiles" style={{ margin: '1.2rem 0 1.3rem' }}>
          <div className="mtile acc"><b>{citasHoy.length}</b><span>Citas hoy</span></div>
          <div className="mtile hot"><b>{calientes.length}</b><span>Leads calientes 🔥</span></div>
          <div className="mtile"><b>{nuevos.length}</b><span>Nuevos por llamar</span></div>
          <div className="mtile"><b>{seguir.length}</b><span>En seguimiento</span></div>
        </div>

        <div className="hoy-cols">
          <section className="sec">
            <h2>🔥 Calientes de hoy</h2>
            <p className="fnote" style={{ marginBottom: '.6rem' }}>Priorizados por el lead-score (actividad, urgencia, pago, etapa y calce de inventario).</p>
            {calientes.length === 0 ? <p className="fnote">Ningún lead caliente ahora. Trabaja tibios y nuevos.</p> : calientes.map(({ l, sc }) => (
              <div className="hoy-lead ck-lead" key={l.id}>
                <div className="ck-lead-main" onClick={() => router.push('/crm')}>
                  <div className="ck-lead-top"><b>{l.nombre}</b><span className={tempCls(sc.temp)}>{sc.score}</span></div>
                  <span className="hoy-lead-sub">{accionSugerida(l, sc)}</span>
                </div>
                <div className="ck-lead-act">
                  {wa(l.telefono, `Hola ${first(l.nombre)}, `) && <a className="cotiz-mini" href={wa(l.telefono, `Hola ${first(l.nombre)}, `)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>Escribir</a>}
                  <button className="cotiz-mini ghost" title="Prepárame para este lead (IA)" onClick={e => { e.stopPropagation(); pedirBriefing({ leadId: l.id }, l.nombre); }}>⚡ IA</button>
                  <button className="cotiz-mini ghost" title="¿Qué unidad le queda?" onClick={e => { e.stopPropagation(); queLeQueda(l); }}>🏠</button>
                </div>
              </div>
            ))}
          </section>

          <section className="sec">
            <h2>📅 Citas de hoy</h2>
            {citasHoy.length === 0 ? <p className="fnote">Sin citas hoy.</p> : citasHoy.map(c => (
              <div className="hoy-cita" key={c.id}>
                <div className="hoy-hora">{c.hora || '—'}</div>
                <div className="hoy-cita-main"><b>{c.nombre}</b><span>{devName[c.dev_sku] || c.dev_sku || 'Sin desarrollo'} · {c.modalidad || 'Presencial'}</span></div>
                <button className="cotiz-mini ghost" onClick={() => pedirBriefing({ citaId: c.id }, c.nombre)}>IA</button>
                {wa(c.telefono, `Hola ${first(c.nombre)}, te confirmo tu cita de hoy.`) && <a className="cotiz-mini" href={wa(c.telefono, `Hola ${first(c.nombre)}, te confirmo tu cita de hoy.`)} target="_blank" rel="noopener">WhatsApp</a>}
              </div>
            ))}
            {citasProx.length > 0 && <>
              <h2 style={{ marginTop: '1.2rem' }}>Próximas</h2>
              {citasProx.map(c => <div className="hoy-prox" key={c.id}><span>{new Date(c.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {c.hora || ''}</span><b>{c.nombre}</b></div>)}
            </>}
          </section>

          <section className="sec">
            <h2>📞 Nuevos por llamar</h2>
            {nuevos.length === 0 ? <p className="fnote">Ningún lead nuevo sin contactar. 👏</p> : nuevos.slice(0, 12).map(l => (
              <div className="hoy-lead" key={l.id} onClick={() => router.push('/crm')}>
                <div><b>{l.nombre}</b><span className="hoy-lead-sub">{devName[l.dev_sku] || 'Sin desarrollo'} · hace {dias(l.creado)}d</span></div>
                {wa(l.telefono, `Hola ${first(l.nombre)}, gracias por tu interés. ¿Te queda bien que te llame?`) && <a className="cotiz-mini" href={wa(l.telefono, `Hola ${first(l.nombre)}, gracias por tu interés.`)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>Escribir</a>}
              </div>
            ))}
          </section>
        </div>
      </main>

      {brief && (
        <div className="ck-brief-overlay" onClick={() => setBrief(null)}>
          <div className="ck-brief" onClick={e => e.stopPropagation()}>
            <div className="ck-brief-h">
              <b>⚡ Briefing IA · {first(brief.nombre)}</b>
              <button onClick={() => setBrief(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="ck-brief-body">
              {brief.loading ? <p className="fnote">Preparándote… la IA está leyendo el perfil y el inventario.</p>
                : brief.disabled ? <p className="fnote">{brief.texto} <a onClick={() => router.push('/conexiones')} style={{ color: 'var(--lime)', cursor: 'pointer' }}>Ir a Conexiones →</a></p>
                : <div className="ck-brief-text">{brief.texto}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
