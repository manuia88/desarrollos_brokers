'use client';
// Base de conocimiento del Asesor Digital: los directores cargan políticas, FAQ,
// amenidades a detalle y avance de obra. El agente lo consulta en los 3 canales.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { tituloDev } from '../../lib/nombre';
import Nav from '../../components/Nav';
import { EmptyState, ErrorCarga } from '../../components/ui';

export default function Conocimiento() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [items, setItems] = useState(null);
  const [devs, setDevs] = useState([]);
  const [errCarga, setErrCarga] = useState(false);
  const [form, setForm] = useState({ id: null, titulo: '', texto: '', dev_sku: '' });
  const [fDev, setFDev] = useState('');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');

  async function recargar() {
    const [c, d] = await Promise.all([
      supabase.from('conocimiento').select('*').order('actualizado', { ascending: false }).limit(500),
      supabase.from('desarrollos').select('sku,nombre,direccion').order('nombre'),
    ]);
    if (c.error) setErrCarga(true);
    setItems(c.data || []); setDevs(d.data || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      if (!['director', 'gerente', 'super_admin'].includes(prof?.rol)) { router.replace('/hoy'); return; }
      setMe({ id: session.user.id, ...(prof || {}) });
      await recargar();
    })();
  }, [router]);

  const devName = useMemo(() => Object.fromEntries(devs.map(d => [d.sku, tituloDev(d)])), [devs]);
  const visibles = useMemo(() => (items || []).filter(i => !fDev || i.dev_sku === fDev || (fDev === '__org__' && !i.dev_sku)), [items, fDev]);

  async function guardar() {
    if (!form.titulo.trim() || !form.texto.trim()) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/agente/conocimiento', {
      method: 'POST', headers: { Authorization: 'Bearer ' + session?.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: form.id, titulo: form.titulo, texto: form.texto, dev_sku: form.dev_sku || null }),
    }).then(x => x.json()).catch(() => ({ error: 'red' }));
    setBusy(false);
    if (r.error) { setAviso(r.error); }
    else { setAviso(r.trozos > 1 ? `Guardado en ${r.trozos} fragmentos.` : 'Guardado.'); setForm({ id: null, titulo: '', texto: '', dev_sku: form.dev_sku }); recargar(); }
    setTimeout(() => setAviso(''), 3500);
  }
  async function borrar(id) {
    if (!window.confirm('¿Borrar este fragmento?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/agente/conocimiento', { method: 'POST', headers: { Authorization: 'Bearer ' + session?.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'borrar', id }) });
    recargar();
  }
  function editar(i) { setForm({ id: i.id, titulo: i.titulo, texto: i.texto, dev_sku: i.dev_sku || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  if (items === null) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/conocimiento" logo="Conocimiento" />
      <main className="wrap">
        {errCarga && <ErrorCarga />}
        <div className="buscar-intro"><h1>Base de conocimiento</h1><p>Lo que tu Asesor Digital sabe además de precios: políticas de apartado y cancelación, amenidades a detalle, avance de obra, preguntas frecuentes. Aplica en WhatsApp, Telegram y el chat de tus fichas.</p></div>

        <section className="ck-form">
          <h2>{form.id ? 'Editar fragmento' : 'Agregar conocimiento'}</h2>
          <label className="lbl">Tema / pregunta</label>
          <input className="inp" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej. Política de apartado · ¿Qué incluye el mantenimiento?" />
          <label className="lbl">Respuesta / información</label>
          <textarea className="inp" rows={5} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} placeholder="Escribe con detalle. Si pegas un texto largo (un brochure, una sección), se divide solo en fragmentos." />
          <label className="lbl">¿De qué desarrollo?</label>
          <select className="inp" value={form.dev_sku} onChange={e => setForm(f => ({ ...f, dev_sku: e.target.value }))}>
            <option value="">Toda la inmobiliaria (aplica a todos)</option>
            {devs.map(d => <option key={d.sku} value={d.sku}>{tituloDev(d)}</option>)}
          </select>
          <div className="ck-actions">
            <button className="btn lim" disabled={busy || !form.titulo.trim() || !form.texto.trim()} onClick={guardar}>{busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar'}</button>
            {form.id && <button className="btn ghost" onClick={() => setForm({ id: null, titulo: '', texto: '', dev_sku: '' })}>Cancelar</button>}
            {aviso && <em className="cv-aviso">{aviso}</em>}
          </div>
        </section>

        <div className="ck-filtro">
          <span className={'chip sm' + (!fDev ? ' on' : '')} onClick={() => setFDev('')}>Todo</span>
          <span className={'chip sm' + (fDev === '__org__' ? ' on' : '')} onClick={() => setFDev('__org__')}>Toda la inmobiliaria</span>
          {[...new Set((items || []).map(i => i.dev_sku).filter(Boolean))].map(sku => (
            <span key={sku} className={'chip sm' + (fDev === sku ? ' on' : '')} onClick={() => setFDev(sku)}>{devName[sku] || sku}</span>
          ))}
        </div>

        {visibles.length === 0 ? (
          <EmptyState icon="📚" title="Aún sin conocimiento cargado">Empieza con las 3 preguntas que más te hacen tus clientes. Cada respuesta que agregues, tu Asesor Digital la usará al instante.</EmptyState>
        ) : (
          <div className="ck-list">
            {visibles.map(i => (
              <div className="ck-item" key={i.id}>
                <div className="ck-item-main">
                  <b>{i.titulo}</b>
                  <span className="ck-scope">{i.dev_sku ? (devName[i.dev_sku] || i.dev_sku) : '🏢 Toda la inmobiliaria'}</span>
                  <p>{i.texto}</p>
                </div>
                <div className="ck-item-acc">
                  <button className="btn ghost sm" onClick={() => editar(i)}>✏️</button>
                  <button className="btn ghost sm" onClick={() => borrar(i.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
