'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import Cotizador from '../../../components/Cotizador';
import UnitDrawer from '../../../components/UnitDrawer';
import RegistroCliente from '../../../components/RegistroCliente';
import MediosManager from '../../../components/MediosManager';
import ModelosView from '../../../components/ModelosView';
import { listarMedios, etiquetaMedio } from '../../../lib/medios';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const IMG_TIPOS = ['portada', 'render', 'foto', 'amenidad', 'plano', 'planta'];
function meses(f){ if(!f) return null; const h=new Date(),x=new Date(f+'T12:00'); return Math.max(0,(x.getFullYear()-h.getFullYear())*12+x.getMonth()-h.getMonth()); }
const fmesShort = f => f ? new Date(f+'T12:00').toLocaleDateString('es-MX',{month:'short',year:'2-digit'}) : '—';
const m2 = v => (v==null||v==='') ? '—' : (Math.round(v*10)/10);
const numFicha = v => { if (v == null) return null; const n = +String(v).replace(/[^0-9.]/g, ''); return isNaN(n) ? null : n; };

function amenIcon(a) {
  const s = (a || '').toLowerCase();
  if (/alberca|piscina/.test(s)) return '🏊';
  if (/gim|gym|fitness/.test(s)) return '🏋️';
  if (/roof|sky|terraza comun/.test(s)) return '🌇';
  if (/cowork|business|oficina/.test(s)) return '💻';
  if (/cctv|circuito|cámara|camara/.test(s)) return '📹';
  if (/segur|vigil|acceso|control/.test(s)) return '🛡️';
  if (/elevad|ascensor/.test(s)) return '🛗';
  if (/ludot|juego|niñ|kids/.test(s)) return '🧸';
  if (/mascota|pet/.test(s)) return '🐾';
  if (/salón|salon|usos|eventos|fiesta/.test(s)) return '🎉';
  if (/bici|bike/.test(s)) return '🚲';
  if (/verde|jard|área verde/.test(s)) return '🌳';
  if (/asador|bbq|parrilla/.test(s)) return '🔥';
  if (/lobby|recep/.test(s)) return '🛋️';
  if (/lavand/.test(s)) return '🧺';
  if (/spa|sauna|vapor/.test(s)) return '🧖';
  if (/cine|teatro/.test(s)) return '🎬';
  if (/discapac/.test(s)) return '♿';
  if (/basura|residuo/.test(s)) return '🗑️';
  if (/vestid|closet/.test(s)) return '👔';
  return '✨';
}

// Orden de la ficha técnica: lo que decide una compra, primero.
const ORDEN_FICHA = ['Inventario y visita', 'Precio', 'Esquema de pago', 'Créditos aceptados', 'Unidad', 'Espacios y acabados', 'Amenidades y seguridad', 'Equipamiento', 'Costos recurrentes', 'Legal', 'Servicios', 'Construcción y calidad', 'Obra y edificio', 'Extras a la venta', 'Identificación y ubicación', 'Comercialización', 'Etapa', 'Documentación y ligas'];

const FICHA_SCHEMA = [["Identificación y ubicación",["Tipo","Torre(s)","Dirección","Desarrollador","Colonia","Alcaldía / Municipio","Estado"]],["Etapa",["Preventa / En obra / Inmediata","Fecha de entrega"]],["Inventario y visita",["Unidades totales","Unidades disponibles","Unidades vendidas","% vendido","Niveles del edificio","Departamentos por piso","Caseta de venta","Depa muestra","Estacionamiento para clientes"]],["Precio",["Precio a partir de","Precio (mín)","Precio (máx)","Moneda","Precio por m²"]],["Esquema de pago",["Apartado","Enganche","Mensualidades","Meses para entrega","Mensualidad estimada","Escrituración","Descuentos disponibles"]],["Unidad",["M² habitables (mín)","M² habitables (máx)","M² terreno","Altura piso a techo","Recámaras (mín)","Recámaras (máx)","Baños (mín)","Baños (máx)","Estacionamientos (mín)","Estacionamientos (máx)","Tipo (dependiente/independiente)"]],["Espacios y acabados",["Balcón","Terraza","Roof garden privado","Bodega","Cuarto de servicio"]],["Amenidades y seguridad",["Lista de amenidades","Seguridad 24h","Acceso controlado","Elevadores"]],["Equipamiento",["Cocina integral","Barra de cocina","Canceles de baño","Clósets / vestidor","Cuarto de lavado"]],["Extras a la venta",["Estacionamiento a la venta","Precio por cajón","Bodega a la venta","Precio de bodega"]],["Comercialización",["Comisión al broker","Contacto del desarrollador"]],["Créditos aceptados",["Crédito Tradicional Infonavit","Infonavit Total","Cofinavit","Cofinavit Ingresos Adicionales","Unamos Créditos Infonavit","Crédito Conyugal Infonavit","Cuenta Infonavit + Crédito Bancario","Apoyo Infonavit","Crédito Tradicional FOVISSSTE","FOVISSSTE para Todos","Conyugal FOVISSSTE-Infonavit","Individual FOVISSSTE-Infonavit","Pensionados FOVISSSTE","ION","HIR","Yave","Bancario","IMSS","Banjército","PEMEX"]],["Costos recurrentes",["Mantenimiento mensual","Mantenimiento anticipado","Cuota de equipamiento","Predial estimado"]],["Legal",["Gastos de escrituración estimados","Permite Airbnb","Permite mascotas","Régimen de condominio","Escrituras listas"]],["Obra y edificio",["% avance de obra","Fecha de inicio de ventas","Niveles de estacionamiento","Cajones de bicicleta"]],["Servicios",["Agua (suministro)","Cisterna / capacidad","Agua caliente","Gas (tipo)","Gas (medidor)","Luz (CFE)","Planta de emergencia","Paneles solares","Drenaje","Internet / fibra"]],["Construcción y calidad",["Tipo de construcción","Sistema constructivo","Suelo / cimentación","Zona sísmica"]],["Documentación y ligas",["Memoria de acabados","Liga Drive","Liga EasyBroker","Liga brochure","Recorrido 360 / video"]]];

const EST = { disponible:['Disponible','ust-ok'], apartado:['Apartado','ust-ap'], reservado:['Reservado','ust-re'], vendido:['Vendido','ust-vd'] };

export default function Detalle() {
  const { sku } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [d, setD] = useState(undefined);
  const [units, setUnits] = useState([]);
  const [tab, setTab] = useState('resumen');
  const [vistaUni, setVistaUni] = useState('modelo'); // 'modelo' | 'unidad'
  const [fRec, setFRec] = useState('');               // '', '0'(loft), '1','2','3'(3+)
  const [fExt, setFExt] = useState(false);            // con balcón/terraza/roof
  const [verVacios, setVerVacios] = useState(false);
  const [cotizar, setCotizar] = useState(null);   // null | 'dev' | unidad
  const [unitSel, setUnitSel] = useState(null);   // unidad | null
  const [showReg, setShowReg] = useState(false);
  const [regUnidad, setRegUnidad] = useState(null);
  const [medios, setMedios] = useState([]);
  const [showMedios, setShowMedios] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [vistas, setVistas] = useState(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, ...(prof || {}) });
      const { data } = await supabase.from('desarrollos').select('*').eq('sku', sku).single();
      setD(data || null);
      const { data: us } = await supabase.from('unidades').select('*').eq('dev_sku', sku).eq('estatus','Disponible').order('torre').order('num_depto');
      setUnits(us || []);
      setMedios(await listarMedios(sku));
      const { count } = await supabase.from('eventos').select('id', { count: 'exact', head: true })
        .eq('tipo', 'vista_ficha').eq('entidad_id', sku).eq('actor', session.user.id);
      setVistas(count || 0);
    })();
  }, [sku, router]);

  const portada = useMemo(() => medios.find(x => x.tipo === 'portada') || medios.find(x => x.tipo === 'render') || medios.find(x => x.tipo === 'foto'), [medios]);
  const galeria = useMemo(() => {
    const pri = { portada: 0, render: 1, foto: 2, amenidad: 3, planta: 4, plano: 5 };
    return medios.filter(x => IMG_TIPOS.includes(x.tipo)).slice()
      .sort((a, b) => (pri[a.tipo] - pri[b.tipo]) || ((a.orden || 0) - (b.orden || 0)));
  }, [medios]);

  const recMatch = (u) => fRec === '' || (fRec === '3' ? u.rec >= 3 : String(u.rec) === fRec);
  const extMatch = (u) => !fExt || (u.balcon_m2 > 0 || u.terraza_m2 > 0 || u.roof_m2 > 0);
  const uFilt = useMemo(() => units.filter(u => recMatch(u) && extMatch(u)).sort((a, b) => (a.precio || 0) - (b.precio || 0)), [units, fRec, fExt]);
  const recChips = useMemo(() => {
    const opt = [['', 'Todas']];
    if (units.some(u => u.rec === 0)) opt.push(['0', 'Loft']);
    [1, 2].forEach(r => { if (units.some(u => u.rec === r)) opt.push([String(r), r + ' rec']); });
    if (units.some(u => u.rec >= 3)) opt.push(['3', '3+ rec']);
    return opt.map(([v, l]) => [v, l, v === '' ? units.length : units.filter(u => v === '3' ? u.rec >= 3 : u.rec === +v).length]);
  }, [units]);
  const showCol = useMemo(() => ({
    estac: units.some(u => u.n_estac > 0), balcon: units.some(u => u.balcon_m2 > 0),
    terraza: units.some(u => u.terraza_m2 > 0), roof: units.some(u => u.roof_m2 > 0),
  }), [units]);
  const modelosResumen = useMemo(() => {
    const g = {}; units.forEach(u => { const k = u.prototipo || '—'; (g[k] = g[k] || []).push(u); });
    return Object.entries(g).map(([p, us]) => ({ p, rec: us[0].rec, m2h: us[0].m2_hab, desde: Math.min(...us.map(u => u.precio || Infinity)), n: us.length }))
      .sort((a, b) => a.desde - b.desde);
  }, [units]);

  function abrirReg(unidad) { setRegUnidad(unidad||null); setUnitSel(null); setShowReg(true); }

  if (d === undefined) return <div className="loading">Cargando…</div>;
  if (d === null) return <div className="loading">No encontrado. <Link href="/portal">Volver</Link></div>;

  const m = meses(d.fecha_entrega);
  const eng = d.esq_enganche ? d.precio_min*d.esq_enganche : null;
  const amen = (d.amenidades||'').split(',').map(s=>s.trim()).filter(Boolean);
  const creds = [['ION',d.credito_ion],['HIR',d.credito_hir],['Yave',d.credito_yave],['Bancario',d.credito_bancario]];
  const waNum = d.whatsapp ? 'https://'+d.whatsapp.replace('https://','').replace('http://','') : null;
  const fichaMap = d.ficha || {};
  const totales = numFicha(fichaMap['Unidades totales']) || d.unidades_totales || null;
  const vendidas = numFicha(fichaMap['Unidades vendidas']);
  const pctVendido = (totales && vendidas != null) ? Math.round(vendidas / totales * 100) : numFicha(fichaMap['% vendido']);
  const creditosOK = FICHA_SCHEMA.find(s => s[0] === 'Créditos aceptados')[1].filter(c => { const v = fichaMap[c]; return v != null && /s[íi]|1|x|acept/i.test(String(v)); });

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <span className="logo"><b>Q</b>Portal de Brokers</span>
        <nav className="nav"><Link href="/portal">← Catálogo</Link></nav>
      </div></header>

      <main className="wrap" style={{paddingBottom:'3rem'}}>
        {/* HERO */}
        <div className="dcover" style={portada
            ? {backgroundImage:`linear-gradient(180deg,rgba(10,10,12,.05),rgba(10,10,12,.55)),url(${portada.url})`,backgroundSize:'cover',backgroundPosition:'center'}
            : {background:'linear-gradient(135deg,hsl(330 45% 24%),hsl(348 55% 40%))'}}>
          <span className="badge2">{d.etapa==='Entrega inmediata'?'Entrega inmediata':(m!=null?`Preventa · entrega en ${m} meses`:'Preventa')}</span>
        </div>
        <div className="dhead">
          <div><h1>{d.nombre}</h1><p className="loc">📍 {d.direccion} · {d.colonia}, {d.alcaldia}, {d.estado}</p></div>
          <div className="pricebox"><span>Precio desde</span><b>{MXN(d.precio_min)}</b><small>hasta {MXN(d.precio_max)}</small></div>
        </div>
        <div className="dactions">
          <button className="btn mag" onClick={()=>setCotizar('dev')}>Cotizar</button>
          <button className="btn lim" onClick={()=>abrirReg(null)}>Registrar cliente</button>
          <button className="btn ghost" onClick={()=>setShowShare(true)}>🔗 Compartir ficha{vistas>0?` · 👁 ${vistas}`:''}</button>
          {waNum && <a className="btn ghost" href={`${waNum}?text=${encodeURIComponent('Hola, me interesa '+d.nombre)}`} target="_blank" rel="noopener">WhatsApp</a>}
          {d.liga_disponibilidad && d.liga_disponibilidad.startsWith('http') && <a className="btn ghost" href={d.liga_disponibilidad} target="_blank" rel="noopener">Sitio oficial</a>}
          {me?.rol==='super_admin' && <button className="btn ghost" onClick={()=>setShowMedios(true)}>🖼️ Gestionar medios</button>}
        </div>

        {/* TABS */}
        <div className="ftabs">
          {[['resumen','Resumen'],['unidades',`Unidades · ${units.length}`],['ficha','Ficha técnica']].map(([k,l])=>
            <button key={k} className={'ftab'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}
        </div>

        {/* ── RESUMEN ── */}
        {tab==='resumen' && <>
          {/* Highlights que venden */}
          <div className="hl">
            <div className="hl-main"><span>Precio desde</span><b>{MXN(d.precio_min)}</b><em>hasta {MXN(d.precio_max)}</em></div>
            <div className="hl-tile"><span>Entrega</span><b>{d.etapa==='Entrega inmediata'?'Inmediata':(m!=null?`${m} meses`:'Preventa')}</b></div>
            <div className="hl-tile"><span>Recámaras</span><b>{d.rec_min===0?'Loft':d.rec_min}–{d.rec_max}</b></div>
            <div className="hl-tile"><span>m² habitables</span><b>{Math.round(d.m2_min)}–{Math.round(d.m2_max)}</b></div>
            <div className="hl-tile lime"><span>Disponibles hoy</span><b>{units.length}</b></div>
          </div>

          {pctVendido != null && pctVendido > 0 && (
            <div className="momentum">
              <div className="momentum-bar"><i style={{width: Math.min(100, pctVendido) + '%'}} /></div>
              <div className="momentum-txt"><b>{pctVendido}% vendido</b>{totales?` · ${totales} unidades en total`:''} · <span className="lim">{units.length} disponibles</span></div>
            </div>
          )}

          {galeria.length>0 ? (
            <div className="galeria big">{galeria.slice(0,6).map(mm=>(
              <a key={mm.id} className="gal-item" href={mm.url} target="_blank" rel="noopener">
                <img src={mm.url} alt={etiquetaMedio(mm)} loading="lazy" />
                <span className="gal-tag">{etiquetaMedio(mm)}</span>
              </a>))}</div>
          ) : me?.rol==='super_admin' && (
            <div className="gal-empty">Aún no hay fotos ni renders. Usa <b>🖼️ Gestionar medios</b> arriba para subir portada, renders, fotos y planos.</div>
          )}

          {modelosResumen.length>0 && <div className="sec"><h2>Modelos disponibles</h2>
            <div className="mstrip">{modelosResumen.map(mm=>(
              <button className="mschip" key={mm.p} onClick={()=>{setTab('unidades');setVistaUni('modelo');}}>
                <b>{mm.p}</b>
                <span>{mm.rec===0?'Loft':mm.rec} rec · {m2(mm.m2h)} m²</span>
                <em>desde {MXN(mm.desde)} · {mm.n} disp.</em>
              </button>))}</div>
          </div>}

          <div className="sec"><h2>Esquema de pago</h2>
            <div className="esq">
              <div><span>Apartado</span><b>{MXN(d.apartado)}</b></div>
              <div><span>Enganche</span><b>{Math.round((d.esq_enganche||0)*100)}%{eng?` · ${MXN(eng)}`:''}</b></div>
              <div><span>Mensualidades en obra</span><b>{Math.round((d.esq_mensualidades||0)*100)}%</b></div>
              <div><span>Contra escritura</span><b>{Math.round((d.esq_escritura||0)*100)}%</b></div>
            </div>
            <div style={{marginTop:'.9rem'}}><button className="btn mag sm" onClick={()=>setCotizar('dev')}>Abrir cotizador completo</button></div>
          </div>

          {amen.length>0 && <div className="sec"><h2>Amenidades</h2>
            <div className="amen-grid">{amen.map((a,i)=><span className="amen" key={i}><i>{amenIcon(a)}</i>{a}</span>)}</div>
          </div>}

          <div className="sec"><h2>Créditos aceptados</h2><div className="chips2">
            {creds.map(([l,v])=><span key={l} className={'chip2 '+(v&&/s/i.test(v)?'on':'off')}>{l}</span>)}
          </div></div>
        </>}

        {/* ── UNIDADES ── */}
        {tab==='unidades' && <>
          {/* Barra de vistas inteligentes */}
          <div className="uvbar">
            <div className="vtoggle" role="tablist">
              <button className={'vt'+(vistaUni==='modelo'?' on':'')} onClick={()=>setVistaUni('modelo')}>🏠 Por modelo</button>
              <button className={'vt'+(vistaUni==='unidad'?' on':'')} onClick={()=>setVistaUni('unidad')}>📋 Por unidad</button>
            </div>
            <div className="uvspacer" />
            <div className="uchips">
              {recChips.map(([v,l,n])=>(
                <button key={v||'all'} className={'uchip'+(fRec===v?' on':'')} onClick={()=>setFRec(v)}>
                  {l}<em>{n}</em>
                </button>
              ))}
              {(showCol.balcon||showCol.terraza||showCol.roof) &&
                <button className={'uchip ext'+(fExt?' on':'')} onClick={()=>setFExt(v=>!v)}>✨ Con exterior</button>}
            </div>
          </div>

          {vistaUni==='modelo'
            ? <ModelosView dev={d} units={uFilt} medios={medios} asesorId={me?.id} onUnit={(u)=>setUnitSel(u)} />
            : (uFilt.length===0
                ? <p className="fnote">Ninguna unidad cumple con el filtro. Ajusta las recámaras o quita “Con exterior”.</p>
                : <div className="utbl-wrap"><table className="utbl utbl2"><thead><tr>
                    <th>Unidad</th><th>Modelo</th><th>Rec</th><th>Baños</th>
                    {showCol.estac && <th>Estac</th>}
                    <th>m² hab</th>
                    {showCol.balcon && <th>Balcón</th>}
                    {showCol.terraza && <th>Terraza</th>}
                    {showCol.roof && <th>Roof</th>}
                    <th className="tr">Precio</th><th></th>
                  </tr></thead><tbody>
                    {uFilt.map(u=>(
                      <tr key={u.sku} onClick={()=>setUnitSel(u)}>
                        <td><b>T{u.torre} · {u.num_depto}</b>{u.nivel?<span className="univ">Nivel {u.nivel}</span>:null}</td>
                        <td>{u.prototipo||'—'}</td>
                        <td>{u.rec===0?'Loft':u.rec}</td><td>{u.banos}</td>
                        {showCol.estac && <td>{u.n_estac||'—'}</td>}
                        <td>{m2(u.m2_hab)}</td>
                        {showCol.balcon && <td>{u.balcon_m2>0?m2(u.balcon_m2):'—'}</td>}
                        {showCol.terraza && <td>{u.terraza_m2>0?m2(u.terraza_m2):'—'}</td>}
                        {showCol.roof && <td>{u.roof_m2>0?m2(u.roof_m2):'—'}</td>}
                        <td className="tr"><b>{MXN(u.precio)}</b></td>
                        <td className="tr"><button className="cotiz-mini" onClick={(e)=>{e.stopPropagation();setUnitSel(u);}}>+ info</button></td>
                      </tr>
                    ))}
                  </tbody></table></div>)}
          <p className="fnote">{vistaUni==='modelo'
            ? 'Toca un modelo para ver sus unidades disponibles, compartir una en específico o abrir su plano y plan de pago.'
            : 'Toca cualquier fila para ver plano, planta ambientada, estacionamiento y plan de pago de esa unidad.'}</p>
        </>}

        {/* ── FICHA TÉCNICA ── */}
        {tab==='ficha' && (() => {
          const secsOrden = FICHA_SCHEMA.slice().sort((a,b)=>{
            const ia=ORDEN_FICHA.indexOf(a[0]), ib=ORDEN_FICHA.indexOf(b[0]);
            return (ia<0?99:ia)-(ib<0?99:ib);
          });
          return (
          <div style={{marginTop:'1rem'}}>
            <div className="ficha-head">
              <div>
                <h2 style={{margin:0}}>Ficha técnica completa</h2>
                <p className="fnote" style={{margin:'.3rem 0 0'}}>Todo el detalle del desarrollo, ordenado por lo que decide una compra.</p>
              </div>
              <label className="vacios-tog">
                <input type="checkbox" checked={verVacios} onChange={e=>setVerVacios(e.target.checked)} />
                Mostrar campos vacíos
              </label>
            </div>

            {creditosOK.length>0 && (
              <div className="fcard cred-card">
                <h3>Créditos aceptados <span className="fcount">{creditosOK.length}</span></h3>
                <div className="cred-grid">{creditosOK.map(c=><span className="cred-ok" key={c}>✓ {c}</span>)}</div>
              </div>
            )}

            <div className="fgrid">
              {secsOrden.filter(([t])=>t!=='Créditos aceptados').map(([titulo,campos])=>{
                const rows = campos.map(c=>[c, fichaMap[c]]).filter(([,v])=> verVacios || (v!=null && v!==''));
                if (rows.length===0) return null;
                const filled = campos.filter(c=>fichaMap[c]!=null && fichaMap[c]!=='').length;
                return (
                  <section className="fcard" key={titulo}>
                    <h3>{titulo} <span className="fcount">{filled}/{campos.length}</span></h3>
                    <div className="kv2">{rows.map(([c,v])=>(
                      <div className="kv2row" key={c}>
                        <span>{c}</span>
                        <b className={(v==null||v==='')?'kv-empty':''}>{(v!=null&&v!=='')?String(v):'—'}</b>
                      </div>
                    ))}</div>
                  </section>
                );
              })}
            </div>
          </div>
          );
        })()}

        {cotizar && <Cotizador dev={d} unidad={cotizar==='dev'?null:cotizar} portadaUrl={portada?.url} onClose={()=>setCotizar(null)} />}
        {unitSel && <UnitDrawer dev={d} unidad={unitSel} medios={medios} asesorId={me?.id} onClose={()=>setUnitSel(null)}
          onCotizar={(u)=>{ setUnitSel(null); setCotizar(u); }}
          onRegistrar={(u)=>abrirReg(u)} />}

        {showReg && (
          <RegistroCliente me={me} dev={d} unidad={regUnidad}
            onClose={() => setShowReg(false)} onDone={() => {}} />
        )}

        {showMedios && (
          <MediosManager dev={d} units={units}
            onClose={() => setShowMedios(false)} onChange={setMedios} />
        )}

        {showShare && (() => {
          const link = typeof window !== 'undefined' ? `${window.location.origin}/f/${sku}?a=${me?.id}` : '';
          const wa = 'https://wa.me/?text=' + encodeURIComponent(`Te comparto la ficha de ${d.nombre}: ${link}`);
          return (
            <>
              <div className="drawer-bg" onClick={() => setShowShare(false)} />
              <aside className="drawer" onClick={e => e.stopPropagation()}>
                <div className="dw-h"><div><span className="dw-tag">Compartir ficha</span><h2>{d.nombre}</h2></div>
                  <button className="x" onClick={() => setShowShare(false)}>✕</button></div>
                <p className="fnote" style={{ marginTop: 0 }}>Link público (sin login), sale con tu marca. Cuando el cliente llena el formulario, el lead cae directo en tu CRM, a tu nombre.</p>
                <div className="share-link">{link}</div>
                <div className="cotiz-actions">
                  <button className="btn lim block" onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } }}>{copiado ? '¡Copiado!' : 'Copiar link'}</button>
                  <a className="btn ghost block" href={wa} target="_blank" rel="noopener">Compartir por WhatsApp</a>
                </div>
                {vistas != null && <div className="share-views">👁 {vistas} {vistas === 1 ? 'vista' : 'vistas'} de esta ficha compartida por ti</div>}
                <p className="fnote">¿El link no sale con tu logo o teléfono? Complétalos en <a onClick={() => router.push('/marca')} style={{ cursor: 'pointer' }}>Mi marca</a>.</p>
              </aside>
            </>
          );
        })()}
      </main>
    </>
  );
}
