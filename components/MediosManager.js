'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  subirMedio, agregarPorUrl, listarMedios, borrarMedio, hacerPortada,
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [k, setK] = useState(0);

  const prototipos = useMemo(() => [...new Set(units.map(u => u.prototipo).filter(Boolean))].sort(), [units]);
  const conArea = TIPOS_CON_AREA.includes(tipo);
  const conProto = TIPOS_CON_PROTO.includes(tipo);

  async function reload() { const d = await listarMedios(dev.sku); setMedios(d); if (onChange) onChange(d); }
  useEffect(() => { reload(); }, [dev.sku]);

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

  async function portada(m) { setBusy(true); await hacerPortada(dev.sku, m.id); setBusy(false); await reload(); }
  async function eliminar(m) { setBusy(true); const { error } = await borrarMedio(m); setBusy(false); if (error) { setMsg({ t: 'err', m: error.message }); return; } await reload(); }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer rc" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div><span className="dw-tag">Gestionar medios</span><h2>{dev.nombre}</h2></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

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
        </div>

        <div className="dw-sec">
          <h3>Medios ({medios ? medios.length : 0})</h3>
          {medios == null ? <p className="fnote">Cargando…</p> :
            medios.length === 0 ? <p className="fnote">Aún no hay medios. Sube portada, renders, fotos y planos — aparecen en la ficha al instante.</p> :
              TIPOS_MEDIO.map(([tv, tl]) => {
                const items = medios.filter(m => m.tipo === tv);
                if (!items.length) return null;
                return (
                  <div className="med-group" key={tv}>
                    <div className="med-group-h">{tl} · {items.length}</div>
                    <div className="med-grid">
                      {items.map(m => (
                        <div className="med-item" key={m.id}>
                          <img src={m.url} alt={m.titulo || m.area || m.tipo} loading="lazy" />
                          <div className="med-meta"><span>{m.area || m.prototipo || m.titulo || '—'}</span></div>
                          <div className="med-actions">
                            {tv !== 'portada' && <button title="Hacer portada" disabled={busy} onClick={() => portada(m)}>★</button>}
                            <button title="Borrar" className="med-del" disabled={busy} onClick={() => eliminar(m)}>✕</button>
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
