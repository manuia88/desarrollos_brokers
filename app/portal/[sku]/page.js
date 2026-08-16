'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import Cotizador from '../../../components/Cotizador';
import { getViewAs } from '../../../lib/viewas';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const YN = v => (v === 'Sí' || v === 'No') ? v : (v || '—');
function meses(f){ if(!f) return null; const h=new Date(),x=new Date(f+'T12:00'); return Math.max(0,(x.getFullYear()-h.getFullYear())*12+x.getMonth()-h.getMonth()); }
const fmes = f => f ? new Date(f+'T12:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'}) : '—';
const fmesShort = f => f ? new Date(f+'T12:00').toLocaleDateString('es-MX',{month:'short',year:'2-digit'}) : '—';

const FICHA_SCHEMA = [["Identificación y ubicación",["Tipo","Torre(s)","Dirección","Desarrollador","Colonia","Alcaldía / Municipio","Estado"]],["Etapa",["Preventa / En obra / Inmediata","Fecha de entrega"]],["Inventario y visita",["Unidades totales","Unidades disponibles","Unidades vendidas","% vendido","Niveles del edificio","Departamentos por piso","Caseta de venta","Depa muestra","Estacionamiento para clientes"]],["Precio",["Precio a partir de","Precio (mín)","Precio (máx)","Moneda","Precio por m²"]],["Esquema de pago",["Apartado","Enganche","Mensualidades","Meses para entrega","Mensualidad estimada","Escrituración","Descuentos disponibles"]],["Unidad",["M² habitables (mín)","M² habitables (máx)","M² terreno","Altura piso a techo","Recámaras (mín)","Recámaras (máx)","Baños (mín)","Baños (máx)","Estacionamientos (mín)","Estacionamientos (máx)","Tipo (dependiente/independiente)"]],["Espacios y acabados",["Balcón","Terraza","Roof garden privado","Bodega","Cuarto de servicio"]],["Amenidades y seguridad",["Lista de amenidades","Seguridad 24h","Acceso controlado","Elevadores"]],["Equipamiento",["Cocina integral","Barra de cocina","Canceles de baño","Clósets / vestidor","Cuarto de lavado"]],["Extras a la venta",["Estacionamiento a la venta","Precio por cajón","Bodega a la venta","Precio de bodega"]],["Comercialización",["Comisión al broker","Contacto del desarrollador"]],["Créditos aceptados",["Crédito Tradicional Infonavit","Infonavit Total","Cofinavit","Cofinavit Ingresos Adicionales","Unamos Créditos Infonavit","Crédito Conyugal Infonavit","Cuenta Infonavit + Crédito Bancario","Apoyo Infonavit","Crédito Tradicional FOVISSSTE","FOVISSSTE para Todos","Conyugal FOVISSSTE-Infonavit","Individual FOVISSSTE-Infonavit","Pensionados FOVISSSTE","ION","HIR","Yave","Bancario","IMSS","Banjército","PEMEX"]],["Costos recurrentes",["Mantenimiento mensual","Mantenimiento anticipado","Cuota de equipamiento","Predial estimado"]],["Legal",["Gastos de escrituración estimados","Permite Airbnb","Permite mascotas","Régimen de condominio","Escrituras listas"]],["Obra y edificio",["% avance de obra","Fecha de inicio de ventas","Niveles de estacionamiento","Cajones de bicicleta"]],["Servicios",["Agua (suministro)","Cisterna / capacidad","Agua caliente","Gas (tipo)","Gas (medidor)","Luz (CFE)","Planta de emergencia","Paneles solares","Drenaje","Internet / fibra"]],["Construcción y calidad",["Tipo de construcción","Sistema constructivo","Suelo / cimentación","Zona sísmica"]],["Documentación y ligas",["Memoria de acabados","Liga Drive","Liga EasyBroker","Liga brochure","Recorrido 360 / video"]]];

export default function Detalle() {
  const { sku } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [d, setD] = useState(undefined);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({ nombre:'', telefono:'', email:'', mensaje:'' });
  const [lead, setLead] = useState(null);
  const [sending, setSending] = useState(false);
  const [cotizar, setCotizar] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('rol,org_id').eq('id', session.user.id).single();
      setMe(prof || {});
      const { data } = await supabase.from('desarrollos').select('*').eq('sku', sku).single();
      setD(data || null);
      const { data: us } = await supabase.from('unidades').select('*').eq('dev_sku', sku).eq('estatus','Disponible').order('torre').order('num_depto');
      setUnits(us || []);
    })();
  }, [sku, router]);

  async function enviarLead(e){
    e.preventDefault();
    if(!form.nombre || !form.telefono){ setLead({t:'err',m:'Nombre y teléfono son obligatorios'}); return; }
    // Super-admin: registra a nombre de la inmobiliaria seleccionada en "Ver como".
    if (me?.rol === 'super_admin') {
      const va = getViewAs();
      if (!va || !va.org_id) { setLead({t:'err',m:'Como super-admin, elige una inmobiliaria en “Ver como” (arriba en el CRM) para registrar el cliente a su nombre.'}); return; }
      setSending(true);
      const { error: eIns } = await supabase.from('leads').insert({
        org_id: va.org_id, asesor_id: va.asesor_id || null,
        nombre: form.nombre, email: form.email||null, telefono: form.telefono,
        dev_sku: sku, mensaje: form.mensaje||null, etapa: 'Nuevo', fuente: 'Portal', estatus: 'ok',
      });
      setSending(false);
      if (eIns) { setLead({t:'err',m:eIns.message}); return; }
      setLead({t:'ok',m:`Cliente registrado en ${va.org_nombre}${va.asesor_nombre ? ' · '+va.asesor_nombre : ''}. Aparece en su CRM.`});
      setForm({ nombre:'', telefono:'', email:'', mensaje:'' });
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc('crear_lead', {
      p_nombre:form.nombre, p_email:form.email||null, p_telefono:form.telefono,
      p_dev_sku:sku, p_unidad_sku:null, p_mensaje:form.mensaje||null, p_presupuesto:null, p_fuente:'Portal'
    });
    setSending(false);
    if(error){ setLead({t:'err',m:error.message.includes('organiz')?'Solo un broker con inmobiliaria puede registrar clientes. (Tú entras como super-admin.)':error.message}); return; }
    setLead({t:'ok',m:'¡Cliente registrado! Aparece en tu CRM.'});
    setForm({ nombre:'', telefono:'', email:'', mensaje:'' });
  }

  if (d === undefined) return <div className="loading">Cargando…</div>;
  if (d === null) return <div className="loading">No encontrado. <Link href="/portal">Volver</Link></div>;

  const m = meses(d.fecha_entrega);
  const eng = d.esq_enganche ? d.precio_min*d.esq_enganche : null;
  const amen = (d.amenidades||'').split(',').map(s=>s.trim()).filter(Boolean);
  const creds = [['ION',d.credito_ion],['HIR',d.credito_hir],['Yave',d.credito_yave],['Bancario',d.credito_bancario]];
  const waNum = d.whatsapp ? 'https://'+d.whatsapp.replace('https://','').replace('http://','') : null;
  const fichaMap = d.ficha || {};

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Portal de Brokers</span>
        <nav className="nav"><Link href="/portal">← Catálogo</Link></nav>
      </div></header>

      <main className="wrap" style={{paddingBottom:'3rem'}}>
        <div className="dcover" style={{background:'linear-gradient(135deg,hsl(330 45% 24%),hsl(348 55% 40%))'}}>
          <span className="badge2">{d.etapa==='Entrega inmediata'?'Entrega inmediata':(m!=null?`Preventa · entrega en ${m} meses`:'Preventa')}</span>
        </div>
        <div className="dhead">
          <div><h1>{d.nombre}</h1><p className="loc">📍 {d.direccion} · {d.colonia}, {d.alcaldia}, {d.estado}</p></div>
          <div className="pricebox"><span>Precio desde</span><b>{MXN(d.precio_min)}</b><small>hasta {MXN(d.precio_max)}</small></div>
        </div>

        <div className="dactions">
          <button className="btn mag" onClick={() => setCotizar('dev')}>Cotizar</button>
          {waNum && <a className="btn lim" href={`${waNum}?text=${encodeURIComponent('Hola, me interesa '+d.nombre)}`} target="_blank" rel="noopener">WhatsApp asesor</a>}
          {d.liga_disponibilidad && d.liga_disponibilidad.startsWith('http') && <a className="btn ghost" href={d.liga_disponibilidad} target="_blank" rel="noopener">Sitio oficial</a>}
        </div>

        <div className="specrow">
          <div className="sbox"><b>{d.rec_min===0?'Loft':d.rec_min}–{d.rec_max}</b><span>Recámaras</span></div>
          <div className="sbox"><b>{d.banos_min}–{d.banos_max}</b><span>Baños</span></div>
          <div className="sbox"><b>{d.estac_min}–{d.estac_max}</b><span>Estac. · {d.tipo_estac||'—'}</span></div>
          <div className="sbox"><b>{Math.round(d.m2_min)}–{Math.round(d.m2_max)}</b><span>m² habitables</span></div>
          <div className="sbox"><b>{units.length}</b><span>Disponibles hoy</span></div>
        </div>

        <div className="sec"><h2>Esquema de pago</h2>
          <div className="esq">
            <div><span>Apartado</span><b>{MXN(d.apartado)}</b></div>
            <div><span>Enganche</span><b>{Math.round((d.esq_enganche||0)*100)}%{eng?` · ${MXN(eng)}`:''}</b></div>
            <div><span>Mensualidades en obra</span><b>{Math.round((d.esq_mensualidades||0)*100)}%</b></div>
            <div><span>Contra escritura</span><b>{Math.round((d.esq_escritura||0)*100)}%</b></div>
          </div>
        </div>

        <div className="sec"><h2>Unidades disponibles ({units.length})</h2>
          {units.length===0 ? <p className="fnote">Sin unidades disponibles publicadas.</p> :
          <div className="utbl-wrap"><table className="utbl"><thead><tr>
            <th>Unidad</th><th>Rec</th><th>Baños</th><th>Estac</th><th>m² hab</th><th>m² tot</th><th>Precio</th><th>Enganche</th><th>Mensualidad est.</th><th>Entrega</th><th></th>
          </tr></thead><tbody>
            {units.map(u=>{ const mm=meses(u.fecha_escrituracion); const mens=mm>0?MXN(u.precio*(d.esq_mensualidades||0)/mm):'—';
              return <tr key={u.sku}>
                <td><b>T{u.torre} · {u.num_depto}</b></td>
                <td>{u.rec===0?'Loft':u.rec}</td><td>{u.banos}</td><td>{u.n_estac||'—'}</td>
                <td>{u.m2_hab}</td><td>{u.m2_total||'—'}</td>
                <td><b>{MXN(u.precio)}</b></td><td>{MXN(u.precio*(d.esq_enganche||0))}</td><td>{mens}</td><td>{fmesShort(u.fecha_escrituracion)}</td>
                <td><button className="cotiz-mini" onClick={()=>setCotizar(u)}>Cotizar</button></td>
              </tr>; })}
          </tbody></table></div>}
        </div>

        {amen.length>0 && <div className="sec"><h2>Amenidades</h2><div className="chips2">{amen.map((a,i)=><span className="chip2" key={i}>{a}</span>)}</div></div>}

        <div className="sec"><h2>Créditos aceptados</h2><div className="chips2">
          {creds.map(([l,v])=><span key={l} className={'chip2 '+(v&&/s/i.test(v)?'on':'off')}>{l}</span>)}
        </div></div>

        <div className="sec"><h2>Ficha técnica completa</h2>
          <p className="fnote" style={{marginTop:0,marginBottom:'.8rem'}}>Todas las columnas del inventario. Los campos vacíos se irán completando desde el wizard de captura.</p>
          {FICHA_SCHEMA.map(([titulo,campos])=>{
            const filled = campos.filter(c=>fichaMap[c]!=null && fichaMap[c]!=='').length;
            return (
              <details key={titulo} className="fsec" open={filled>0}>
                <summary>{titulo} <span className="fcount">{filled}/{campos.length}</span></summary>
                <div className="kv">{campos.map(c=><div className="kvrow" key={c}><span>{c}</span><b>{fichaMap[c]!=null&&fichaMap[c]!==''?String(fichaMap[c]):'—'}</b></div>)}</div>
              </details>
            );
          })}
        </div>

        <div className="sec"><h2>Registrar cliente interesado</h2>
          {lead && <div className={'msg '+lead.t}>{lead.m}</div>}
          <form className="leadform" onSubmit={enviarLead}>
            <div className="field"><label>Nombre*</label><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} /></div>
            <div className="field"><label>Teléfono / WhatsApp*</label><input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></div>
            <div className="field"><label>Correo</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="field full"><label>Mensaje</label><input value={form.mensaje} onChange={e=>setForm({...form,mensaje:e.target.value})} placeholder="Qué busca el cliente…" /></div>
            <div className="full"><button className="btn mag block" disabled={sending}>{sending?'Registrando…':'Registrar en mi CRM'}</button></div>
          </form>
        </div>

        {cotizar && <Cotizador dev={d} unidad={cotizar === 'dev' ? null : cotizar} onClose={() => setCotizar(null)} />}
      </main>
    </>
  );
}
