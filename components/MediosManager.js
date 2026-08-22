'use client';
import { tituloDev } from '../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  subirMedio, agregarPorUrl, listarMedios, borrarMedio, hacerPortada, actualizarMedio, etiquetaMedio,
  TIPOS_MEDIO, AREAS, TIPOS_CON_AREA, TIPOS_CON_PROTO,
} from '../lib/medios';

export default function MediosManager({ dev, units = [], onClose, onChange }) {
  const [medios, setMedios] = useState(null);
  const [tipo, setTipo] = useState('render');
  const [area, setArea] = useState(AREAS[0]);
  const [proto, setProto] = useState('');
  const [titulo, setTitulo] = useState('');
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState('');
  const [drive, setDrive] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [k, setK] = useState(0);
  const [sesion, setSesion] = useState(undefined); // undefined=cargando, null=sin sesión, obj=ok
  const [gmail, setGmail] = useState(null);         // correo de Google conectado (o null)

  const prototipos = useMemo(() => [...new Set(units.map(u => u.prototipo).filter(Boolean))].sort(), [units]);
  const conArea = TIPOS_CON_AREA.includes(tipo);
  const conProto = TIPOS_CON_PROTO.includes(tipo);

  async function reload() { const d = await listarMedios(dev.sku); setMedios(d); if (onChange) onChange(d); }
  useEffect(() => { reload(); }, [dev.sku]);

  // Estado de sesión y de Google (para poder reautenticarse desde aquí mismo).
  async function checarSesion() {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) { try { const r = await supabase.auth.refreshSession(); session = r.data.session; } catch { /* noop */ } }
    setSesion(session || null);
    if (session) {
      const { data: prof } = await supabase.from('profiles').select('google_email').eq('id', session.user.id).maybeSingle();
      setGmail(prof?.google_email || null);
    }
    return session || null;
  }
  useEffect(() => { checarSesion(); }, []);

  function iniciarSesion() { window.location.href = '/login?next=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/'); }
  async function conectarDrive() {
    const s = await checarSesion();
    if (!s) { iniciarSesion(); return; }
    // El token va en el header (no en la URL); el servidor devuelve un nonce de un solo uso.
    const r = await fetch('/api/google/connect', { method: 'POST', headers: { authorization: 'Bearer ' + s.access_token } });
    const j = await r.json().catch(() => ({}));
    if (j.n) window.location.href = '/api/google/connect?n=' + j.n;
  }

  const meta = () => ({
    dev_sku: dev.sku, tipo,
    area: conArea ? area : null,
    prototipo: conProto ? (proto || null) : null,
    titulo: titulo || null,
  });

  async function subir() {
    if (!files.length) { setMsg({ t: 'err', m: 'Elige uno o varios archivos.' }); return; }
    setBusy(true);
    const base = (medios || []).length;
    for (let i = 0; i < files.length; i++) {
      setMsg({ t: 'ok', m: `Subiendo ${i + 1} de ${files.length}…` });
      const { error } = await subirMedio({ file: files[i], orden: base + i, ...meta() });
      if (error) { setMsg({ t: 'err', m: `Error en ${files[i].name}: ${error.message}` }); setBusy(false); return; }
    }
    setFiles([]); setK(x => x + 1); setBusy(false);
    setMsg({ t: 'ok', m: `${files.length} archivo(s) subido(s).` });
    await reload();
  }

  async function porUrl() {
    if (!url.trim()) { setMsg({ t: 'err', m: 'Pega una URL de imagen.' }); return; }
    setBusy(true);
    const { error } = await agregarPorUrl({ url: url.trim(), orden: (medios || []).length, ...meta() });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setUrl(''); setMsg({ t: 'ok', m: 'Imagen agregada por URL.' });
    await reload();
  }

  async function importarDrive() {
    if (!drive.trim()) { setMsg({ t: 'err', m: 'Pega el link de la carpeta de Drive.' }); return; }
    setBusy(true); setMsg({ t: 'ok', m: 'Leyendo la carpeta de Drive e importando…' });
    try {
      // Refresca la sesión ANTES de llamar (evita el "no autenticado" por token vencido).
      const s = await checarSesion();
      if (!s) { setMsg({ t: 'err', m: 'Tu sesión expiró. Inicia sesión de nuevo para importar.' }); setBusy(false); return; }
      const r = await fetch('/api/medios/drive-import', {
        method: 'POST', headers: { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dev_sku: dev.sku, folder: drive.trim(), tipo, area: conArea ? area : null }),
      });
      const j = await r.json();
      if (j.error) {
        if (/autenticad/i.test(j.error)) { setSesion(null); setMsg({ t: 'err', m: 'Tu sesión expiró. Inicia sesión de nuevo (botón de arriba) y reintenta.' }); }
        else if (/google|drive|conecta/i.test(j.error)) { setGmail(null); setMsg({ t: 'err', m: j.error }); }
        else setMsg({ t: 'err', m: j.error });
      } else {
        const desg = Object.entries(j.porTipo || {}).map(([t, n]) => `${n} ${t}`).join(', ');
        setMsg({ t: 'ok', m: `✓ ${j.importados} importadas${desg ? ' (' + desg + ')' : ''}${j.saltados ? ` · ${j.saltados} ya estaban` : ''}.${j.mas ? ` Quedan ${j.mas}, corre otra vez para traer más.` : ''}` });
        setDrive(''); setK(x => x + 1); await reload();
      }
    } catch (e) { setMsg({ t: 'err', m: String(e?.message || e) }); }
    setBusy(false);
  }

  async function portada(m) { setBusy(true); await hacerPortada(dev.sku, m.id); setBusy(false); await reload(); }
  async function eliminar(m) { setBusy(true); const { error } = await borrarMedio(m); setBusy(false); if (error) { setMsg({ t: 'err', m: error.message }); return; } await reload(); }
  // Re-etiquetar: cambia la categoría de una imagen (útil cuando el import no adivinó bien).
  async function recategorizar(m, nuevoTipo) {
    if (!nuevoTipo || nuevoTipo === m.tipo) return;
    setBusy(true);
    await actualizarMedio(m.id, {
      tipo: nuevoTipo,
      area: TIPOS_CON_AREA.includes(nuevoTipo) ? (m.area || null) : null,
      prototipo: TIPOS_CON_PROTO.includes(nuevoTipo) ? (m.prototipo || null) : null,
    });
    setBusy(false); await reload();
  }
  // Reordena una imagen dentro de su grupo — persiste 'orden' (así se ven en la ficha).
  async function mover(items, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = items.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setBusy(true);
    for (let k = 0; k < arr.length; k++) {
      if ((arr[k].orden ?? -1) !== k) await actualizarMedio(arr[k].id, { orden: k });
    }
    setBusy(false); await reload();
  }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer rc" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div><span className="dw-tag">Gestionar medios</span><h2>{tituloDev(dev)}</h2></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        {sesion === null && (
          <div className="msg err" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
            <span>Tu sesión expiró. Vuelve a iniciar sesión para subir o importar.</span>
            <button className="btn mag sm" type="button" onClick={iniciarSesion}>Iniciar sesión</button>
          </div>
        )}

        <div className="dw-sec">
          <h3>Subir</h3>
          <div className="dw-row">
            <div className="dw-field"><label>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_MEDIO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {conArea && (
              <div className="dw-field"><label>Ambiente</label>
                <select value={area} onChange={e => setArea(e.target.value)}>
                  {AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            )}
            {conProto && (
              <div className="dw-field"><label>Prototipo</label>
                <select value={proto} onChange={e => setProto(e.target.value)}>
                  <option value="">Todo el desarrollo</option>
                  {prototipos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="dw-field"><label>Título (opcional)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Fachada norte, Cocina integral…" /></div>
          <div className="dw-field"><label>Archivos (puedes elegir varios)</label>
            <input key={k} type="file" accept="image/*" multiple onChange={e => setFiles([...(e.target.files || [])])} /></div>
          {files.length > 0 && <p className="fnote" style={{ marginTop: 0 }}>{files.length} archivo(s) listos. Se comprimen automáticamente al subir.</p>}
          <button className="btn mag sm" disabled={busy || !files.length} onClick={subir}>{busy ? 'Subiendo…' : `Subir ${files.length || ''} medio(s)`}</button>

          <div className="med-or">o agrega por URL (brochure, Drive, sitio oficial)</div>
          <div className="dw-field">
            <div className="med-url"><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/render.jpg" />
              <button className="btn ghost sm" disabled={busy || !url.trim()} onClick={porUrl}>Agregar</button></div>
          </div>
          <p className="fnote" style={{ marginTop: 0 }}>El tipo, ambiente y prototipo de arriba se aplican tanto a la subida como a la URL.</p>

          <div className="med-or">o importa una carpeta completa de Google Drive</div>

          {/* Paso 1: conectar Google Drive — banner visible con estado y CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap', padding: '.7rem .8rem', borderRadius: 12, margin: '0 0 .6rem', border: '1px solid ' + (gmail ? 'rgba(198,255,58,.35)' : 'var(--mag)'), background: gmail ? 'rgba(198,255,58,.06)' : 'rgba(255,30,122,.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 0 }}>
              <b style={{ fontSize: '.9rem', color: gmail ? 'var(--lime)' : 'var(--ink)' }}>
                {sesion === undefined ? 'Verificando conexión…' : gmail ? '✓ Google Drive conectado' : '① Conecta tu Google Drive'}
              </b>
              <span className="fnote" style={{ margin: 0 }}>
                {gmail ? `Cuenta: ${gmail} · si el import falla por permisos, reconecta.` : 'Necesario para poder importar carpetas de Drive.'}
              </span>
            </div>
            <button className={'btn sm ' + (gmail ? 'ghost' : 'mag')} type="button" disabled={busy} onClick={conectarDrive} style={{ whiteSpace: 'nowrap' }}>
              {gmail ? 'Reconectar' : 'Conectar Google Drive'}
            </button>
          </div>

          {/* Paso 2: pegar el link de la carpeta e importar */}
          <div className="dw-field">
            <div className="med-url"><input value={drive} onChange={e => setDrive(e.target.value)} placeholder="② Pega aquí el link de la carpeta de Drive…" />
              <button className="btn lim sm" disabled={busy || !drive.trim()} onClick={importarDrive}>Importar</button></div>
          </div>
          <p className="fnote" style={{ marginTop: 0 }}>Trae todas las imágenes de la carpeta (y subcarpetas) y las <b>re-hospeda</b> en tu portal. Si nombras las subcarpetas <i>Renders, Planos, Plantas, Amenidades, Brochure</i>, se clasifican solas; lo demás usa el tipo de arriba. La cuenta de Google que conectes debe <b>tener acceso</b> a esa carpeta (ser suya o estar compartida con ella).</p>
        </div>

        <div className="dw-sec">
          <h3>Medios ({medios ? medios.length : 0})</h3>
          {medios && medios.length > 0 && <p className="fnote" style={{ marginTop: 0 }}>Usa <b>← →</b> para ordenar cómo se ven, <b style={{ color: 'var(--lime)' }}>★</b> para elegir la portada, y el menú para cambiar su categoría.</p>}
          {medios == null ? <p className="fnote">Cargando…</p> :
            medios.length === 0 ? <p className="fnote">Aún no hay medios. Sube portada, renders, fotos y planos — aparecen en la ficha al instante.</p> :
              TIPOS_MEDIO.map(([tv, tl]) => {
                const items = medios.filter(m => m.tipo === tv);
                if (!items.length) return null;
                return (
                  <div className="med-group" key={tv}>
                    <div className="med-group-h">{tl} · {items.length}</div>
                    <div className="med-grid">
                      {items.map((m, i) => (
                        <div className="med-item" key={m.id}>
                          {tv === 'portada' && <span className="med-flag">★ Portada</span>}
                          <img src={m.url} alt={etiquetaMedio(m)} loading="lazy" />
                          <div className="med-meta" style={{ display: 'block', padding: '.35rem .4rem' }}>
                            <select value={m.tipo} disabled={busy} title="Cambiar categoría de esta imagen"
                              onChange={e => recategorizar(m, e.target.value)}
                              style={{ width: '100%', fontSize: '.72rem', padding: '3px 5px', background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer' }}>
                              {TIPOS_MEDIO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                          <div className="med-actions" style={{ justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', gap: '.05rem' }}>
                              <button title="Mover antes" disabled={busy || i === 0} onClick={() => mover(items, i, -1)}>←</button>
                              <button title="Mover después" disabled={busy || i === items.length - 1} onClick={() => mover(items, i, 1)}>→</button>
                            </span>
                            <span style={{ display: 'flex', gap: '.05rem' }}>
                              {tv !== 'portada' && <button title="Hacer portada" disabled={busy} onClick={() => portada(m)} style={{ color: 'var(--lime)', fontSize: '.95rem' }}>★</button>}
                              <button title="Borrar" className="med-del" disabled={busy} onClick={() => eliminar(m)}>✕</button>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
        </div>
      </aside>
    </>
  );
}
