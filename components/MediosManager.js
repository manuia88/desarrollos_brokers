'use client';
import { useEffect, useState } from 'react';
import { subirMedio, listarMedios, borrarMedio, TIPOS_MEDIO } from '../lib/medios';

export default function MediosManager({ dev, units = [], onClose, onChange }) {
  const [medios, setMedios] = useState(null);
  const [tipo, setTipo] = useState('render');
  const [file, setFile] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [unidad, setUnidad] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [k, setK] = useState(0);

  async function reload() { const d = await listarMedios(dev.sku); setMedios(d); if (onChange) onChange(d); }
  useEffect(() => { reload(); }, [dev.sku]);

  async function upload() {
    if (!file) { setMsg({ t: 'err', m: 'Elige un archivo.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await subirMedio({ file, dev_sku: dev.sku, unidad_sku: unidad || null, tipo, titulo: titulo || null });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setFile(null); setTitulo(''); setK(x => x + 1); setMsg({ t: 'ok', m: 'Medio subido.' });
    await reload();
  }
  async function eliminar(m) {
    setBusy(true);
    const { error } = await borrarMedio(m);
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    await reload();
  }

  const esPlano = tipo === 'plano' || tipo === 'planta';

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div><span className="dw-tag">Gestionar medios</span><h2>{dev.nombre}</h2></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        <div className="dw-sec">
          <h3>Subir</h3>
          <div className="dw-field"><label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS_MEDIO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {esPlano && units.length > 0 && (
            <div className="dw-field"><label>Unidad (opcional)</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value)}>
                <option value="">Todo el desarrollo</option>
                {units.map(u => <option key={u.sku} value={u.sku}>T{u.torre} · {u.num_depto}{u.prototipo ? ' · ' + u.prototipo : ''}</option>)}
              </select>
            </div>
          )}
          <div className="dw-field"><label>Título (opcional)</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Fachada, Roof garden…" /></div>
          <div className="dw-field"><label>Archivo (imagen)</label>
            <input key={k} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          <button className="btn mag sm" disabled={busy || !file} onClick={upload}>{busy ? 'Subiendo…' : 'Subir medio'}</button>
        </div>

        <div className="dw-sec">
          <h3>Medios ({medios ? medios.length : 0})</h3>
          {medios == null ? <p className="fnote">Cargando…</p> :
            medios.length === 0 ? <p className="fnote">Aún no hay medios. Sube portada, renders, fotos y planos — aparecen en la ficha al instante.</p> :
              <div className="med-grid">
                {medios.map(m => (
                  <div className="med-item" key={m.id}>
                    <img src={m.url} alt={m.titulo || m.tipo} loading="lazy" />
                    <div className="med-meta">
                      <span>{m.tipo}{m.unidad_sku ? ' · ' + m.unidad_sku : ''}</span>
                      <button className="med-del" disabled={busy} onClick={() => eliminar(m)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </aside>
    </>
  );
}
