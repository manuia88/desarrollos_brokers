'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import Nav from '../../../components/Nav';
import Cotizador from '../../../components/Cotizador';
import UnitDrawer from '../../../components/UnitDrawer';
import RegistroCliente from '../../../components/RegistroCliente';
import MediosManager from '../../../components/MediosManager';
import ModelosView from '../../../components/ModelosView';
import LocalizadorView from '../../../components/LocalizadorView';
import { similares } from '../../../lib/similares';
import { generarBrochure } from '../../../lib/propuesta';
import { listarMedios, etiquetaMedio, etiquetaOpcional } from '../../../lib/medios';

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

const EST = { disponible:['Disponible','ust-ok'], apartado:['Apartado','ust-ap'], reservado:['Reservado','ust-re'], vendido:['Vendido','ust-vd'] };

export default function Detalle() {
  const { sku } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [d, setD] = useState(undefined);
  const [units, setUnits] = useState([]);
  const [tab, setTab] = useState('desarrollo');
  const [vistaUni, setVistaUni] = useState('modelo'); // 'modelo' | 'unidad'
  const [fRec, setFRec] = useState('');               // '', '0'(loft), '1','2','3'(3+)
  const [fExt, setFExt] = useState(false);            // con balcón/terraza/roof
  const [cotizar, setCotizar] = useState(null);   // null | 'dev' | unidad
  const [unitSel, setUnitSel] = useState(null);   // unidad | null
  const [showReg, setShowReg] = useState(false);
  const [regUnidad, setRegUnidad] = useState(null);
  const [medios, setMedios] = useState([]);
  const [showMedios, setShowMedios] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [vistas, setVistas] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [lb, setLb] = useState(null); // índice de la foto abierta en el visor (carrusel)
  const [allDevs, setAllDevs] = useState([]);   // catálogo para "alternativas parecidas"
  const [brand, setBrand] = useState(null);     // marca del asesor para el brochure
  const [genBro, setGenBro] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      const { data } = await supabase.from('desarrollos').select('*').eq('sku', sku).single();
      setD(data || null);
      const { data: us } = await supabase.from('unidades').select('*').eq('dev_sku', sku).eq('estatus','Disponible').order('torre').order('num_depto');
      setUnits(us || []);
      setMedios(await listarMedios(sku));
      const { count } = await supabase.from('eventos').select('id', { count: 'exact', head: true })
        .eq('tipo', 'vista_ficha').eq('entidad_id', sku).eq('actor', session.user.id);
      setVistas(count || 0);
      // Catálogo para alternativas parecidas.
      const { data: todos } = await supabase.from('desarrollos')
        .select('sku,nombre,alcaldia,estado,colonia,precio_min,precio_max,rec_min,rec_max,etapa,amenidades,portada,publicado')
        .eq('publicado', true);
      setAllDevs(todos || []);
      // Marca del asesor para el brochure (logo, contacto, org).
      const { data: prof2 } = await supabase.from('profiles').select('nombre,telefono,org_id').eq('id', session.user.id).maybeSingle();
      let org = null;
      if (prof2?.org_id) { const { data: o } = await supabase.from('orgs').select('nombre,logo_url').eq('id', prof2.org_id).maybeSingle(); org = o; }
      setBrand({ id: session.user.id, nombre: prof2?.nombre, telefono: prof2?.telefono, org_nombre: org?.nombre, org_logo: org?.logo_url });
    })();
  }, [sku, router]);

  const portada = useMemo(() => medios.find(x => x.tipo === 'portada') || medios.find(x => x.tipo === 'render') || medios.find(x => x.tipo === 'foto'), [medios]);
  const galeria = useMemo(() => {
    const pri = { portada: 0, render: 1, foto: 2, amenidad: 3, planta: 4, plano: 5 };
    return medios.filter(x => IMG_TIPOS.includes(x.tipo)).slice()
      .sort((a, b) => (pri[a.tipo] - pri[b.tipo]) || ((a.orden || 0) - (b.orden || 0)));
  }, [medios]);
  // Visor con teclado: ← → para navegar, Esc para cerrar.
  useEffect(() => {
    if (lb == null) return;
    const onKey = e => {
      if (e.key === 'Escape') setLb(null);
      else if (e.key === 'ArrowRight') setLb(i => (i + 1) % galeria.length);
      else if (e.key === 'ArrowLeft') setLb(i => (i - 1 + galeria.length) % galeria.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb, galeria.length]);

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

  const alternativas = useMemo(() => (d && allDevs.length) ? similares(d, allDevs, 4) : [], [d, allDevs]);

  function abrirReg(unidad) { setRegUnidad(unidad||null); setUnitSel(null); setShowReg(true); }

  async function descargarBrochure() {
    if (!d) return;
    setGenBro(true);
    try {
      const link = (typeof window !== 'undefined' ? window.location.origin : '') + '/f/' + sku + (me?.id ? '?a=' + me.id : '');
      await generarBrochure({ dev: d, units, medios, asesor: brand || {}, link });
    } catch (e) { alert('No se pudo generar el brochure: ' + (e?.message || 'error')); }
    setGenBro(false);
  }

  if (d === undefined) return <div className="loading">Cargando…</div>;
  if (d === null) return <div className="loading">No encontrado. <Link href="/portal">Volver</Link></div>;

  const m = meses(d.fecha_entrega);
  const eng = d.esq_enganche ? d.precio_min*d.esq_enganche : null;
  const amen = (d.amenidades||'').split(',').map(s=>s.trim()).filter(Boolean);
  const waNum = d.whatsapp ? 'https://'+d.whatsapp.replace('https://','').replace('http://','') : null;
  const fichaMap = d.ficha || {};
  const totales = numFicha(fichaMap['Unidades totales']) || d.unidades_totales || null;
  const vendidas = numFicha(fichaMap['Unidades vendidas']);
  const pctVendido = (totales && vendidas != null) ? Math.round(vendidas / totales * 100) : numFicha(fichaMap['% vendido']);

  return (
    <>
      <Nav me={me} current="/portal" />

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
          <a className="btn wa" style={{background:'#25D366',color:'#0a2e18',border:'none',fontWeight:700}} target="_blank" rel="noopener"
             href={'https://wa.me/?text='+encodeURIComponent(`Te comparto ${d.nombre} (${d.colonia}, ${d.alcaldia}) — desde ${MXN(d.precio_min)}:\n${(typeof window!=='undefined'?window.location.origin:'')}/f/${sku}?a=${me?.id||''}&utm_source=broker&utm_medium=whatsapp&utm_campaign=${sku}`)}>
            📲 Enviar al cliente
          </a>
          <button className="btn ghost" onClick={()=>setShowShare(true)}>🔗 Compartir ficha{vistas>0?` · 👁 ${vistas}`:''}</button>
          <button className="btn ghost" onClick={descargarBrochure} disabled={genBro}>{genBro?'Generando…':'⬇ Brochure'}</button>
          {waNum && <a className="btn ghost" href={`${waNum}?text=${encodeURIComponent('Hola, me interesa '+d.nombre)}`} target="_blank" rel="noopener">WhatsApp</a>}
          {d.liga_disponibilidad && d.liga_disponibilidad.startsWith('http') && <a className="btn ghost" href={d.liga_disponibilidad} target="_blank" rel="noopener">Sitio oficial</a>}
          {me?.rol==='super_admin' && <button className="btn ghost" onClick={()=>setShowMedios(true)}>🖼️ Gestionar medios</button>}
        </div>

        {/* TABS */}
        <div className="ftabs">
          {[['desarrollo','El desarrollo'],['unidades',`Departamentos · ${units.length}`]].map(([k,l])=>
            <button key={k} className={'ftab'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}
        </div>

        {/* ── EL DESARROLLO (Resumen + Ficha técnica fusionados, por secciones en orden de importancia) ── */}
        {tab==='desarrollo' && (() => {
          const F = fichaMap;
          const gv = k => { const v = F[k]; return (v==null||v==='') ? null : String(v); };
          const si = v => v!=null && /^\s*s[íi]\b/i.test(String(v).trim());
          const rng = (a,b,suf='') => { const A=(a==null||a===''), B=(b==null||b===''); if(A&&B) return null; if(B||String(a)===String(b)) return `${a}${suf}`; return `${a} – ${b}${suf}`; };
          const dirTxt = gv('Dirección') || d.direccion;
          const mapsQ = encodeURIComponent([dirTxt, d.colonia, d.alcaldia, d.estado].filter(Boolean).join(', '));
          const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapsQ;
          const mapsEmbed = 'https://www.google.com/maps?q=' + mapsQ + '&output=embed';
          const docs = medios.filter(x => !IMG_TIPOS.includes(x.tipo));

          const exteriores = [['Balcón','🌿 Balcón'],['Terraza','☀️ Terraza'],['Roof garden privado','🏙️ Roof garden privado'],['Bodega','📦 Bodega'],['Cuarto de servicio','🧹 Cuarto de servicio']].filter(([k])=>si(F[k])).map(([,l])=>l);
          const equipo = [['Cocina integral','🍳 Cocina integral'],['Barra de cocina','Barra de cocina'],['Canceles de baño','Canceles de baño'],['Clósets / vestidor','Clósets / vestidor'],['Cuarto de lavado','🧺 Cuarto de lavado']].filter(([k])=>si(F[k])).map(([,l])=>l);

          // Créditos: lista corta (Infonavit/FOVISSSTE comunes + Bancario, ION, HIR Casa)
          const CRED = [
            ['Infonavit', ['Crédito Tradicional Infonavit','Infonavit Total','Cofinavit','Unamos Créditos Infonavit','Apoyo Infonavit','Infonavit']],
            ['FOVISSSTE', ['Crédito Tradicional FOVISSSTE','FOVISSSTE para Todos','Pensionados FOVISSSTE','FOVISSSTE']],
            ['Bancario', ['Bancario']], ['ION', ['ION']], ['HIR Casa', ['HIR']],
          ];
          const credAcept = CRED.filter(([label,keys]) => keys.some(k=>si(F[k]))
            || (label==='ION'&&si(d.credito_ion)) || (label==='HIR Casa'&&si(d.credito_hir)) || (label==='Bancario'&&si(d.credito_bancario))).map(x=>x[0]);

          const S = [
            { t:'Precio y pago', icon:'💰', rows:[
              ['Precio', d.precio_min ? (d.precio_min===d.precio_max ? MXN(d.precio_min) : `${MXN(d.precio_min)} – ${MXN(d.precio_max)}`) : gv('Precio a partir de')],
              ['Precio por m²', gv('Precio por m²')],
              ['Apartado', d.apartado ? MXN(d.apartado) : gv('Apartado')],
              ['Enganche', d.esq_enganche ? `${Math.round(d.esq_enganche*100)}%${eng?` · ${MXN(eng)} sobre precio desde`:''}` : gv('Enganche')],
              ['Mensualidades en obra', d.esq_mensualidades ? `${Math.round(d.esq_mensualidades*100)}%` : gv('Mensualidades')],
              ['Contra escritura', d.esq_escritura ? `${Math.round(d.esq_escritura*100)}%` : gv('Escrituración')],
              ['Comisión al broker', d.comision_broker ? `${Math.round(d.comision_broker*100)}%` : gv('Comisión al broker')],
              ['Descuentos', si(F['Descuentos disponibles']) ? 'Sí' : null],
            ], cta:true },
            { t:'Ubicación', icon:'📍', maps:true, rows:[
              ['Dirección', dirTxt],
              ['Colonia', d.colonia || gv('Colonia')],
              ['Alcaldía / Municipio', d.alcaldia || gv('Alcaldía / Municipio')],
              ['Estado', d.estado || gv('Estado')],
              ['Torres', gv('Torre(s)') || d.torres],
            ]},
            { t:'Qué incluye la unidad', icon:'🏠', chips: exteriores.concat(equipo), rows:[
              ['Recámaras', rng(d.rec_min===0?'Loft':d.rec_min, d.rec_min===d.rec_max?'':d.rec_max)],
              ['Baños', rng(d.banos_min, d.banos_min===d.banos_max?'':d.banos_max)],
              ['Estacionamientos', rng(d.estac_min, d.estac_min===d.estac_max?'':d.estac_max)],
              ['m² habitables', d.m2_min!=null ? rng(Math.round(d.m2_min), Math.round(d.m2_min)===Math.round(d.m2_max)?'':Math.round(d.m2_max),' m²') : null],
              ['Tipo de unidad', gv('Tipo (dependiente/independiente)')],
              ['Altura piso a techo', gv('Altura piso a techo')],
            ]},
            { t:'Amenidades y seguridad', icon:'✨', amen: amen, rows:[
              ['Seguridad 24h', si(F['Seguridad 24h'])?'Sí':null],
              ['Acceso controlado', si(F['Acceso controlado'])?'Sí':null],
              ['Elevadores', gv('Elevadores')],
            ]},
            { t:'Disponibilidad y visita', icon:'📊', rows:[
              ['Unidades totales', totales ? String(totales) : null],
              ['Disponibles hoy', String(units.length)],
              ['Vendidas', vendidas!=null ? String(vendidas) : null],
              ['% vendido', pctVendido!=null ? pctVendido+'%' : null],
              ['Niveles del edificio', gv('Niveles del edificio')],
              ['Departamentos por piso', gv('Departamentos por piso')],
              ['Caseta de venta', si(F['Caseta de venta'])?'Sí':null],
              ['Depa muestra', si(F['Depa muestra'])?'Sí':null],
              ['Estacionamiento para clientes', si(F['Estacionamiento para clientes'])?'Sí':null],
            ]},
            { t:'Entrega y obra', icon:'🏗️', rows:[
              ['Etapa', d.etapa || gv('Preventa / En obra / Inmediata')],
              ['Fecha de entrega', d.fecha_entrega ? new Date(d.fecha_entrega+'T12:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'}) : gv('Fecha de entrega')],
              ['Meses para entrega', m!=null ? String(m) : gv('Meses para entrega')],
              ['% avance de obra', gv('% avance de obra')],
              ['Inicio de ventas', gv('Fecha de inicio de ventas')],
            ]},
            { t:'Costos recurrentes y legal', icon:'📄', rows:[
              ['Mantenimiento mensual', gv('Mantenimiento mensual')],
              ['Predial estimado', gv('Predial estimado')],
              ['Gastos de escrituración', gv('Gastos de escrituración estimados')],
              ['Permite Airbnb', si(F['Permite Airbnb'])?'Sí':(F['Permite Airbnb']!=null?'No':null)],
              ['Permite mascotas', si(F['Permite mascotas'])?'Sí':(F['Permite mascotas']!=null?'No':null)],
              ['Régimen de condominio', gv('Régimen de condominio')],
              ['Escrituras listas', si(F['Escrituras listas'])?'Sí':null],
            ]},
            { t:'Servicios e instalaciones', icon:'🔌', rows:[
              ['Agua', gv('Agua (suministro)')],
              ['Agua caliente', gv('Agua caliente')],
              ['Gas', gv('Gas (tipo)')],
              ['Luz (CFE)', gv('Luz (CFE)')],
              ['Planta de emergencia', si(F['Planta de emergencia'])?'Sí':null],
              ['Paneles solares', si(F['Paneles solares'])?'Sí':null],
              ['Drenaje', gv('Drenaje')],
              ['Internet / fibra', gv('Internet / fibra')],
            ]},
            { t:'Construcción y calidad', icon:'🧱', rows:[
              ['Tipo de construcción', gv('Tipo de construcción')],
              ['Sistema constructivo', gv('Sistema constructivo')],
              ['Suelo / cimentación', gv('Suelo / cimentación')],
              ['Zona sísmica', gv('Zona sísmica')],
            ]},
          ];
          const clean = S.map(s=>({ ...s, rows:s.rows.filter(r=>r[1]!=null && r[1]!=='') }))
                         .filter(s=> s.rows.length>0 || (s.chips&&s.chips.length) || (s.amen&&s.amen.length));

          return (<>
          {/* Highlights */}
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
            <div className="galeria big">{galeria.slice(0,5).map((mm,i)=>(
              <button key={mm.id} className="gal-item" onClick={()=>setLb(i)} aria-label="Ver foto">
                <img src={mm.url} alt={etiquetaMedio(mm)} loading="lazy" />
                {etiquetaOpcional(mm) && <span className="gal-tag">{etiquetaOpcional(mm)}</span>}
                {i===4 && galeria.length>5 && <span className="gal-more">+{galeria.length-5}</span>}
              </button>))}</div>
          ) : me?.rol==='super_admin' && (
            <div className="gal-empty">Aún no hay fotos ni renders. Usa <b>🖼️ Gestionar medios</b> arriba para subir portada, renders, fotos y planos.</div>
          )}

          {docs.length>0 && (
            <div className="dl-row">{docs.map(x=><a key={x.id} className="dl-btn" href={x.url} target="_blank" rel="noopener">⬇ {x.titulo||x.tipo||'Material'}</a>)}</div>
          )}

          {/* Jump a departamentos */}
          {modelosResumen.length>0 && <div className="mstrip">{modelosResumen.map(mm=>(
            <button className="mschip" key={mm.p} onClick={()=>{setTab('unidades');setVistaUni('modelo');}}>
              <b>{mm.rec===0?'Loft':`${mm.rec} rec`}</b>
              <span>{m2(mm.m2h)} m²</span>
              <em>desde {MXN(mm.desde)} · {mm.n} disp.</em>
            </button>))}</div>}

          {/* Créditos aceptados (lista corta) */}
          {credAcept.length>0 && (
            <div className="fcard cred-card">
              <h3>Créditos aceptados <span className="fcount">{credAcept.length}</span></h3>
              <div className="cred-grid">{credAcept.map(c=><span className="cred-ok" key={c}>✓ {c}</span>)}</div>
            </div>
          )}

          {/* Secciones (acordeón) */}
          <div className="devsecs">
            {clean.map((s,idx)=>(
              <details className="devsec" key={s.t} open={idx<3}>
                <summary><span className="devsec-ic">{s.icon}</span>{s.t}<span className="devsec-caret">⌄</span></summary>
                <div className="devsec-body">
                  {s.chips&&s.chips.length>0 && <div className="dchips">{s.chips.map(c=><span key={c}>{c}</span>)}</div>}
                  {s.amen&&s.amen.length>0 && <div className="amen-grid">{s.amen.map((a,i)=><span className="amen" key={i}><i>{amenIcon(a)}</i>{a}</span>)}</div>}
                  {s.rows.length>0 && <div className="kv2">{s.rows.map(([l,v])=>(
                    <div className="kv2row" key={l}><span>{l}</span><b>{v}</b></div>
                  ))}</div>}
                  {s.maps && <><div className="fp-map"><iframe title="Mapa" src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer" allowFullScreen /></div><a className="btn ghost sm devsec-maps" href={mapsUrl} target="_blank" rel="noopener">📍 Abrir en Google Maps · Cómo llegar</a></>}
                  {s.cta && <button className="btn mag sm devsec-cta" onClick={()=>setCotizar('dev')}>Abrir cotizador completo</button>}
                </div>
              </details>
            ))}
          </div>

          {/* Alternativas parecidas para tu cliente */}
          {alternativas.length>0 && (
            <div className="alt-sec">
              <h3>Alternativas para tu cliente <span className="fnote" style={{fontWeight:400}}>si este no le cuadra</span></h3>
              <div className="alt-grid">
                {alternativas.map(({dev:a,razones})=>(
                  <button className="alt-card" key={a.sku} onClick={()=>router.push('/portal/'+a.sku)}>
                    <div className="alt-thumb" style={a.portada?{backgroundImage:`url(${a.portada})`}:undefined}>{!a.portada&&<span>🏢</span>}</div>
                    <div className="alt-body">
                      <b>{a.nombre}</b>
                      <span className="alt-loc">📍 {[a.colonia,a.alcaldia].filter(Boolean).join(', ')||a.estado}</span>
                      <span className="alt-precio">desde {MXN(a.precio_min)}</span>
                      <div className="alt-razones">{razones.map(r=><span key={r}>{r}</span>)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          </>);
        })()}

        {/* ── UNIDADES ── */}
        {tab==='unidades' && <>
          {/* Barra de vistas inteligentes */}
          <div className="uvbar">
            <div className="vtoggle" role="tablist">
              <button className={'vt'+(vistaUni==='modelo'?' on':'')} onClick={()=>setVistaUni('modelo')}>🏠 Por modelo</button>
              <button className={'vt'+(vistaUni==='mapa'?' on':'')} onClick={()=>setVistaUni('mapa')}>🗺️ Ubicación</button>
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
            : vistaUni==='mapa'
            ? <LocalizadorView units={uFilt} onUnit={(u)=>setUnitSel(u)} />
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
          {vistaUni!=='mapa' && <p className="fnote">{vistaUni==='modelo'
            ? 'Toca un modelo para ver sus unidades disponibles, compartir una en específico o abrir su plano y plan de pago.'
            : 'Toca cualquier fila para ver plano, planta ambientada, estacionamiento y plan de pago de esa unidad.'}</p>}
        </>}

        {lb!=null && galeria[lb] && (
          <div className="lbx" onClick={()=>setLb(null)}>
            <button className="lbx-x" onClick={()=>setLb(null)} aria-label="Cerrar">✕</button>
            {galeria.length>1 && <button className="lbx-nav prev" onClick={e=>{e.stopPropagation();setLb((lb-1+galeria.length)%galeria.length);}} aria-label="Anterior">‹</button>}
            <figure className="lbx-fig" onClick={e=>e.stopPropagation()}>
              <img src={galeria[lb].url} alt={etiquetaMedio(galeria[lb])} />
              <figcaption>{etiquetaMedio(galeria[lb])} <span>· {lb+1} / {galeria.length}</span></figcaption>
            </figure>
            {galeria.length>1 && <button className="lbx-nav next" onClick={e=>{e.stopPropagation();setLb((lb+1)%galeria.length);}} aria-label="Siguiente">›</button>}
          </div>
        )}

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
