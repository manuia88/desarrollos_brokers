'use client';
// Bandeja del Asesor Digital: conversaciones por canal, borradores por aprobar (modo
// sugerir), pausa humana, KPIs del bot y chat de prueba. Inspirada en la bandeja de
// 4 paneles de GHL, reducida a lo que este producto necesita.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { Kpi, EmptyState, ErrorCarga } from '../../components/ui';

const CANAL_IC = { whatsapp: '🟢', telegram: '✈️', web: '🌐' };
const hace = ts => { if (!ts) return ''; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return 'ahora'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; };

export default function Conversaciones() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [convs, setConvs] = useState(null);
  const [sel, setSel] = useState(null);           // conversación seleccionada
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [stats, setStats] = useState(null);
  const [modo, setModo] = useState('auto');
  const [tab, setTab] = useState('bandeja');      // bandeja | prueba
  const [prueba, setPrueba] = useState([]);       // chat sandbox
  const [pTexto, setPTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [errCarga, setErrCarga] = useState(false);
  const [aviso, setAviso] = useState('');
  const endRef = useRef(null);

  async function api(body) {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/agente/panel', { method: 'POST', headers: { Authorization: 'Bearer ' + session?.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json().catch(() => ({}));
  }

  async function recargar() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const [c, mHoy, cBot, cuota] = await Promise.all([
      supabase.from('agente_conversaciones').select('*').order('actualizado', { ascending: false }).limit(200),
      supabase.from('wa_mensajes').select('telefono,rol,estado').gte('creado', hoy.toISOString()).limit(2000),
      supabase.from('citas').select('id').eq('origen', 'bot').gte('creado', mes.toISOString()),
      supabase.from('ia_cuota_dia').select('dia,usados,tokens_in,tokens_out').gte('dia', mes.toISOString().slice(0, 10)),
    ]);
    if (c.error) setErrCarga(true);
    setConvs(c.data || []);
    const dia = mHoy.data || [];
    const tokens = (cuota.data || []).reduce((s, x) => s + (x.tokens_in || 0) + (x.tokens_out || 0), 0);
    setStats({
      hoy: dia.filter(m => m.estado !== 'descartado').length,
      clientes: new Set(dia.filter(m => m.rol === 'cliente').map(m => m.telefono)).size,
      borradores: dia.filter(m => m.estado === 'borrador').length,
      citasBot: (cBot.data || []).length,
      costo: (tokens / 1e6 * 60).toFixed(0),   // aprox MXN: ~$3 USD/M tokens haiku round trip * FX
    });
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      if (prof?.org_id) {
        const { data: o } = await supabase.from('orgs').select('agente_modo').eq('id', prof.org_id).maybeSingle();
        if (o) setModo(o.agente_modo || 'auto');
      }
      await recargar();
    })();
  }, [router]);

  async function abrir(c) {
    setSel(c); setMsgs([]);
    const { data } = await supabase.from('wa_mensajes').select('*')
      .eq('org_id', c.org_id).eq('canal', c.canal).eq('telefono', c.contacto)
      .neq('estado', 'descartado').order('creado', { ascending: true }).limit(200);
    setMsgs(data || []);
    if (c.no_leidos > 0) { api({ accion: 'leido', conv_id: c.id }); setConvs(cs => cs.map(x => x.id === c.id ? { ...x, no_leidos: 0 } : x)); }
    setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 60);
  }

  async function accion(body, msj) {
    setBusy(true);
    const r = await api(body);
    setBusy(false);
    setAviso(r.error || msj || ''); setTimeout(() => setAviso(''), 3500);
    await recargar();
    if (sel) { const c = (await supabase.from('agente_conversaciones').select('*').eq('id', sel.id).maybeSingle()).data; if (c) await abrir(c); }
  }

  async function enviar() {
    if (!texto.trim() || !sel) return;
    const t = texto; setTexto('');
    await accion({ accion: 'enviar', conv_id: sel.id, texto: t }, 'Enviado. El bot queda en pausa 1 h.');
  }

  async function probar() {
    if (!pTexto.trim()) return;
    const t = pTexto.trim(); setPTexto('');
    const next = [...prueba, { role: 'user', content: t }];
    setPrueba([...next, { role: 'assistant', content: '…', pending: true }]);
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/agente/prueba', { method: 'POST', headers: { Authorization: 'Bearer ' + session?.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: t, historial: next.slice(-8) }) }).then(x => x.json()).catch(() => ({}));
    setPrueba([...next, { role: 'assistant', content: r.answer || 'Sin respuesta', herramientas: r.herramientas }]);
  }

  const borradores = useMemo(() => msgs.filter(m => m.estado === 'borrador'), [msgs]);
  const pausada = sel && sel.estado === 'pausado' && (!sel.pausado_hasta || new Date(sel.pausado_hasta) > new Date());
  const esGestor = ['director', 'gerente', 'super_admin'].includes(me?.rol);

  if (convs === null) return <div className="loading">Cargando conversaciones…</div>;

  return (
    <>
      <Nav me={me} current="/conversaciones" logo="Conversaciones" />
      <main className="wrap">
        {errCarga && <ErrorCarga />}
        <div className="buscar-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '.6rem' }}>
          <div><h1>Asesor Digital</h1><p>Todo lo que tu asistente habla con clientes, en un solo lugar. Tú mandas: pausa, corrige o toma la conversación.</p></div>
          <div className="cv-modo">
            <span className="cv-modo-lbl">Modo:</span>
            {['off', 'sugerir', 'auto'].map(m => (
              <span key={m} className={'chip sm' + (modo === m ? ' on' : '')}
                title={m === 'off' ? 'El bot no contesta' : m === 'sugerir' ? 'El bot redacta y tú apruebas' : 'El bot contesta solo'}
                onClick={esGestor ? async () => { setModo(m); await api({ accion: 'modo', modo: m }); } : undefined}>
                {m === 'off' ? '⏸ Apagado' : m === 'sugerir' ? '✍️ Sugerir' : '🤖 Auto'}
              </span>
            ))}
          </div>
        </div>

        {stats && (
          <div className="mgrid" style={{ marginBottom: '1rem' }}>
            <Kpi value={stats.hoy} label="Mensajes hoy" />
            <Kpi value={stats.clientes} label="Clientes únicos hoy" />
            <Kpi value={stats.borradores} label="Borradores por aprobar" accent={stats.borradores > 0} />
            <Kpi value={stats.citasBot} label="Citas del bot (mes)" />
            <Kpi value={'~$' + stats.costo} label="IA gastada (mes, MXN)" />
          </div>
        )}

        <div className="cv-tabs">
          <span className={'chip' + (tab === 'bandeja' ? ' on' : '')} onClick={() => setTab('bandeja')}>📥 Bandeja</span>
          <span className={'chip' + (tab === 'prueba' ? ' on' : '')} onClick={() => setTab('prueba')}>🧪 Probar asistente</span>
          {aviso && <em className="cv-aviso">{aviso}</em>}
        </div>

        {tab === 'prueba' ? (
          <div className="cv-prueba">
            <div className="cv-hilo">
              {prueba.length === 0 && <EmptyState icon="🧪" title="Habla con tu asistente">Pruébalo como si fueras un cliente: "busco depa de 2 recámaras por 3 millones". Aquí no se guarda nada ni se agenda de verdad.</EmptyState>}
              {prueba.map((m, i) => (
                <div key={i} className={'cv-msg ' + (m.role === 'user' ? 'cliente' : 'agente')}>
                  <p>{m.content}</p>
                  {m.herramientas?.length > 0 && <em className="cv-tools">🔧 {m.herramientas.join(', ')}</em>}
                </div>
              ))}
            </div>
            <div className="cv-composer">
              <input value={pTexto} onChange={e => setPTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && probar()} placeholder="Escríbele como cliente…" />
              <button className="btn lim" onClick={probar}>Enviar</button>
            </div>
          </div>
        ) : convs.length === 0 ? (
          <EmptyState icon="💬" title="Aún sin conversaciones">Cuando un cliente escriba a tu WhatsApp o Telegram conectado, aparecerá aquí. Conecta tus canales en Conexiones y prueba el asistente en la pestaña 🧪.</EmptyState>
        ) : (
          <div className="cv-grid">
            <aside className="cv-lista">
              {convs.map(c => (
                <div key={c.id} className={'cv-item' + (sel?.id === c.id ? ' on' : '')} onClick={() => abrir(c)}>
                  <span className="cv-canal">{CANAL_IC[c.canal] || '💬'}</span>
                  <div className="cv-item-main">
                    <b>{c.contacto}</b>
                    <span>{c.ultimo_rol === 'cliente' ? '' : c.ultimo_rol === 'asesor' ? 'Tú: ' : '🤖 '}{c.ultimo || ''}</span>
                  </div>
                  <div className="cv-item-meta">
                    <em>{hace(c.actualizado)}</em>
                    {c.estado === 'pausado' && <span className="cv-tag-pausa">⏸</span>}
                    {c.no_leidos > 0 && <span className="sb-badge">{c.no_leidos}</span>}
                  </div>
                </div>
              ))}
            </aside>

            {sel ? (
              <section className="cv-panel">
                <header className="cv-head">
                  <div><b>{CANAL_IC[sel.canal]} {sel.contacto}</b>
                    {sel.lead_id && <a className="cv-lead" onClick={() => router.push('/crm')}>ver en CRM →</a>}
                  </div>
                  <div className="cv-head-acc">
                    {pausada
                      ? <button className="btn ghost sm" disabled={busy} onClick={() => accion({ accion: 'reanudar', conv_id: sel.id }, 'Bot reactivado.')}>▶ Reactivar bot</button>
                      : <>
                        <button className="btn ghost sm" disabled={busy} onClick={() => accion({ accion: 'pausar', conv_id: sel.id, horas: 1 }, 'Bot en pausa 1 h.')}>⏸ 1h</button>
                        <button className="btn ghost sm" disabled={busy} onClick={() => accion({ accion: 'pausar', conv_id: sel.id }, 'Bot en pausa hasta que lo reactives.')}>⏸ Indefinida</button>
                      </>}
                  </div>
                </header>
                {pausada && <div className="cv-banner-pausa">⏸ El bot está en pausa en esta conversación — no contestará hasta que lo reactives{sel.pausado_hasta ? ` (o a las ${new Date(sel.pausado_hasta).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})` : ''}.</div>}
                <div className="cv-hilo">
                  {msgs.map(m => (
                    <div key={m.id} className={'cv-msg ' + (m.rol === 'cliente' ? 'cliente' : m.rol === 'asesor' ? 'asesor' : 'agente') + (m.estado === 'borrador' ? ' borrador' : '')}>
                      <p>{m.texto}</p>
                      <em>{m.rol === 'asesor' ? 'tú' : m.rol}{m.handoff ? ' · 🔔 pidió humano' : ''} · {new Date(m.creado).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</em>
                      {m.estado === 'borrador' && (
                        <div className="cv-borrador-acc">
                          <button className="btn lim sm" disabled={busy} onClick={() => accion({ accion: 'aprobar', msg_id: m.id }, 'Enviado.')}>✓ Enviar</button>
                          <button className="btn ghost sm" disabled={busy} onClick={() => { const t = window.prompt('Edita la respuesta:', m.texto); if (t?.trim()) accion({ accion: 'aprobar', msg_id: m.id, texto: t.trim() }, 'Enviado (editado).'); }}>✏️ Editar</button>
                          <button className="btn ghost sm" disabled={busy} onClick={() => accion({ accion: 'descartar', msg_id: m.id }, 'Descartado.')}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <div className="cv-composer">
                  <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} placeholder="Responder como tú (pausa al bot 1 h)…" />
                  <button className="btn lim" disabled={busy} onClick={enviar}>Enviar</button>
                </div>
              </section>
            ) : (
              <section className="cv-panel cv-vacio"><EmptyState icon="👈" title="Elige una conversación">{borradores.length ? '' : 'Las que tienen número magenta traen mensajes sin leer; ⏸ significa que el bot está en pausa.'}</EmptyState></section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
