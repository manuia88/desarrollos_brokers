'use client';
import { tituloDev } from '../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// Registro de cliente unificado. Un solo componente para la ficha y el CRM.
// - Broker normal: usa crear_lead (dedup anti-fraude + auditoría).
// - Super-admin: elige la inmobiliaria en el mismo formulario (sin "Ver como")
//   e inserta directo. Si captura fecha/hora, además crea la cita.
// Rediseño mobile-first: todos los datos del cliente, presupuesto EXACTO,
// formas de pago reales, recámaras/baños/estacionamientos y exteriores.

const FORMAS = [
  ['Por definir', 'Por definir', ''],
  ['Recursos propios', 'Recursos propios', 'Pago de contado o con ahorro, sin crédito.'],
  ['Crédito bancario', 'Crédito bancario', 'Hipoteca con banco (BBVA, Santander, HSBC, Scotia…). Tasa fija, plazo hasta 20 años.'],
  ['Crédito Infonavit', 'Crédito Infonavit', 'Productos comunes: Crédito Tradicional, Cofinavit (Infonavit + banco), Unamos Créditos y Apoyo Infonavit.'],
  ['FOVISSSTE', 'FOVISSSTE', 'Para trabajadores del Estado. Productos: Tradicional, FOVISSSTE-Banco (cofinanciado), Respalda-2 y Pensionados.'],
  ['Mixto', 'Mixto', 'Combina crédito (bancario/Infonavit/FOVISSSTE) con recursos propios para el enganche.'],
];
const URGENCIAS = [
  ['', 'Sin definir'], ['Inmediata', 'Menos de 1 mes'],
  ['1-3 meses', '1 a 3 meses'], ['3-6 meses', '3 a 6 meses'], ['Explorando', 'Explorando'],
];
const REC_OPTS = [['', '—'], ['0', 'Loft'], ['1', '1'], ['2', '2'], ['3', '3+']];
const BANO_OPTS = [['', '—'], ['1', '1'], ['2', '2'], ['3', '3+']];
const ESTAC_OPTS = [['', '—'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3+']];
const PRESUP_QUICK = [2500000, 3000000, 3500000, 4500000, 6000000];

const soloDigitos = s => (s || '').replace(/[^0-9]/g, '');
const fmtMiles = s => { const d = soloDigitos(s); return d ? Number(d).toLocaleString('es-MX') : ''; };
const MXNc = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

export default function RegistroCliente({ me, dev = null, unidad = null, onClose, onDone }) {
  const isSuper = me?.rol === 'super_admin';
  const [devs, setDevs] = useState(dev ? [dev] : null);
  const [orgs, setOrgs] = useState([]);
  const [people, setPeople] = useState([]);
  const [sending, setSending] = useState(false);
  const [res, setRes] = useState(null);
  const [dup, setDup] = useState(null);

  const [f, setF] = useState({
    nombre: '', telefono: '', email: '',
    dev_sku: dev ? dev.sku : '', unidad_sku: unidad ? unidad.sku : '',
    rec_interes: unidad ? String(unidad.rec ?? '') : '', banos_interes: '', estac_interes: '',
    balcon: false, terraza: false, roof: false,
    presupuesto: '', forma_pago: 'Por definir',
    urgencia: '', zona_interes: '', mensaje: '',
    org_id: '', asesor_id: '',
    cita_fecha: '', cita_hora: '', cita_modalidad: 'Presencial',
    consent: false,
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  async function checkDup() {
    const tel = f.telefono.trim(), mail = f.email.trim();
    if (soloDigitos(tel).length < 10 && !mail) { setDup(null); return; }
    const { data } = await supabase.rpc('cliente_registrado', { p_telefono: tel || null, p_email: mail || null });
    const hit = Array.isArray(data) ? data[0] : data;
    setDup(hit || null);
  }

  useEffect(() => {
    (async () => {
      const jobs = [];
      if (!dev) jobs.push(supabase.from('desarrollos').select('sku,nombre,alcaldia').order('nombre'));
      if (isSuper) {
        jobs.push(supabase.from('orgs').select('id,nombre,estado').eq('estado', 'activo').order('nombre'));
        jobs.push(supabase.from('profiles').select('id,nombre,rol,org_id,activo').order('nombre'));
      }
      const out = await Promise.all(jobs);
      let i = 0;
      if (!dev) { setDevs(out[i]?.data || []); i++; }
      if (isSuper) {
        const o = out[i]?.data || []; setOrgs(o); i++;
        setPeople(out[i]?.data || []);
        if (o.length === 1) set('org_id', o[0].id);
      }
    })();
  }, []);

  const zonas = useMemo(() => {
    const src = devs || [];
    return [...new Set(src.map(d => d.alcaldia).filter(Boolean))].sort();
  }, [devs]);

  const asesoresOrg = useMemo(
    () => people.filter(p => p.org_id === f.org_id && p.rol !== 'super_admin'),
    [people, f.org_id]
  );

  const presupNum = useMemo(() => { const d = soloDigitos(f.presupuesto); return d ? Number(d) : null; }, [f.presupuesto]);
  const formaInfo = FORMAS.find(x => x[0] === f.forma_pago)?.[2] || '';

  const prefs = () => ({
    banos: f.banos_interes || null,
    estac: f.estac_interes || null,
    presupuesto_max: presupNum || null,
    presupuesto_min: null,
    balcon: !!f.balcon, terraza: !!f.terraza, roof: !!f.roof,
  });

  async function crearCita(lead_id, org_id, asesor_id) {
    if (!f.cita_fecha) return;
    await supabase.from('citas').insert({
      org_id, lead_id, asesor_id: asesor_id || null,
      nombre: f.nombre, email: f.email || null, telefono: f.telefono || null,
      dev_sku: f.dev_sku || null, fecha: f.cita_fecha, hora: f.cita_hora || null,
      modalidad: f.cita_modalidad, estatus: 'Solicitada',
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!f.nombre.trim() || !f.telefono.trim()) { setRes({ t: 'err', m: 'Nombre y teléfono son obligatorios.' }); return; }
    if (soloDigitos(f.telefono).length < 10) { setRes({ t: 'err', m: 'El teléfono debe tener 10 dígitos.' }); return; }
    if (!f.consent) { setRes({ t: 'err', m: 'Marca la casilla de autorización de contacto para poder registrar al cliente.' }); return; }
    const rec = f.rec_interes ? parseInt(f.rec_interes, 10) : null;
    const p = prefs();

    setSending(true);
    try {
      if (isSuper) {
        if (!f.org_id) { setRes({ t: 'err', m: 'Elige la inmobiliaria a la que pertenece este cliente.' }); setSending(false); return; }
        const { data, error } = await supabase.from('leads').insert({
          org_id: f.org_id, asesor_id: f.asesor_id || null,
          nombre: f.nombre.trim(), email: f.email.trim() || null, telefono: f.telefono.trim(),
          dev_sku: f.dev_sku || null, unidad_sku: f.unidad_sku || null, mensaje: f.mensaje.trim() || null,
          presupuesto: presupNum ? String(presupNum) : null, etapa: 'Nuevo', fuente: 'Portal', estatus: 'ok',
          forma_pago: f.forma_pago, urgencia: f.urgencia || null, rec_interes: rec,
          banos_interes: p.banos, estac_interes: p.estac,
          presupuesto_min: p.presupuesto_min, presupuesto_max: p.presupuesto_max,
          quiere_balcon: p.balcon, quiere_terraza: p.terraza, quiere_roof: p.roof, preferencias: p,
          zona_interes: f.zona_interes || null, consentimiento: true,
        }).select('id').single();
        if (error) { setRes({ t: 'err', m: error.message }); setSending(false); return; }
        await crearCita(data.id, f.org_id, f.asesor_id);
        const orgNom = orgs.find(o => o.id === f.org_id)?.nombre || 'la inmobiliaria';
        finish(`Cliente registrado en ${orgNom}${f.cita_fecha ? ' con cita agendada' : ''}. Ya aparece en su CRM.`);
      } else {
        const { data, error } = await supabase.rpc('crear_lead', {
          p_nombre: f.nombre.trim(), p_email: f.email.trim() || null, p_telefono: f.telefono.trim(),
          p_dev_sku: f.dev_sku || null, p_unidad_sku: f.unidad_sku || null, p_mensaje: f.mensaje.trim() || null,
          p_presupuesto: presupNum ? String(presupNum) : null, p_fuente: 'Portal',
          p_forma_pago: f.forma_pago, p_urgencia: f.urgencia || null, p_rec_interes: rec,
          p_zona_interes: f.zona_interes || null, p_consentimiento: true, p_prefs: p,
        });
        if (error) {
          const m = error.message.includes('organiz') ? 'Tu usuario no tiene inmobiliaria asignada; pide a tu director que te agregue.' : error.message;
          setRes({ t: 'err', m }); setSending(false); return;
        }
        await crearCita(data, me.org_id, me.id);
        finish(`¡Cliente registrado!${f.cita_fecha ? ' Cita agendada.' : ''} Ya aparece en tu CRM.`);
      }
    } catch (err) {
      setRes({ t: 'err', m: err.message || 'Error inesperado.' }); setSending(false);
    }
  }

  function finish(msg) {
    setSending(false);
    setRes({ t: 'ok', m: msg });
    setF(s => ({
      ...s, nombre: '', telefono: '', email: '', mensaje: '', presupuesto: '',
      forma_pago: 'Por definir', urgencia: '', rec_interes: '', banos_interes: '', estac_interes: '',
      balcon: false, terraza: false, roof: false, zona_interes: '',
      cita_fecha: '', cita_hora: '', consent: false,
    }));
    if (onDone) onDone();
  }

  const devSelObj = dev || (devs || []).find(d => d.sku === f.dev_sku); const devSel = devSelObj ? tituloDev(devSelObj) : null;

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer rc" onClick={e => e.stopPropagation()}>
        <div className="dw-h">
          <div>
            <span className="dw-tag">Registrar cliente</span>
            <h2>{devSel || 'Nuevo cliente'}</h2>
            {unidad && <div className="ud-sub">Unidad T{unidad.torre} · {unidad.num_depto}</div>}
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        {res && <div className={'msg ' + res.t}>{res.m}</div>}

        {dup && (
          <div className="dup-warn">
            <b>⚠ Este cliente ya está registrado</b>
            <span>{dup.mismo_org ? 'En tu inmobiliaria' : 'Por otra inmobiliaria'}: <b>{dup.asesor || 'un asesor'}</b>{dup.inmobiliaria ? ' · ' + dup.inmobiliaria : ''} lo registró primero{dup.cuando ? ' el ' + new Date(dup.cuando).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}. Por protección de cliente, gana quien lo registró primero.</span>
          </div>
        )}

        <form onSubmit={submit} className="rc-form">
          {/* Inmobiliaria (solo super-admin) */}
          {isSuper && (
            <section className="rc-sec rc-super">
              <h4>Inmobiliaria</h4>
              <div className="dw-row">
                <div className="dw-field">
                  <label>A nombre de *</label>
                  <select value={f.org_id} onChange={e => { set('org_id', e.target.value); set('asesor_id', ''); }}>
                    <option value="">Elige la inmobiliaria…</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
                <div className="dw-field">
                  <label>Asignar a asesor</label>
                  <select value={f.asesor_id} onChange={e => set('asesor_id', e.target.value)} disabled={!f.org_id}>
                    <option value="">Sin asignar</option>
                    {asesoresOrg.map(a => <option key={a.id} value={a.id}>{a.nombre} · {a.rol}</option>)}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* Contacto */}
          <section className="rc-sec">
            <h4>Datos del cliente</h4>
            <div className="dw-field"><label>Nombre completo *</label>
              <input value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos" autoComplete="name" /></div>
            <div className="dw-row">
              <div className="dw-field"><label>Teléfono / WhatsApp *</label>
                <input type="tel" inputMode="numeric" value={f.telefono} onChange={e => set('telefono', e.target.value)} onBlur={checkDup} placeholder="55 1234 5678" autoComplete="tel" /></div>
              <div className="dw-field"><label>Correo</label>
                <input type="email" value={f.email} onChange={e => set('email', e.target.value)} onBlur={checkDup} placeholder="cliente@correo.com" autoComplete="email" /></div>
            </div>
          </section>

          {/* Presupuesto exacto */}
          <section className="rc-sec">
            <h4>Presupuesto del cliente</h4>
            <div className="dw-field">
              <label>Presupuesto exacto</label>
              <div className="rc-money">
                <span className="rc-money-sign">$</span>
                <input inputMode="numeric" value={fmtMiles(f.presupuesto)} onChange={e => set('presupuesto', soloDigitos(e.target.value))} placeholder="3,450,000" />
                <span className="rc-money-cur">MXN</span>
              </div>
              <div className="rc-chips rc-quick">
                {PRESUP_QUICK.map(v => <span key={v} className={'chip' + (presupNum === v ? ' on' : '')} onClick={() => set('presupuesto', String(v))}>{MXNc(v)}</span>)}
                {presupNum ? <span className="chip chip-clear" onClick={() => set('presupuesto', '')}>Borrar</span> : null}
              </div>
            </div>
          </section>

          {/* Forma de pago */}
          <section className="rc-sec">
            <h4>Forma de pago</h4>
            <div className="rc-chips">
              {FORMAS.map(([v, l]) => <span key={v} className={'chip' + (f.forma_pago === v ? ' on' : '')} onClick={() => set('forma_pago', v)}>{l}</span>)}
            </div>
            {formaInfo && <p className="rc-hint">{formaInfo}</p>}
          </section>

          {/* Qué busca: configuración */}
          <section className="rc-sec">
            <h4>Qué busca</h4>
            {!dev ? (
              <div className="dw-field"><label>Desarrollo de interés</label>
                <select value={f.dev_sku} onChange={e => set('dev_sku', e.target.value)}>
                  <option value="">Aún no lo define</option>
                  {(devs || []).map(d => <option key={d.sku} value={d.sku}>{tituloDev(d)}</option>)}
                </select>
              </div>
            ) : (
              <div className="dw-kv"><span>Desarrollo</span><b>{dev.nombre}</b></div>
            )}
            <div className="dw-field"><label>Recámaras</label>
              <div className="rc-chips">
                {REC_OPTS.map(([v, l]) => <span key={v} className={'chip' + (f.rec_interes === v ? ' on' : '')} onClick={() => set('rec_interes', v)}>{l}</span>)}
              </div>
            </div>
            <div className="dw-row">
              <div className="dw-field"><label>Baños</label>
                <div className="rc-chips">
                  {BANO_OPTS.map(([v, l]) => <span key={v} className={'chip' + (f.banos_interes === v ? ' on' : '')} onClick={() => set('banos_interes', v)}>{l}</span>)}
                </div>
              </div>
              <div className="dw-field"><label>Estacionamientos</label>
                <div className="rc-chips">
                  {ESTAC_OPTS.map(([v, l]) => <span key={v} className={'chip' + (f.estac_interes === v ? ' on' : '')} onClick={() => set('estac_interes', v)}>{l}</span>)}
                </div>
              </div>
            </div>
            <div className="dw-field"><label>Exteriores (opcional)</label>
              <div className="rc-chips">
                <span className={'chip' + (f.balcon ? ' on' : '')} onClick={() => set('balcon', !f.balcon)}>🌿 Balcón</span>
                <span className={'chip' + (f.terraza ? ' on' : '')} onClick={() => set('terraza', !f.terraza)}>☀️ Terraza</span>
                <span className={'chip' + (f.roof ? ' on' : '')} onClick={() => set('roof', !f.roof)}>🏙️ Roof garden privado</span>
              </div>
            </div>
            <div className="dw-row">
              <div className="dw-field"><label>Zona de interés</label>
                <select value={f.zona_interes} onChange={e => set('zona_interes', e.target.value)}>
                  <option value="">Cualquiera</option>
                  {zonas.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="dw-field"><label>Horizonte de compra</label>
                <select value={f.urgencia} onChange={e => set('urgencia', e.target.value)}>
                  {URGENCIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Cita */}
          <section className="rc-sec">
            <h4>Cita <span className="rc-opt">opcional</span></h4>
            <div className="dw-row">
              <div className="dw-field"><label>Fecha</label>
                <input type="date" value={f.cita_fecha} onChange={e => set('cita_fecha', e.target.value)} /></div>
              <div className="dw-field"><label>Hora</label>
                <input type="time" value={f.cita_hora} onChange={e => set('cita_hora', e.target.value)} /></div>
            </div>
            {f.cita_fecha && (
              <div className="dw-field"><label>Modalidad</label>
                <select value={f.cita_modalidad} onChange={e => set('cita_modalidad', e.target.value)}>
                  <option>Presencial</option><option>Videollamada</option><option>Llamada</option>
                </select>
              </div>
            )}
          </section>

          {/* Notas */}
          <section className="rc-sec">
            <h4>Notas</h4>
            <div className="dw-field">
              <textarea value={f.mensaje} onChange={e => set('mensaje', e.target.value)} placeholder="Contexto: qué le importa, objeciones, referido por…" />
            </div>
          </section>

          {/* Consentimiento */}
          <label className="rc-consent">
            <input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} />
            <span>El cliente autorizó que lo contactemos y que guardemos sus datos conforme al aviso de privacidad.</span>
          </label>

          <button className="btn mag block" disabled={sending}>{sending ? 'Registrando…' : 'Registrar en el CRM'}</button>
        </form>
      </aside>
    </>
  );
}
