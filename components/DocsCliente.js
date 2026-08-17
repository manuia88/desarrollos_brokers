'use client';
import { useEffect, useState } from 'react';
import { subirDocumento, listarDocumentos, abrirDocumento } from '../lib/docs';

const TIPOS = ['INE', 'CURP', 'Comprobante de domicilio', 'Constancia de situación fiscal', 'Comprobante de ingresos', 'Precalificación de crédito', 'Otro'];

export default function DocsCliente({ lead }) {
  const [docs, setDocs] = useState(null);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [k, setK] = useState(0);

  async function reload() { setDocs(await listarDocumentos({ ambito: 'cliente', lead_id: lead.id })); }
  useEffect(() => { reload(); }, [lead.id]);

  async function upload() {
    if (!file) { setMsg({ t: 'err', m: 'Elige un archivo.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await subirDocumento({ file, ambito: 'cliente', org_id: lead.org_id, lead_id: lead.id, tipo });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setFile(null); setK(x => x + 1); setMsg({ t: 'ok', m: 'Documento subido.' });
    await reload();
  }

  return (
    <div className="dw-sec">
      <h3>Documentos del cliente</h3>
      {msg && <div className={'msg ' + msg.t} style={{ marginBottom: '.5rem' }}>{msg.m}</div>}
      <div className="doc-up">
        <select value={tipo} onChange={e => setTipo(e.target.value)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
        <input key={k} type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" />
        <button className="btn mag sm" disabled={busy || !file} onClick={upload}>{busy ? 'Subiendo…' : 'Subir'}</button>
      </div>
      {docs == null ? <p className="fnote">Cargando…</p> :
        docs.length === 0 ? <p className="fnote">Sin documentos todavía.</p> :
          <ul className="doc-list">
            {docs.map(d => (
              <li key={d.id}>
                <button className="doc-open" onClick={() => abrirDocumento(d.path)}>📄 {d.tipo}</button>
                <span className="doc-name">{d.nombre_archivo}</span>
              </li>
            ))}
          </ul>}
    </div>
  );
}
