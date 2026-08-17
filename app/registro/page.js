'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { subirDocumento } from '../../lib/docs';

const DOCS_BASE = [
  ['ine', 'INE / IFE'],
  ['csf', 'Constancia de Situación Fiscal (CSF)'],
  ['comprobante_domicilio', 'Comprobante de domicilio'],
  ['curp', 'CURP'],
];
const DOCS_MORAL = [
  ['acta_constitutiva', 'Acta constitutiva de la empresa'],
  ['ine_representante', 'INE del representante legal'],
];

export default function Registro() {
  const [tipo, setTipo] = useState('inmobiliaria');
  const [persona, setPersona] = useState('fisica');
  const [nombreOrg, setNombreOrg] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rfc, setRfc] = useState('');
  const [files, setFiles] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const docsReq = persona === 'moral' ? [...DOCS_BASE, ...DOCS_MORAL] : DOCS_BASE;
  const setFile = (k, f) => setFiles(s => ({ ...s, [k]: f }));

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    for (const [k, label] of docsReq) if (!files[k]) { setMsg({ t: 'err', m: `Falta subir: ${label}` }); return; }
    setLoading(true);

    const { data: sd, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre } } });
    if (error) { setLoading(false); setMsg({ t: 'err', m: error.message }); return; }
    if (!sd.session) {
      setLoading(false);
      setMsg({ t: 'ok', m: 'Te enviamos un correo para confirmar tu cuenta. Al confirmar podrás completar tu registro y subir tus documentos.' });
      return;
    }
    const { data: orgId, error: e2 } = await supabase.rpc('registrar_org', { p_nombre: nombreOrg, p_tipo: tipo, p_rfc: rfc || null });
    if (e2) { setLoading(false); setMsg({ t: 'err', m: e2.message }); return; }

    for (const [k] of docsReq) {
      const f = files[k];
      const { error: eu } = await subirDocumento({ file: f, ambito: 'broker', org_id: orgId, tipo: k });
      if (eu) { setLoading(false); setMsg({ t: 'err', m: `Cuenta creada, pero falló subir ${k}: ${eu.message}. Inicia sesión para reintentar.` }); return; }
    }
    setLoading(false);
    setMsg({ t: 'ok', m: '¡Cuenta creada! Tu registro y documentos quedaron en revisión para aprobación de Quiero Casa.' });
  }

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>Q</b>Quiero Casa</span>
        <h1>Únete al programa</h1>
        <p className="sub">Registra tu inmobiliaria o tu cuenta de broker independiente.</p>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        <div className="field"><label>Tipo de cuenta</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="inmobiliaria">Inmobiliaria (con equipo)</option>
            <option value="independiente">Broker independiente</option>
          </select></div>
        <div className="field"><label>Régimen</label>
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            <option value="fisica">Persona física</option>
            <option value="moral">Persona moral (empresa)</option>
          </select></div>
        <div className="field"><label>{tipo === 'independiente' ? 'Nombre comercial' : 'Nombre de la inmobiliaria'}</label>
          <input value={nombreOrg} onChange={e => setNombreOrg(e.target.value)} required /></div>
        <div className="field"><label>Tu nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
        <div className="field"><label>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div className="field"><label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
        <div className="field"><label>RFC {persona === 'moral' ? '(de la empresa)' : '(opcional)'}</label>
          <input value={rfc} onChange={e => setRfc(e.target.value)} /></div>

        <div className="doc-block">
          <div className="doc-block-h">Documentos {persona === 'moral' ? '(persona moral)' : '(persona física)'}</div>
          <p className="doc-block-sub">Formatos PDF o imagen. Quedan en revisión y sólo los ve Quiero Casa.</p>
          {docsReq.map(([k, label]) => (
            <div className="field doc-field" key={k}>
              <label>{label} {files[k] ? <span className="doc-ok">✓ {files[k].name}</span> : <span className="doc-req">obligatorio</span>}</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => setFile(k, e.target.files?.[0] || null)} />
            </div>
          ))}
        </div>

        <button className="btn mag block" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta'}</button>
        <p className="alt">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
