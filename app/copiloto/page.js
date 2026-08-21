'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const EJEMPLOS = [
  '¿Qué tengo en Benito Juárez, 2 recámaras, menos de $4M que acepte Infonavit?',
  '¿Cuál da la mejor comisión con entrega inmediata?',
  'Cliente con $3M para enganche y quiere roof garden, ¿qué le conviene?',
];

export default function Copiloto() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const autoRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
    })();
  }, [router]);

  // Pregunta pre-armada por URL (?q=…), p. ej. desde ⌘K o "¿Qué le queda?" — se envía sola.
  useEffect(() => {
    if (!me || autoRef.current) return;
    let q = '';
    try { q = new URLSearchParams(window.location.search).get('q') || ''; } catch { /* noop */ }
    if (q.trim()) { autoRef.current = true; enviar(null, q.trim()); }
  }, [me]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e, textoOverride) {
    if (e) e.preventDefault();
    const q = String(textoOverride ?? input).trim();
    if (!q || busy) return;
    const nuevo = [...chat, { role: 'user', content: q }];
    setChat(nuevo); setInput(''); setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/ia/copiloto', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({ pregunta: q, historial: chat }),
      });
      const j = await r.json();
      setChat([...nuevo, { role: 'assistant', content: j.answer || j.error || 'No pude responder.' }]);
    } catch {
      setChat([...nuevo, { role: 'assistant', content: 'No pude responder ahorita, intenta de nuevo.' }]);
    }
    setBusy(false);
  }

  if (!me) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/copiloto" logo="Copiloto" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Copiloto del broker</h1>
          <p>Pregúntale a tu inventario en vivo en lenguaje natural y te dice qué le sirve a tu cliente — por zona, presupuesto, recámaras, crédito o comisión.</p>
        </div>
        <div className="cop-chat">
          <div className="cop-body">
            {chat.length === 0 && (
              <div className="cop-ej">
                <span className="cop-ej-lbl">Prueba con:</span>
                {EJEMPLOS.map((e, i) => <button key={i} type="button" onClick={() => setInput(e)}>{e}</button>)}
              </div>
            )}
            {chat.map((m, i) => <div key={i} className={'cop-msg ' + m.role}>{m.content}</div>)}
            {busy && <div className="cop-msg assistant cop-typing">Pensando…</div>}
          </div>
          <form className="cop-in" onSubmit={enviar}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="¿Qué le sirve a tu cliente?" />
            <button className="btn mag" disabled={busy || !input.trim()}>Enviar</button>
          </form>
        </div>
        <p className="fnote">Responde solo con tu inventario real. Si el asistente no está activado, pídele a tu administrador conectar la API de IA en Vercel.</p>
      </main>
    </>
  );
}
