'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { scoreLead, accionSugerida, diasSin } from '../../lib/leadscore';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const soloDig = s => String(s ?? '').replace(/[^0-9]/g, '');
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TEMP = { caliente: ['🔥', 'Caliente', 't-cal'], tibio: ['🌤️', 'Tibio', 't-tib'], frio: ['❄️', 'Frío', 't-fri'] };

function waLink(tel, texto) {
  const d = soloDig(tel); if (!d) return null;
  return 'https://wa.me/' + (d.length === 10 ? '52' : '') + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

export default function Seguimiento() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [units, setUnits] = useState([]);
  const [devs, setDevs] = useState([]);
  const [citas, setCitas] = useState([]);
  const [token, setToken] = useState(null);
  const [filtro, setFiltro] = useState('todos'); // todos | caliente | tibio | frio | atrasados

  // Modales
  const [red, setRed] = useState(null);   // { lead, texto, busy, err }
  const [brief, setBrief] = useState(null); // { titulo, texto, busy }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setToken(session.access_token);
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const [l, u, d, c] = await Promise.all([
        supabase.from('leads').select('*').order('creado', { ascending: false }).limit(400),
        supabase.from('unidades').select('dev_sku,rec,precio').eq('estatus', 'Disponible'),
        supabase.from('desarrollos').select('sku,nombre,direccion,alcaldia'),
        supabase.from('citas').select('*').gte('fecha', hoy()).order('fecha').order('hora').limit(60),
      ]);
      setLeads(l.data || []); setUnits(u.data || []); setDevs(d.data || []);
      setCitas((c.data || []).filter(x => !/cancel/i.test(x.estatus || '')));
    })();
  }, [router]);

  const devById = useMemo(() => Object.fromEntries(devs.map(d => [d.sku, d])), [devs]);
  const scored = useMemo(() => {
    if (!leads) return [];
    const ctx = { devById, units, ahora: Date.now() };
    return leads.map(l => ({ lead: l, sc: scoreLead(l, ctx) }))
      .filter(x => !/descart|perdid|cerrad/i.test(x.lead.estatus || ''))
      .sort((a, b) => b.sc.score - a.sc.score);
  }, [leads, devById, units]);

  const vista = useMemo(() => {
    if (filtro === 'todos') return scored;
    if (filtro === 'atrasados') return scored.filter(x => (x.sc.dias ?? 0) >= 7);
    return scored.filter(x => x.sc.temp === filtro);
  }, [scored, filtro]);

  const conteo = useMemo(() => {
    const c = { caliente: 0, tibio: 0, frio: 0, atrasados: 0 };
    scored.forEach(x => { c[x.sc.temp]++; if ((x.sc.dias ?? 0) >= 7) c.atrasados++; });
    return c;
  }, [scored]);

  async function redactar(lead) {
    setRed({ lead, texto: '', busy: true, err: null });
    try {
      const r = await fetch('/api/ia/redactar', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const j = await r.json();
      if (j.disabled) setRed({ lead, texto: '', busy: false, err: j.mensaje });
      else if (j.error) setRed({ lead, texto: '', busy: false, err: j.error });
      else setRed({ lead, texto: j.mensaje || '', busy: false, err: null });
    } catch { setRed({ lead, texto: '', busy: false, err: 'No se pudo generar. Intenta de nuevo.' }); }
  }
  async function verBriefing(cita) {
    setBrief({ titulo: cita.nombre || 'Cliente', texto: '', busy: true });
    try {
      const r = await fetch('/api/ia/briefing', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ citaId: cita.id }),
      });
      const j = await r.json();
      setBrief({ titulo: cita.nombre || 'Cliente', texto: j.briefing || j.error || 'No se pudo generar.', busy: false, disabled: j.disabled });
    } catch { setBrief({ titulo: cita.nombre || 'Cliente', texto: 'No se pudo generar el briefing.', busy: false }); }
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setRed(null); setBrief(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!me) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/seguimiento" logo="Seguimiento" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Seguimiento inteligente</h1>
          <p>Tus clientes priorizados por qué tan trabajables están hoy. Empieza por los de arriba: la IA te redacta el WhatsApp y te prepara para cada cita.</p>
        </div>

        {/* Citas próximas con briefing */}
        {citas.length > 0 && (
          <section className="sg-citas">
            <h2>📅 Tus próximas citas</h2>
            <div className="sg-citas-row">
              {citas.slice(0, 8).map(c => (
                <div className="sg-cita" key={c.id}>
                  <div className="sg-cita-fecha"><b>{new Date(c.fecha + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</b><span>{(c.hora || '').slice(0, 5)}</span></div>
                  <div className="sg-cita-info">
                    <b>{c.nombre || 'Cliente'}</b>
                    <span>{(devById[c.dev_sku] ? tituloDev(devById[c.dev_sku]) : null) || c.dev_sku || '—'} · {c.modalidad || 'Presencial'}</span>
                  </div>
                  <button className="btn ghost sm" onClick={() => verBriefing(c)}>🧠 Briefing</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filtros */}
        <div className="sg-filtros">
          {[['todos', `Todos · ${scored.length}`], ['caliente', `🔥 Calientes · ${conteo.caliente}`], ['tibio', `🌤️ Tibios · ${conteo.tibio}`], ['frio', `❄️ Fríos · ${conteo.frio}`], ['atrasados', `⏰ Sin contacto 7d+ · ${conteo.atrasados}`]].map(([k, l]) => (
            <button key={k} className={'sg-fchip' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>

        {/* Lista priorizada */}
        {vista.length === 0 ? <p className="fnote">No hay clientes en este filtro.</p> : (
          <div className="sg-list">
            {vista.map(({ lead, sc }) => {
              const [ic, lbl, cls] = TEMP[sc.temp];
              const presu = lead.presupuesto_max || lead.presupuesto;
              return (
                <div className="sg-card" key={lead.id}>
                  <div className={'sg-score ' + cls}><b>{sc.score}</b><span>{ic}</span></div>
                  <div className="sg-main">
                    <div className="sg-h">
                      <b>{lead.nombre || 'Sin nombre'}</b>
                      <span className={'sg-temp ' + cls}>{lbl}</span>
                      {sc.dias != null && <span className={'sg-dias' + ((sc.dias >= 7) ? ' alerta' : '')}>{sc.dias === 0 ? 'hoy' : `hace ${sc.dias}d`}</span>}
                    </div>
                    <div className="sg-meta">
                      {lead.dev_sku && <span>🏢 {devById[lead.dev_sku]?.nombre || lead.dev_sku}</span>}
                      {lead.rec_interes != null && <span>🛏️ {lead.rec_interes === 0 ? 'Loft' : lead.rec_interes + ' rec'}</span>}
                      {lead.zona_interes && <span>📍 {lead.zona_interes}</span>}
                      {presu && <span>💰 {MXN(presu)}</span>}
                      {lead.etapa && <span className="sg-etapa">{lead.etapa}</span>}
                    </div>
                    <div className="sg-accion">💡 {accionSugerida(lead, sc)}</div>
                    <div className="sg-factores">{sc.factores.slice(0, 3).map((f, i) => <span key={i}>{f.label}</span>)}</div>
                  </div>
                  <div className="sg-acts">
                    <button className="btn mag sm" onClick={() => redactar(lead)}>✍️ WhatsApp IA</button>
                    {waLink(lead.telefono) && <a className="btn ghost sm" href={waLink(lead.telefono, '')} target="_blank" rel="noopener">Abrir chat</a>}
                    <button className="btn ghost sm" onClick={() => router.push('/crm')}>Ver en CRM</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="fnote">El score pondera recencia, urgencia, presupuesto, forma de pago, perfil, etapa y si hay inventario que le calza. Se puede recalibrar con tus tasas de cierre reales más adelante.</p>
      </main>

      {/* Modal redactor */}
      {red && (
        <>
          <div className="drawer-bg" onClick={() => setRed(null)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Redactar WhatsApp" onClick={e => e.stopPropagation()}>
            <div className="dw-h"><div><span className="dw-tag">WhatsApp con IA</span><h2>{red.lead.nombre || 'Cliente'}</h2></div><button className="x" onClick={() => setRed(null)}>✕</button></div>
            {red.busy ? <div className="loading">Redactando el mensaje…</div> : red.err ? (
              <div className="msg err">{red.err}{/Conecta/.test(red.err) && <> <a onClick={() => router.push('/conexiones')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Ir a Conexiones</a></>}</div>
            ) : (
              <>
                <textarea className="sg-red-txt" value={red.texto} onChange={e => setRed({ ...red, texto: e.target.value })} rows={7} />
                <div className="cotiz-actions">
                  <button className="btn lim block" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(red.texto); }}>Copiar</button>
                  {waLink(red.lead.telefono, red.texto) && <a className="btn mag block" href={waLink(red.lead.telefono, red.texto)} target="_blank" rel="noopener">Enviar por WhatsApp</a>}
                  <button className="btn ghost block" onClick={() => redactar(red.lead)}>↻ Regenerar</button>
                </div>
                <p className="fnote">Revisa y ajusta antes de enviar. La IA usa el perfil del cliente y el desarrollo; no envía nada solo.</p>
              </>
            )}
          </aside>
        </>
      )}

      {/* Modal briefing */}
      {brief && (
        <>
          <div className="drawer-bg" onClick={() => setBrief(null)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Briefing pre-cita" onClick={e => e.stopPropagation()}>
            <div className="dw-h"><div><span className="dw-tag">Briefing pre-cita</span><h2>{brief.titulo}</h2></div><button className="x" onClick={() => setBrief(null)}>✕</button></div>
            {brief.busy ? <div className="loading">Preparando tu briefing…</div> : (
              <>
                {brief.disabled && <div className="msg err" style={{ marginBottom: '.6rem' }}>Conecta tu llave de IA en <a onClick={() => router.push('/conexiones')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Conexiones</a>.</div>}
                <pre className="sg-brief">{brief.texto}</pre>
              </>
            )}
          </aside>
        </>
      )}
    </>
  );
}
