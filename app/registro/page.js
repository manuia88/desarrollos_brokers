'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

// tipo de cuenta según el modo con el que se llega desde la landing
const MODO_TIPO = { inmobiliaria: 'inmobiliaria', independiente: 'independiente', desarrollador: 'desarrollador' };

export default function Registro() {
  const router = useRouter();
  const [modo, setModo] = useState('inmobiliaria');   // inmobiliaria | independiente | desarrollador | unirme
  const [tipo, setTipo] = useState('inmobiliaria');
  const [persona, setPersona] = useState('fisica');
  const [nombreOrg, setNombreOrg] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rfc, setRfc] = useState('');
  const [files, setFiles] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dup, setDup] = useState(null);   // { id, nombre } inmobiliaria duplicada detectada

  useEffect(() => {
    let m = 'inmobiliaria';
    try { m = new URLSearchParams(window.location.search).get('modo') || 'inmobiliaria'; } catch { /* noop */ }
    if (!['inmobiliaria', 'independiente', 'desarrollador', 'unirme'].includes(m)) m = 'inmobiliaria';
    setModo(m);
    if (MODO_TIPO[m]) setTipo(MODO_TIPO[m]);
  }, []);

  const docsReq = persona === 'moral' ? [...DOCS_BASE, ...DOCS_MORAL] : DOCS_BASE;
  const setFile = (k, f) => setFiles(s => ({ ...s, [k]: f }));

  // ---- Alta con creación de organización (inmobiliaria / independiente / desarrollador) ----
  async function crearOrg(forzar) {
    setMsg(null); setLoading(true);
    const { error: e2 } = await supabase.rpc('registrar_org',
      { p_nombre: nombreOrg, p_tipo: tipo, p_rfc: rfc || null, p_forzar: !!forzar });
    if (e2) {
      setLoading(false);
      const m = String(e2.message || '');
      if (m.startsWith('org_duplicada|')) {
        const [, id, nom] = m.split('|');
        setDup({ id, nombre: nom });   // ofrecer unirse en vez de duplicar
        return false;
      }
      setMsg({ t: 'err', m: m }); return false;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const orgId = (await supabase.from('profiles').select('org_id').eq('id', session.user.id).single()).data?.org_id;
    for (const [k] of docsReq) {
      const f = files[k]; if (!f) continue;
      await subirDocumento({ file: f, ambito: 'broker', org_id: orgId, tipo: k });
    }
    setLoading(false);
    setMsg({ t: 'ok', m: '¡Cuenta creada! Tu registro y documentos quedaron en revisión para aprobación.' });
    return true;
  }

  // Unirse a la inmobiliaria duplicada que detectamos (en vez de crear otra igual)
  async function unirmeADuplicada() {
    setLoading(true); setMsg(null);
    const { error } = await supabase.rpc('solicitar_ingreso', { p_org: dup.id });
    setLoading(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setDup(null);
    router.replace('/unirme');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null); setDup(null);

    // Modo asesor: sólo crea la cuenta; la inmobiliaria se elige en /unirme.
    if (modo === 'unirme') {
      setLoading(true);
      const { data: sd, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre, telefono } } });
      if (error) { setLoading(false); setMsg({ t: 'err', m: error.message }); return; }
      setLoading(false);
      if (!sd.session) { setMsg({ t: 'ok', m: 'Te enviamos un correo para confirmar tu cuenta. Al confirmar, inicia sesión y elige tu inmobiliaria.' }); return; }
      router.replace('/unirme');
      return;
    }

    // Modos con organización: valida documentos y crea la cuenta.
    for (const [k, label] of docsReq) if (!files[k]) { setMsg({ t: 'err', m: `Falta subir: ${label}` }); return; }
    setLoading(true);
    const { data: sd, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre, telefono } } });
    if (error) { setLoading(false); setMsg({ t: 'err', m: error.message }); return; }
    if (!sd.session) { setLoading(false); setMsg({ t: 'ok', m: 'Te enviamos un correo para confirmar tu cuenta. Al confirmar podrás completar tu registro y subir tus documentos.' }); return; }
    await crearOrg(false);
  }

  // ---------- Vista: modo asesor ----------
  if (modo === 'unirme') {
    return (
      <div className="authwrap">
        <form className="authcard" onSubmit={onSubmit}>
          <span className="logo" style={{ marginBottom: '1rem' }}><b>D</b>DesarrollosMX</span>
          <h1>Únete a tu inmobiliaria</h1>
          <p className="sub">Crea tu cuenta de asesor. En el siguiente paso eliges la inmobiliaria a la que perteneces y el director aprueba tu ingreso.</p>
          {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
          <div className="field"><label>Tu nombre</label><input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
          <div className="field"><label>Correo</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
          <div className="field"><label>Teléfono / WhatsApp</label><input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" /></div>
          <div className="field"><label>Contraseña</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
          <button className="btn mag block" disabled={loading}>{loading ? 'Creando…' : 'Continuar'}</button>
          <p className="alt">¿Tu inmobiliaria aún no está en el portal? <Link href="/registro?modo=inmobiliaria">Regístrala aquí</Link></p>
          <p className="alt">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
        </form>
      </div>
    );
  }

  // ---------- Vista: alta con organización ----------
  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <span className="logo" style={{ marginBottom: '1rem' }}><b>D</b>DesarrollosMX</span>
        <h1>Únete al programa</h1>
        <p className="sub">{tipo === 'desarrollador' ? 'Registra tu empresa desarrolladora para publicar y administrar tu propio inventario.' : 'Registra tu inmobiliaria o tu cuenta de broker independiente.'}</p>
        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        {dup && (
          <div className="inbox" style={{ marginBottom: '1rem' }}>
            <h2><span className="warn-ic">⚠️</span> Ya existe una inmobiliaria parecida</h2>
            <p className="sub">Encontramos <b>{dup.nombre}</b>. Para no duplicar, ¿perteneces a ella?</p>
            <div className="ap-actions">
              <button type="button" className="btn ok sm" onClick={unirmeADuplicada} disabled={loading}>Sí, unirme a {dup.nombre}</button>
              <button type="button" className="btn no sm" onClick={() => crearOrg(true)} disabled={loading}>No, es otra distinta — crear de todos modos</button>
            </div>
          </div>
        )}

        <div className="field"><label>Tipo de cuenta</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="inmobiliaria">Inmobiliaria (con equipo)</option>
            <option value="independiente">Broker independiente</option>
            <option value="desarrollador">Desarrollador (administro mi inventario)</option>
          </select></div>
        <div className="field"><label>Régimen</label>
          <select value={persona} onChange={e => setPersona(e.target.value)}>
            <option value="fisica">Persona física</option>
            <option value="moral">Persona moral (empresa)</option>
          </select></div>
        <div className="field"><label>{tipo === 'independiente' ? 'Nombre comercial' : tipo === 'desarrollador' ? 'Nombre del desarrollador / empresa' : 'Nombre de la inmobiliaria'}</label>
          <input value={nombreOrg} onChange={e => { setNombreOrg(e.target.value); setDup(null); }} required /></div>
        <div className="field"><label>Tu nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
        <div className="field"><label>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>Teléfono / WhatsApp</label>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" /></div>
        <div className="field"><label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
        <div className="field"><label>RFC {persona === 'moral' ? '(de la empresa)' : '(opcional)'}</label>
          <input value={rfc} onChange={e => setRfc(e.target.value)} /></div>

        <div className="doc-block">
          <div className="doc-block-h">Documentos {persona === 'moral' ? '(persona moral)' : '(persona física)'}</div>
          <p className="doc-block-sub">Formatos PDF o imagen. Quedan en revisión y sólo los ve el administrador.</p>
          {docsReq.map(([k, label]) => (
            <div className="field doc-field" key={k}>
              <label>{label} {files[k] ? <span className="doc-ok">✓ {files[k].name}</span> : <span className="doc-req">obligatorio</span>}</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => setFile(k, e.target.files?.[0] || null)} />
            </div>
          ))}
        </div>

        <button className="btn mag block" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta'}</button>
        <p className="alt">¿Perteneces a una inmobiliaria? <Link href="/registro?modo=unirme">Únete a tu equipo</Link></p>
        <p className="alt">¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
