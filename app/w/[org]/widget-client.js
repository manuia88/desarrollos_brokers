'use client';
// Chat embebible: habla con /api/agente/web usando un cid persistente del navegador.
import { useEffect, useRef, useState } from 'react';

export default function ChatWidget({ org, nombre, activo }) {
  const [chat, setChat] = useState([]);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat]);

  async function enviar() {
    const q = txt.trim();
    if (!q || busy || !activo) return;
    setTxt(''); setBusy(true);
    setChat(c => [...c, { role: 'user', content: q }, { role: 'assistant', content: '…', pending: true }]);
    let cid = '';
    try { cid = localStorage.getItem('qc_cid') || crypto.randomUUID(); localStorage.setItem('qc_cid', cid); } catch { cid = 'anon-' + org.slice(0, 8); }
    const r = await fetch('/api/agente/web', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org, texto: q, cid }) }).then(x => x.json()).catch(() => ({}));
    setChat(c => [...c.slice(0, -1), { role: 'assistant', content: r.answer || 'No pude responder, intenta de nuevo.' }]);
    setBusy(false);
  }

  return (
    <div className="wg">
      <header className="wg-h"><b>💬 {nombre || 'Asistente'}</b><span style={activo ? undefined : { color: 'var(--dim)' }}>{activo ? 'en línea' : 'no disponible'}</span></header>
      <div className="wg-hilo">
        {chat.length === 0 && <div className="wg-hola">{activo ? '¡Hola! 👋 Cuéntame qué buscas — zona, recámaras, presupuesto — y te muestro opciones. También te puedo agendar una visita.' : 'El asistente no está disponible por ahora. Vuelve más tarde. 🙂'}</div>}
        {chat.map((m, i) => <div key={i} className={'wg-msg ' + (m.role === 'user' ? 'yo' : 'bot')}>{m.content}</div>)}
        <div ref={endRef} />
      </div>
      <div className="wg-in">
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} placeholder={activo ? 'Escribe tu mensaje…' : 'No disponible'} disabled={!activo} aria-label="Mensaje" />
        <button onClick={enviar} disabled={busy || !activo} aria-label="Enviar">➤</button>
      </div>
    </div>
  );
}
