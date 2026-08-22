'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState } from '../../components/ui';
import {
  meses, precioM2, pasaEntrega, ENTREGA_BUCKETS, creditosDe, cabeEnCredito,
  CREDITOS, AMENIDADES_CLAVE, VISTAS, PERSONAS, fitScore, mensualidadHipoteca, ingresoMinimo, parseConsulta,
  precalifica, yieldEstimado, rentaEstimada, montoFinanciar,
} from '../../lib/matching';
import { guardarCard } from '../../lib/clientcards';
import { generarPropuestaShortlist } from '../../lib/propuesta';
import { track } from '../../lib/track';

const RECS = [['0', 'Loft'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5+']];
const BANOS = [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']];
const CAJONES = [['', 'Cualquiera'], ['1', '1+'], ['2', '2+'], ['3', '3+']];
const COMIS = [['1', '≥ 1%'], ['2', '≥ 2%'], ['3', '≥ 3%'], ['3.5', '≥ 3.5%'], ['4', '≥ 4%'], ['5', '≥ 5%'], ['6', '≥ 6%']];
const nfmt = v => v ? Number(v).toLocaleString('es-MX') : '';   // 3700000 -> 3,700,000
const EXT = [['balcon', '🌿 Balcón'], ['terraza', '☀️ Terraza'], ['roof', '🏙️ Roof privado']];
const PRESUP = [['1500000', '$1.5M'], ['2000000', '$2M'], ['2500000', '$2.5M'], ['3000000', '$3M'], ['3500000', '$3.5M'], ['4000000', '$4M'], ['5000000', '$5M'], ['6000000', '$6M'], ['8000000', '$8M'], ['10000000', '$10M']];
const PRESUP_MIN = [['', 'Sin mínimo'], ['2000000', '$2M'], ['3000000', '$3M'], ['4000000', '$4M'], ['5000000', '$5M']];
const SORTS = [['precio', 'Precio ↑'], ['precio_m2', 'Precio/m² ↑'], ['mensualidad', 'Mensualidad ↑'], ['comision', 'Comisión ↓'], ['entrega', 'Entrega ↑'], ['yield', 'Yield ↓'], ['match', 'Mejor match ↓']];

const F0 = { recs: [], banosMin: '', m2Min: '', m2Max: '', nivelMin: '', nivelMax: '', engancheMax: '', mensMax: '', ext: [], presMax: '', presMin: '', precioM2Min: '', precioM2Max: '', zona: '', colonia: '', entrega: '', cajonesMin: '', bodega: false, amenidades: [], creditos: [], comisionMin: '', yieldMin: '', oportunidad: false, depaMuestra: false, descuento: false, sort: 'precio' };

// Orden en que aflojamos filtros para no llegar a cero resultados.
const RELAJA = [['oportunidad', 'oportunidad de zona'], ['yieldMin', 'yield mínimo'], ['precioM2Max', 'precio/m²'], ['comisionMin', 'comisión'], ['cajonesMin', 'cajones'], ['bodega', 'bodega'], ['amenidades', 'amenidades'], ['descuento', 'promoción'], ['entrega', 'fecha de entrega']];

export default function Buscar() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState(null);
  const [f, setF] = useState(F0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ nombre: '', telefono: '', email: '', notas: '', alertas: true, alertas_canal: 'whatsapp' });
  const [saved, setSaved] = useState(false);
  const [vistas, setVistas] = useState([]);       // vistas propias guardadas
  const [persona, setPersona] = useState(null);
  const [nlq, setNlq] = useState('');             // búsqueda en lenguaje natural
  const [af, setAf] = useState({ ingreso: '', enganche: '', tipo: 'Bancario' });   // capacidad de pago
  const [sel, setSel] = useState([]);             // shortlist de desarrollos (skus)
  const [why, setWhy] = useState(null);           // sku con "¿por qué?" abierto
  const [openUnits, setOpenUnits] = useState(null); // sku con la lista de unidades abierta
  const [vista, setVista] = useState('dev');        // 'dev' | 'unidad'
  const [masOpen, setMasOpen] = useState(false);  // drawer de filtros avanzados
  const [afOpen, setAfOpen] = useState(false);    // panel de capacidad de pago
  const [reanuda, setReanuda] = useState(false);  // restauramos la última búsqueda
  const [brand, setBrand] = useState(null);       // marca del broker (logo, contacto) para la propuesta
  const [genProp, setGenProp] = useState(false);  // generando propuesta PDF

  useEffect(() => { try { setVistas(JSON.parse(localStorage.getItem('qc_vistas') || '[]')); } catch { setVistas([]); } }, []);
  function guardarVista() {
    const nombre = (typeof window !== 'undefined') ? window.prompt('Nombre de la vista (ej. "2 rec Infonavit BJ")') : '';
    if (!nombre) return;
    const next = [...vistas.filter(v => v.nombre !== nombre), { nombre, f }];
    setVistas(next); try { localStorage.setItem('qc_vistas', JSON.stringify(next)); } catch { /* noop */ }
  }
  function aplicarVistaPropia(v) { setF({ ...F0, ...v.f }); }
  function borrarVista(nombre) { const next = vistas.filter(v => v.nombre !== nombre); setVistas(next); try { localStorage.setItem('qc_vistas', JSON.stringify(next)); } catch { /* noop */ } }

  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const toggleArr = (k, v) => setF(o => ({ ...o, [k]: o[k].includes(v) ? o[k].filter(x => x !== v) : [...o[k], v] }));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id,telefono').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      // Marca del broker para la propuesta (logo + contacto). No bloquea la búsqueda.
      (async () => {
        let org = null;
        if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('nombre,logo_url').eq('id', prof.org_id).maybeSingle(); org = o; }
        setBrand({ id: session.user.id, nombre: prof?.nombre, telefono: prof?.telefono, org_nombre: org?.nombre, org_logo: org?.logo_url });
      })();
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('sku,dev_sku,torre,nivel,num_depto,rec,banos,n_estac,m2_hab,m2_total,precio,prototipo,bodega_m2,sku_bodega,tipo_estac,balcon_m2,terraza_m2,roof_m2,estatus').eq('estatus', 'Disponible'),
      ]);
      setDevs(d || []); setUnits(u || []);
      // Restaurar facetas desde la URL (link compartible) o, si no hay, la última búsqueda del broker.
      try {
        const q = new URLSearchParams(window.location.search);
        if ([...q.keys()].length) {
          const next = { ...F0 };
          if (q.get('recs')) next.recs = q.get('recs').split(',');
          if (q.get('ext')) next.ext = q.get('ext').split(',');
          if (q.get('creditos')) next.creditos = q.get('creditos').split(',');
          if (q.get('amenidades')) next.amenidades = q.get('amenidades').split(',');
          ['presMax', 'presMin', 'banosMin', 'm2Min', 'm2Max', 'nivelMin', 'nivelMax', 'engancheMax', 'mensMax', 'precioM2Min', 'precioM2Max', 'yieldMin', 'zona', 'colonia', 'entrega', 'cajonesMin', 'comisionMin', 'sort'].forEach(k => { if (q.get(k)) next[k] = q.get(k); });
          ['bodega', 'oportunidad', 'depaMuestra', 'descuento'].forEach(k => { if (q.get(k) === '1') next[k] = true; });
          setF(next);
        } else {
          const last = JSON.parse(localStorage.getItem('qc_ultima_busqueda') || 'null');
          if (last && typeof last === 'object') { setF({ ...F0, ...last }); setReanuda(true); }
        }
      } catch { /* noop */ }
    })();
  }, [router]);

  const zonas = useMemo(() => devs ? [...new Set(devs.map(d => d.alcaldia).filter(Boolean))].sort() : [], [devs]);
  const colonias = useMemo(() => devs && f.zona ? [...new Set(devs.filter(d => d.alcaldia === f.zona).map(d => d.colonia).filter(Boolean))].sort() : [], [devs, f.zona]);

  // Promedio de precio/m² por colonia (y por alcaldía como respaldo) sobre TODO el
  // mercado — es la referencia para marcar oportunidades (bajo/en línea/sobre la zona).
  const zonaPm2 = useMemo(() => {
    if (!devs || !units) return { col: {}, alc: {} };
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const col = {}, alc = {};
    units.forEach(u => {
      const d = byId[u.dev_sku]; if (!d) return;
      const pm = precioM2(u); if (!pm) return;
      const ck = (d.alcaldia || '') + '|' + (d.colonia || '');
      (col[ck] = col[ck] || []).push(pm);
      if (d.alcaldia) (alc[d.alcaldia] = alc[d.alcaldia] || []).push(pm);
    });
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    const colAvg = {}, alcAvg = {};
    Object.entries(col).forEach(([k, a]) => { colAvg[k] = { avg: avg(a), n: a.length }; });
    Object.entries(alc).forEach(([k, a]) => { alcAvg[k] = { avg: avg(a), n: a.length }; });
    return { col: colAvg, alc: alcAvg };
  }, [devs, units]);

  function baselinePm2(d) {
    const ck = (d.alcaldia || '') + '|' + (d.colonia || '');
    const c = zonaPm2.col[ck];
    if (c && c.n >= 4 && c.avg) return { avg: c.avg, ambito: d.colonia || d.alcaldia };
    const a = zonaPm2.alc[d.alcaldia];
    if (a && a.avg) return { avg: a.avg, ambito: d.alcaldia };
    return null;
  }
  // Señal de precio/m² frente al promedio de su zona.
  function zonaSignal(pm2, d) {
    if (!pm2 || !d) return null;
    const b = baselinePm2(d); if (!b) return null;
    const ratio = pm2 / b.avg, pct = Math.round((ratio - 1) * 100);
    if (ratio <= 0.92) return { cls: 'bajo', icon: '🟢', txt: `${Math.abs(pct)}% bajo ${b.ambito}` };
    if (ratio >= 1.08) return { cls: 'sobre', icon: '🔴', txt: `${pct}% sobre ${b.ambito}` };
    return { cls: 'enlinea', icon: '⚪', txt: `en línea con ${b.ambito}` };
  }

  // Sincroniza la URL (sin recargar) para poder compartir el segmento.
  useEffect(() => {
    if (!devs) return;
    const q = new URLSearchParams();
    if (f.recs.length) q.set('recs', f.recs.join(','));
    if (f.ext.length) q.set('ext', f.ext.join(','));
    if (f.creditos.length) q.set('creditos', f.creditos.join(','));
    if (f.amenidades.length) q.set('amenidades', f.amenidades.join(','));
    ['presMax', 'presMin', 'banosMin', 'm2Min', 'm2Max', 'nivelMin', 'nivelMax', 'engancheMax', 'mensMax', 'precioM2Min', 'precioM2Max', 'yieldMin', 'zona', 'colonia', 'entrega', 'cajonesMin', 'comisionMin'].forEach(k => { if (f[k]) q.set(k, f[k]); });
    if (f.sort !== 'precio') q.set('sort', f.sort);
    ['bodega', 'oportunidad', 'depaMuestra', 'descuento'].forEach(k => { if (f[k]) q.set(k, '1'); });
    const s = q.toString();
    try { window.history.replaceState(null, '', s ? '?' + s : window.location.pathname); } catch { /* noop */ }
    // Recuerda la última búsqueda del broker para reanudarla la próxima vez.
    try { localStorage.setItem('qc_ultima_busqueda', JSON.stringify(f)); } catch { /* noop */ }
  }, [f, devs]);

  const criterios = useMemo(() => ({
    presupuestoMax: +f.presMax || null, presupuestoMin: +f.presMin || null, recs: f.recs,
    zonas: f.zona ? [f.zona] : [], entregaBucket: f.entrega, creditos: f.creditos,
    cajonesMin: +f.cajonesMin || 0, bodega: f.bodega, amenidades: f.amenidades,
  }), [f]);

  function creditoOk(u, d) {
    if (!f.creditos.length) return true;
    const cd = creditosDe(d);
    return f.creditos.some(k => cd.has(k) ||
      ((k === 'infonavit' || k === 'fovissste') && cabeEnCredito(u.precio, d, k === 'infonavit' ? 'Infonavit' : 'FOVISSSTE')));
  }
  function unitPasa(u, d, skip) {
    if (!skip.has('presMax') && f.presMax && u.precio > +f.presMax) return false;
    if (f.presMin && u.precio < +f.presMin) return false;
    if (f.recs.length) { const hit = f.recs.some(r => r === '5' ? u.rec >= 5 : u.rec === +r); if (!hit) return false; }
    if (f.banosMin && (Number(u.banos) || 0) < +f.banosMin) return false;
    if (f.m2Min && (Number(u.m2_hab) || 0) < +f.m2Min) return false;
    if (f.m2Max && (Number(u.m2_hab) || 0) > +f.m2Max) return false;
    if (f.nivelMin || f.nivelMax) {
      const n = Number(u.nivel);
      if (u.nivel == null || u.nivel === '' || isNaN(n)) return false;
      if (f.nivelMin && n < +f.nivelMin) return false;
      if (f.nivelMax && n > +f.nivelMax) return false;
    }
    if (f.engancheMax && (u.precio - montoFinanciar(u.precio, d)) > +f.engancheMax) return false;
    if (f.mensMax && mensualidadHipoteca(u.precio, d) > +f.mensMax) return false;
    // Exteriores con lógica O: si el broker marca balcón y terraza, pasa la unidad que tenga cualquiera.
    if (f.ext.length) {
      const has = { balcon: (u.balcon_m2 || 0) > 0, terraza: (u.terraza_m2 || 0) > 0, roof: (u.roof_m2 || 0) > 0 };
      if (!f.ext.some(k => has[k])) return false;
    }
    if (!skip.has('cajonesMin') && f.cajonesMin && (u.n_estac || 0) < +f.cajonesMin) return false;
    if (!skip.has('bodega') && f.bodega && !((u.bodega_m2 || 0) > 0 || u.sku_bodega)) return false;
    if (!skip.has('precioM2Max') && (f.precioM2Min || f.precioM2Max)) { const pm = precioM2(u); if (pm == null) return false; if (f.precioM2Min && pm < +f.precioM2Min) return false; if (f.precioM2Max && pm > +f.precioM2Max) return false; }
    if (!skip.has('yieldMin') && f.yieldMin) { const y = yieldEstimado(u); if (y == null || y < +f.yieldMin) return false; }
    if (!skip.has('oportunidad') && f.oportunidad) { const s = zonaSignal(precioM2(u), d); if (!s || s.cls !== 'bajo') return false; }
    if (!skip.has('creditos') && !creditoOk(u, d)) return false;
    return true;
  }
  function devPasa(d, skip) {
    if (f.zona && d.alcaldia !== f.zona) return false;
    if (f.colonia && d.colonia !== f.colonia) return false;
    if (!skip.has('entrega') && !pasaEntrega(f.entrega, d)) return false;
    if (!skip.has('comisionMin') && f.comisionMin && (Math.round((d.comision_broker || 0) * 1000) / 10) < +f.comisionMin) return false;
    if (f.depaMuestra && !/s/i.test(d.depa_muestra || '')) return false;
    if (!skip.has('descuento') && f.descuento && !(d.descuentos && String(d.descuentos).trim())) return false;
    if (!skip.has('amenidades') && f.amenidades.length) {
      const am = (d.amenidades || '').toLowerCase();
      if (!f.amenidades.every(a => am.includes(a.toLowerCase()))) return false;
    }
    return true;
  }

  const activo = f.recs.length || f.banosMin || f.m2Min || f.m2Max || f.nivelMin || f.nivelMax || f.engancheMax || f.mensMax || f.ext.length || f.presMax || f.presMin || f.precioM2Min || f.precioM2Max || f.zona || f.colonia || f.entrega || f.cajonesMin || f.bodega || f.amenidades.length || f.creditos.length || f.comisionMin || f.yieldMin || f.oportunidad || f.depaMuestra || f.descuento;
  // Filtros "avanzados" activos (los que viven en el drawer), para el badge de "Más filtros".
  const nAdv = (f.banosMin ? 1 : 0) + (f.m2Min ? 1 : 0) + (f.m2Max ? 1 : 0) + (f.nivelMin || f.nivelMax ? 1 : 0) + (f.engancheMax ? 1 : 0) + (f.mensMax ? 1 : 0) + f.ext.length + (f.cajonesMin ? 1 : 0) + (f.bodega ? 1 : 0) + f.amenidades.length + f.creditos.length + (f.comisionMin ? 1 : 0) + (f.precioM2Min || f.precioM2Max ? 1 : 0) + (f.yieldMin ? 1 : 0) + (f.oportunidad ? 1 : 0) + (f.depaMuestra ? 1 : 0) + (f.descuento ? 1 : 0) + (f.entrega ? 1 : 0) + (f.colonia ? 1 : 0);

  const { grupos, relajado, totalU } = useMemo(() => {
    if (!devs || !units) return { grupos: [], relajado: null, totalU: 0 };
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const run = (skip) => units.filter(u => { const d = byId[u.dev_sku]; return d && devPasa(d, skip) && unitPasa(u, d, skip); });
    let skip = new Set(), ok = run(skip), relajado = null;
    // Anti cero-resultados: afloja el filtro más débil hasta encontrar algo.
    if (ok.length === 0 && activo) {
      for (const [k, label] of RELAJA) {
        if (!f[k] || (Array.isArray(f[k]) && !f[k].length)) continue;
        skip = new Set([...skip, k]); const r = run(skip);
        if (r.length) { ok = r; relajado = label; break; }
      }
    }
    const g = {};
    ok.forEach(u => { const d = byId[u.dev_sku]; const f2 = fitScore(u, d, criterios); const grp = (g[u.dev_sku] = g[u.dev_sku] || { d, us: [], best: 0, bestFac: [] }); grp.us.push({ ...u, _fit: f2.score }); if (f2.score >= grp.best) { grp.best = f2.score; grp.bestFac = f2.factores || []; } });
    let arr = Object.values(g).map(({ d, us, best, bestFac }) => {
      us.sort((a, b) => a.precio - b.precio);
      const min = us[0].precio, max = us[us.length - 1].precio;
      const pms = us.map(precioM2).filter(Boolean);
      const pm2 = pms.length ? Math.min(...pms) : null;
      const ys = us.map(yieldEstimado).filter(x => x != null);
      return {
        d, us, best, bestFac,
        min, max, pm2,
        comPct: Math.round((d.comision_broker || 0) * 100),
        comMonto: d.comision_broker ? Math.round(d.comision_broker * min) : null,
        mens: mensualidadHipoteca(min, d),
        ingreso: ingresoMinimo(min, d),
        m: meses(d.fecha_entrega),
        yld: ys.length ? Math.max(...ys) : null,
        renta: rentaEstimada(us[0]),
        zonaSig: zonaSignal(pm2, d),
      };
    });
    const s = f.sort;
    arr.sort((a, b) =>
      s === 'precio_m2' ? (a.pm2 || 9e9) - (b.pm2 || 9e9) :
      s === 'mensualidad' ? (a.mens || 9e9) - (b.mens || 9e9) :
      s === 'comision' ? (b.comMonto || 0) - (a.comMonto || 0) :
      s === 'entrega' ? (a.m ?? 999) - (b.m ?? 999) :
      s === 'yield' ? (b.yld || 0) - (a.yld || 0) :
      s === 'match' ? b.best - a.best :
      a.min - b.min);
    return { grupos: arr, relajado, totalU: ok.length };
  }, [devs, units, f, criterios, activo]);

  // Lista plana de unidades (para la vista "Por unidad").
  const unidadesFlat = useMemo(() => {
    const arr = grupos.flatMap(g => g.us.map(u => ({ u, d: g.d })));
    const s = f.sort;
    arr.sort((a, b) =>
      s === 'match' ? (b.u._fit || 0) - (a.u._fit || 0) :
      s === 'precio_m2' ? (precioM2(a.u) || 9e9) - (precioM2(b.u) || 9e9) :
      s === 'mensualidad' ? (mensualidadHipoteca(a.u.precio, a.d) || 9e9) - (mensualidadHipoteca(b.u.precio, b.d) || 9e9) :
      s === 'comision' ? ((b.d.comision_broker || 0) * b.u.precio) - ((a.d.comision_broker || 0) * a.u.precio) :
      s === 'entrega' ? (meses(a.d.fecha_entrega) ?? 999) - (meses(b.d.fecha_entrega) ?? 999) :
      s === 'yield' ? (yieldEstimado(b.u) || 0) - (yieldEstimado(a.u) || 0) :
      a.u.precio - b.u.precio);
    return arr;
  }, [grupos, f.sort]);

  // Conteos por faceta (recámaras) respetando los demás filtros.
  const recCounts = useMemo(() => {
    if (!devs || !units) return {};
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const out = {};
    RECS.forEach(([v]) => {
      out[v] = units.filter(u => {
        const d = byId[u.dev_sku]; if (!d || !devPasa(d, new Set())) return false;
        const hit = v === '5' ? u.rec >= 5 : u.rec === +v; if (!hit) return false;
        // aplica los demás filtros de unidad salvo recámaras
        if (f.presMax && u.precio > +f.presMax) return false;
        if (f.cajonesMin && (u.n_estac || 0) < +f.cajonesMin) return false;
        if (f.bodega && !((u.bodega_m2 || 0) > 0 || u.sku_bodega)) return false;
        if (!creditoOk(u, d)) return false;
        return true;
      }).length;
    });
    return out;
  }, [devs, units, f]);

  // Conteos por tiempo de entrega (respetando los demás filtros salvo entrega).
  const entregaCounts = useMemo(() => {
    if (!devs || !units) return {};
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const base = units.filter(u => { const d = byId[u.dev_sku]; return d && devPasa(d, new Set(['entrega'])) && unitPasa(u, d, new Set(['entrega'])); });
    const out = {};
    ENTREGA_BUCKETS.forEach(([v]) => { out[v] = base.filter(u => pasaEntrega(v, byId[u.dev_sku])).length; });
    return out;
  }, [devs, units, f]);

  // Conteos por tipo de crédito (respetando los demás filtros salvo crédito).
  const creditoCounts = useMemo(() => {
    if (!devs || !units) return {};
    const byId = Object.fromEntries(devs.map(d => [d.sku, d]));
    const base = units.filter(u => { const d = byId[u.dev_sku]; return d && devPasa(d, new Set()) && unitPasa(u, d, new Set(['creditos'])); });
    const out = {};
    CREDITOS.forEach(([k]) => {
      out[k] = base.filter(u => { const d = byId[u.dev_sku]; const cd = creditosDe(d); return cd.has(k) || ((k === 'infonavit' || k === 'fovissste') && cabeEnCredito(u.precio, d, k === 'infonavit' ? 'Infonavit' : 'FOVISSSTE')); }).length;
    });
    return out;
  }, [devs, units, f]);

  // Registra la búsqueda (con debounce) para métricas y demanda insatisfecha.
  useEffect(() => {
    if (!activo || !me) return;
    const t = setTimeout(() => track('busqueda', { fuente: 'buscar', criterios: { recs: f.recs, zona: f.zona, presMax: f.presMax, creditos: f.creditos, amenidades: f.amenidades }, resultados: totalU }, me), 1500);
    return () => clearTimeout(t);
  }, [f, totalU, activo]);

  function aplicarVista(v) {
    setF(o => ({ ...F0, sort: v.sort || 'precio', ...v.patch, recs: v.patch.recs || [], creditos: v.patch.creditos || [], amenidades: v.patch.amenidades || [] }));
  }

  // Traduce lenguaje natural a filtros (ej. "2 rec en Coyoacán, hasta 3.7M, Infonavit").
  function aplicarNL(e) {
    if (e) e.preventDefault();
    if (!nlq.trim()) return;
    const { crit } = parseConsulta(nlq, zonas);
    setF(o => ({
      ...o,
      recs: crit.recs && crit.recs.length ? crit.recs : o.recs,
      presMax: crit.presupuestoMax ? String(crit.presupuestoMax) : o.presMax,
      zona: (crit.zonas && crit.zonas[0]) || o.zona,
      creditos: crit.creditos && crit.creditos.length ? crit.creditos : o.creditos,
      amenidades: crit.amenidades && crit.amenidades.length ? crit.amenidades : o.amenidades,
      cajonesMin: crit.cajonesMin ? String(crit.cajonesMin) : o.cajonesMin,
      bodega: crit.bodega != null ? crit.bodega : o.bodega,
      entrega: crit.entregaBucket || o.entrega,
    }));
  }

  // Chips de filtros activos (removibles) para que el broker vea y quite lo aplicado.
  const chipsActivos = useMemo(() => {
    const out = [];
    const recL = { '0': 'Loft', '1': '1 rec', '2': '2 rec', '3': '3+ rec' };
    f.recs.forEach(r => out.push({ k: 'recs:' + r, label: recL[r] || r, clear: () => toggleArr('recs', r) }));
    if (f.banosMin) out.push({ k: 'banos', label: f.banosMin + '+ baños', clear: () => set('banosMin', '') });
    if (f.m2Min) out.push({ k: 'm2min', label: 'desde ' + f.m2Min + ' m²', clear: () => set('m2Min', '') });
    if (f.m2Max) out.push({ k: 'm2max', label: 'hasta ' + f.m2Max + ' m²', clear: () => set('m2Max', '') });
    if (f.nivelMin) out.push({ k: 'nivelMin', label: 'piso desde ' + f.nivelMin, clear: () => set('nivelMin', '') });
    if (f.nivelMax) out.push({ k: 'nivelMax', label: 'piso hasta ' + f.nivelMax, clear: () => set('nivelMax', '') });
    if (f.engancheMax) out.push({ k: 'eng', label: 'enganche ≤ ' + MXN(+f.engancheMax), clear: () => set('engancheMax', '') });
    if (f.mensMax) out.push({ k: 'mens', label: 'mensualidad ≤ ' + MXN(+f.mensMax), clear: () => set('mensMax', '') });
    if (f.presMin) out.push({ k: 'presMin', label: 'desde ' + MXN(+f.presMin), clear: () => set('presMin', '') });
    if (f.presMax) out.push({ k: 'presMax', label: 'hasta ' + MXN(+f.presMax), clear: () => set('presMax', '') });
    if (f.zona) out.push({ k: 'zona', label: f.zona, clear: () => { set('zona', ''); set('colonia', ''); } });
    if (f.colonia) out.push({ k: 'colonia', label: f.colonia, clear: () => set('colonia', '') });
    if (f.entrega) { const el = { inmediata: 'Inmediata', '3': '≤ 3 meses', '6': '≤ 6 meses', '12': '≤ 12 meses', '18': '≤ 18 meses', '24': '≤ 24 meses', '36': '≤ 36 meses', plus36: 'Más de 36' }; out.push({ k: 'entrega', label: el[f.entrega] || 'Entrega', clear: () => set('entrega', '') }); }
    f.creditos.forEach(c => out.push({ k: 'cred:' + c, label: (CREDITOS.find(x => x[0] === c) || [, c])[1], clear: () => toggleArr('creditos', c) }));
    f.ext.forEach(x => out.push({ k: 'ext:' + x, label: (EXT.find(e => e[0] === x) || [, x])[1], clear: () => toggleArr('ext', x) }));
    if (f.cajonesMin) out.push({ k: 'cajones', label: f.cajonesMin + '+ cajón', clear: () => set('cajonesMin', '') });
    if (f.bodega) out.push({ k: 'bodega', label: '📦 Bodega', clear: () => set('bodega', false) });
    f.amenidades.forEach(a => out.push({ k: 'amen:' + a, label: a, clear: () => toggleArr('amenidades', a) }));
    if (f.comisionMin) out.push({ k: 'comision', label: '💰 ≥ ' + f.comisionMin + '%', clear: () => set('comisionMin', '') });
    if (f.precioM2Min) out.push({ k: 'pm2min', label: '≥ ' + MXN(+f.precioM2Min) + '/m²', clear: () => set('precioM2Min', '') });
    if (f.precioM2Max) out.push({ k: 'pm2max', label: '≤ ' + MXN(+f.precioM2Max) + '/m²', clear: () => set('precioM2Max', '') });
    if (f.yieldMin) out.push({ k: 'yield', label: '📈 yield ≥ ' + f.yieldMin + '%', clear: () => set('yieldMin', '') });
    if (f.oportunidad) out.push({ k: 'oport', label: '🟢 Bajo el promedio de zona', clear: () => set('oportunidad', false) });
    if (f.depaMuestra) out.push({ k: 'muestra', label: '🏠 Depa muestra', clear: () => set('depaMuestra', false) });
    if (f.descuento) out.push({ k: 'promo', label: '🔻 Promoción', clear: () => set('descuento', false) });
    return out;
  }, [f]);

  // Capacidad de pago: ingreso + enganche → precio máximo que califica.
  const preAf = useMemo(() => {
    const ing = +af.ingreso || 0, eng = +af.enganche || 0;
    if (!ing) return null;
    return precalifica(ing, eng, af.tipo);
  }, [af]);
  function aplicarPago() {
    if (!preAf) return;
    const k = af.tipo.toLowerCase();
    setF(o => ({ ...o, presMax: String(preAf.maxPrecio), creditos: (af.tipo !== 'Bancario' && !o.creditos.includes(k)) ? [...o.creditos, k] : o.creditos }));
  }

  // Shortlist de desarrollos para armar una propuesta al cliente.
  function toggleSel(sku, e) { if (e) e.stopPropagation(); setSel(s => s.includes(sku) ? s.filter(x => x !== sku) : [...s, sku]); }
  function compartirShortlist() {
    const elegidos = grupos.filter(g => sel.includes(g.d.sku));
    if (!elegidos.length) return;
    const txt = 'Hola, te comparto algunas opciones que te pueden servir:\n\n' + elegidos.map(g =>
      `• ${g.d.nombre} — ${g.d.colonia}, ${g.d.alcaldia}\n  ${g.min === g.max ? MXN(g.min) : MXN(g.min) + '–' + MXN(g.max)} · aprox. ${MXN(g.mens)}/mes`).join('\n\n');
    if (typeof window !== 'undefined') window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  }
  function compararShortlist() { if (sel.length) router.push('/comparar?skus=' + sel.join(',')); }
  async function descargarPropuesta() {
    const elegidos = grupos.filter(g => sel.includes(g.d.sku));
    if (!elegidos.length || genProp) return;
    const cliente = (typeof window !== 'undefined') ? (window.prompt('Nombre del cliente para la propuesta (opcional):') || '') : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const items = elegidos.map(g => ({
      nombre: g.d.nombre, colonia: g.d.colonia, alcaldia: g.d.alcaldia,
      min: g.min, max: g.max, mens: g.mens, pm2: g.pm2,
      rec_min: g.d.rec_min, rec_max: g.d.rec_max, m2_min: g.d.m2_min, m2_max: g.d.m2_max,
      meses: g.m, entrega: g.d.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : null,
    }));
    setGenProp(true);
    try {
      await generarPropuestaShortlist({ asesor: brand || {}, cliente: cliente.trim(), items, link: origin + '/buscar' });
    } catch { /* noop */ }
    setGenProp(false);
  }

  async function onSave() {
    const r = await guardarCard({ ...criterios, ...saveForm });
    if (!r.error) { setSaved(true); setTimeout(() => { setSaveOpen(false); setSaved(false); setSaveForm({ nombre: '', telefono: '', email: '', notas: '', alertas: true, alertas_canal: 'whatsapp' }); }, 1200); }
  }

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  return (
    <>
      <Nav me={me} current="/buscar" />
      <main className="wrap bs-wrap">
        <div className="buscar-intro">
          <h1>¿Qué busca tu cliente?</h1>
          <p>Define sus criterios y te digo qué le queda de {devs.length} desarrollos y {units.length.toLocaleString('es-MX')} unidades — con mensualidad, ingreso mínimo y comisión ya calculados.</p>
        </div>

        {/* Búsqueda en lenguaje natural */}
        <form className="bs-nl" onSubmit={aplicarNL}>
          <span className="bs-nl-ic">🗣️</span>
          <input className="bs-nl-in" value={nlq} onChange={e => setNlq(e.target.value)} placeholder="Dilo como tu cliente: “2 recámaras en Coyoacán, hasta 3.7M, con Infonavit”" />
          <button className="btn lim sm" type="submit">Traducir a filtros</button>
        </form>

        {/* Quick-start: perfil + atajos + mis vistas */}
        <div className="bs-quick">
          <div className="bs-qrow"><span className="bs-qlbl">Perfil</span>
            {PERSONAS.map(p => <button key={p.id} className={'chip' + (persona?.id === p.id ? ' on' : '')} onClick={() => setPersona(persona?.id === p.id ? null : p)}>{p.label}</button>)}
          </div>
          <div className="bs-qrow"><span className="bs-qlbl">Atajos</span>
            {VISTAS.map(v => <button key={v.id} className="chip" onClick={() => aplicarVista(v)}><i className="bs-qic">{v.icon}</i>{v.label}</button>)}
          </div>
          {vistas.length > 0 && (
            <div className="bs-qrow"><span className="bs-qlbl">Mis vistas</span>
              {vistas.map(v => <span key={v.nombre} className="saved-chip"><button onClick={() => aplicarVistaPropia(v)}>{v.nombre}</button><i onClick={() => borrarVista(v.nombre)}>✕</i></span>)}
            </div>
          )}
        </div>
        {persona && <div className="pers-pitch">💡 <b>{persona.label}:</b> {persona.pitch}</div>}

        {/* Tira de inversionista: yield mínimo + oportunidades de zona */}
        {persona?.id === 'inversion' && (
          <div className="bs-inv">
            <span className="bs-inv-h">📈 Modo inversionista</span>
            <div className="bs-inv-f"><label>Yield bruto mínimo</label>
              <div className="bs-money-in sm"><input inputMode="numeric" placeholder="ej. 6" value={f.yieldMin} onChange={e => set('yieldMin', e.target.value.replace(/[^0-9.]/g, ''))} /><span>%</span></div>
            </div>
            <button className={'chip' + (f.oportunidad ? ' on' : '')} onClick={() => set('oportunidad', !f.oportunidad)}>🟢 Solo bajo el promedio de su zona</button>
            <button className={'chip' + (f.sort === 'yield' ? ' on' : '')} onClick={() => set('sort', f.sort === 'yield' ? 'precio' : 'yield')}>Ordenar por yield ↓</button>
            <span className="bs-inv-nota">Renta y yield son estimaciones para orientar; no son valuación.</span>
          </div>
        )}

        {/* Barra compacta: sólo lo esencial (recámaras, presupuesto, zona) */}
        <div className="bs-bar">
          <div className="bs-bar-f"><span className="bs-bar-l">Recámaras</span>
            <div className="bs-chips">{RECS.map(([v, l]) => <span key={v} className={'chip sm' + (f.recs.includes(v) ? ' on' : '')} onClick={() => toggleArr('recs', v)}>{l}</span>)}</div>
          </div>
          <div className="bs-bar-f"><span className="bs-bar-l">Presupuesto</span>
            <div className="bs-money">
              <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Desde" value={nfmt(f.presMin)} onChange={e => set('presMin', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <span className="bs-dash">—</span>
              <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Hasta" value={nfmt(f.presMax)} onChange={e => set('presMax', e.target.value.replace(/[^0-9]/g, ''))} /></div>
            </div>
          </div>
          <div className="bs-bar-f"><span className="bs-bar-l">Zona</span>
            <select value={f.zona} onChange={e => { set('zona', e.target.value); set('colonia', ''); }} className="crit-sel"><option value="">Cualquier alcaldía</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
          </div>
          <div className="bs-bar-act">
            <button className={'btn ghost sm' + (afOpen ? ' bs-on' : '')} onClick={() => setAfOpen(v => !v)}>💳 Por lo que puede pagar</button>
            <button className="btn ghost sm" onClick={() => setMasOpen(true)}>⚙️ Más filtros{nAdv > 0 && <em className="bs-more-n">{nAdv}</em>}</button>
          </div>
        </div>

        {/* Capacidad de pago (oculto por defecto) */}
        {afOpen && (
          <div className="bs-af-bar">
            <span className="bs-af-h">💳 Búscalo por lo que puede pagar:</span>
            <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Ingreso/mes" value={nfmt(af.ingreso)} onChange={e => setAf(a => ({ ...a, ingreso: e.target.value.replace(/[^0-9]/g, '') }))} /></div>
            <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Enganche" value={nfmt(af.enganche)} onChange={e => setAf(a => ({ ...a, enganche: e.target.value.replace(/[^0-9]/g, '') }))} /></div>
            <select className="crit-sel sm" value={af.tipo} onChange={e => setAf(a => ({ ...a, tipo: e.target.value }))}><option>Bancario</option><option>Infonavit</option><option>FOVISSSTE</option></select>
            {preAf && <span className="bs-af-res">→ califica hasta <b>{MXN(preAf.maxPrecio)}</b> · ~{MXN(preAf.pago)}/mes</span>}
            <button className="btn lim sm" disabled={!preAf} onClick={aplicarPago}>Aplicar</button>
          </div>
        )}

        {reanuda && activo && (
          <div className="bs-reanuda">↩️ Retomamos tu última búsqueda. <button onClick={() => { setF(F0); setReanuda(false); }}>Empezar de cero</button></div>
        )}

        {/* RESULTADOS a todo el ancho */}
        <div className="bs-results">
            <div className="bs-results-head">
              <div className="bs-count">
                {activo ? <><b>{totalU}</b> unidad{totalU === 1 ? '' : 'es'} · <b>{grupos.length}</b> desarrollo{grupos.length === 1 ? '' : 's'}</> : 'Elige criterios para ver opciones'}
                {relajado && <span className="relaja"> · aflojé <b>{relajado}</b></span>}
              </div>
              <div className="bs-head-act">
                <div className="bs-toggle">
                  <button className={vista === 'dev' ? 'on' : ''} onClick={() => setVista('dev')}>Desarrollo</button>
                  <button className={vista === 'unidad' ? 'on' : ''} onClick={() => setVista('unidad')}>Unidad</button>
                </div>
                <select value={f.sort} onChange={e => set('sort', e.target.value)} className="crit-sel sm">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                {activo && <button className="btn lim sm" onClick={() => setSaveOpen(true)}>💾 Guardar cliente</button>}
              </div>
            </div>

            {chipsActivos.length > 0 && (
              <div className="bs-active">
                {chipsActivos.map(c => <span key={c.k} className="bs-active-chip" onClick={c.clear}>{c.label} <i>✕</i></span>)}
                <button className="bs-active-clear" onClick={() => setF(F0)}>Limpiar</button>
              </div>
            )}

            {!activo ? (
              <EmptyState icon="🔎" title="Empieza por lo esencial">
                Elige recámaras y presupuesto, escribe la búsqueda en lenguaje natural, o toca un atajo — te muestro las mejores opciones con match %.
              </EmptyState>
            ) : totalU === 0 ? (
              <EmptyState icon="🤔" title="Nada encaja">Sube el presupuesto o quita alguna amenidad con los chips de arriba.</EmptyState>
            ) : vista === 'dev' ? (
              <div className="res-grid bs-grid">
                {grupos.map(({ d, us, best, bestFac, min, max, pm2, comPct, comMonto, mens, ingreso, m, yld, renta, zonaSig }) => {
                  const enSel = sel.includes(d.sku);
                  const inv = persona?.id === 'inversion';
                  return (
                    <article className={'match' + (enSel ? ' sel' : '')} key={d.sku}>
                      <button className={'bs-star' + (enSel ? ' on' : '')} title={enSel ? 'Quitar de la propuesta' : 'Agregar a la propuesta'} onClick={e => toggleSel(d.sku, e)}>{enSel ? '★' : '☆'}</button>
                      <div className="match-body" onClick={() => router.push('/portal/' + d.sku)}>
                        <div className="match-h">
                          <div><h3>{d.nombre}</h3><span className="loc">📍 {d.colonia}, {d.alcaldia}</span></div>
                          {best > 0 && <span className={'fit ' + (best >= 80 ? 'hi' : best >= 55 ? 'mid' : 'lo')}>{best}%</span>}
                        </div>
                        <div className="match-price">{min === max ? MXN(min) : `${MXN(min)} – ${MXN(max)}`}</div>
                        <div className="match-calc">
                          {inv
                            ? <>
                                {yld != null && <span className="lim" title="Yield bruto anual estimado">📈 {yld}% yield</span>}
                                {renta != null && <span title="Renta mensual estimada">🔑 ~{MXN(renta)}/mes renta</span>}
                                {pm2 && <span title="Precio por m² desde">📐 {MXN(pm2)}/m²</span>}
                              </>
                            : <>
                                <span title="Mensualidad hipotecaria estimada">🏦 ~{MXN(mens)}/mes</span>
                                <span title="Ingreso mensual mínimo para calificar">💵 ingreso {MXN(ingreso)}</span>
                                {pm2 && <span title="Precio por m² desde">📐 {MXN(pm2)}/m²</span>}
                              </>}
                          {zonaSig && <span className={'zsig ' + zonaSig.cls} title={'Precio/m² ' + zonaSig.txt}>{zonaSig.icon} {zonaSig.txt}</span>}
                        </div>
                        <div className="match-meta">
                          <span>{d.etapa === 'Entrega inmediata' ? '⚡ Inmediata' : (m != null ? `🕑 ${m} meses` : 'Preventa')}</span>
                          {us.length <= 3 ? <span className="escaso">🔥 Solo {us.length}</span> : <span>🏠 {us.length} disp.</span>}
                          {comMonto ? <span className="lim">💰 {comPct}% · {MXN(comMonto)}</span> : (comPct ? <span className="lim">💰 {comPct}%</span> : null)}
                        </div>
                      </div>
                      {best > 0 && bestFac && bestFac.length > 0 && (
                        <div className="bs-why">
                          <button className="bs-why-t" onClick={() => setWhy(why === d.sku ? null : d.sku)}>{why === d.sku ? '▾' : '▸'} ¿Por qué {best}%?</button>
                          {why === d.sku && <div className="bs-why-list">{bestFac.slice(0, 4).map((fa, i) => <span key={i} className={'bs-fac' + (fa.pts < 0 ? ' neg' : '')}>{fa.pts > 0 ? '+' : ''}{fa.pts} {fa.label}</span>)}</div>}
                        </div>
                      )}
                      <div className="bs-units">
                        <button className="bs-units-t" onClick={() => setOpenUnits(openUnits === d.sku ? null : d.sku)}>{openUnits === d.sku ? '▾' : '▸'} Ver las {us.length} unidad{us.length === 1 ? '' : 'es'} que le quedan</button>
                        {openUnits === d.sku && (
                          <div className="bs-units-list">
                            {us.slice(0, 8).map(u => (
                              <div className="bs-unit" key={u.sku} onClick={() => router.push('/portal/' + d.sku)}>
                                <span className="bs-unit-id">{u.prototipo || u.num_depto || u.sku}{u.torre ? ` · T${u.torre}` : ''}</span>
                                <span className="bs-unit-spec">{u.rec === 0 ? 'Loft' : u.rec + ' rec'}{u.m2_hab ? ` · ${u.m2_hab} m²` : ''}</span>
                                <span className="bs-unit-price">{MXN(u.precio)}</span>
                              </div>
                            ))}
                            {us.length > 8 && <div className="fnote" style={{ margin: '.3rem 0 0' }}>+{us.length - 8} más — ábrelas en el desarrollo</div>}
                          </div>
                        )}
                      </div>
                      <div className="bs-card-act">
                        <button className="cotiz-mini" onClick={e => { e.stopPropagation(); router.push('/portal/' + d.sku); }}>Ver / cotizar</button>
                        <button className="cotiz-mini ghost" onClick={e => toggleSel(d.sku, e)}>{enSel ? '★ En propuesta' : '☆ A propuesta'}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="res-grid bs-grid">
                {unidadesFlat.map(({ u, d }) => {
                  const enSel = sel.includes(d.sku);
                  const fit = u._fit || 0;
                  const inv = persona?.id === 'inversion';
                  const uSig = zonaSignal(precioM2(u), d);
                  const uYld = yieldEstimado(u), uRenta = rentaEstimada(u);
                  return (
                    <article className={'match' + (enSel ? ' sel' : '')} key={u.sku}>
                      <button className={'bs-star' + (enSel ? ' on' : '')} title={enSel ? 'Quitar de la propuesta' : 'Agregar a la propuesta'} onClick={e => toggleSel(d.sku, e)}>{enSel ? '★' : '☆'}</button>
                      <div className="match-body" onClick={() => router.push('/portal/' + d.sku)}>
                        <div className="match-h">
                          <div><h3>{d.nombre}</h3><span className="loc">📍 {d.colonia}, {d.alcaldia}</span></div>
                          {fit > 0 && <span className={'fit ' + (fit >= 80 ? 'hi' : fit >= 55 ? 'mid' : 'lo')}>{fit}%</span>}
                        </div>
                        <div className="bs-uunit">{u.prototipo || u.num_depto || 'Unidad'}{u.torre ? ` · T${u.torre}` : ''}{u.nivel != null && u.nivel !== '' ? ` · Piso ${u.nivel}` : ''}</div>
                        <div className="match-price">{MXN(u.precio)}</div>
                        <div className="match-calc">
                          <span>🛏 {u.rec === 0 ? 'Loft' : u.rec + ' rec'}</span>
                          <span>🛁 {u.banos || '—'}</span>
                          <span>📐 {u.m2_hab || '—'} m²</span>
                        </div>
                        <div className="match-calc">
                          {inv
                            ? <>
                                {uYld != null && <span className="lim" title="Yield bruto anual estimado">📈 {uYld}% yield</span>}
                                {uRenta != null && <span title="Renta mensual estimada">🔑 ~{MXN(uRenta)}/mes</span>}
                              </>
                            : <span title="Mensualidad estimada">🏦 ~{MXN(mensualidadHipoteca(u.precio, d))}/mes</span>}
                          {precioM2(u) && <span>💲 {MXN(precioM2(u))}/m²</span>}
                          {uSig && <span className={'zsig ' + uSig.cls} title={'Precio/m² ' + uSig.txt}>{uSig.icon} {uSig.txt}</span>}
                        </div>
                      </div>
                      <div className="bs-card-act">
                        <button className="cotiz-mini" onClick={e => { e.stopPropagation(); router.push('/portal/' + d.sku); }}>Ver / cotizar</button>
                        <button className="cotiz-mini ghost" onClick={e => toggleSel(d.sku, e)}>{enSel ? '★ En propuesta' : '☆ A propuesta'}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
        </div>

        {/* Barra flotante de shortlist / propuesta */}
        {sel.length > 0 && (
          <div className="bs-shortlist">
            <span className="bs-sl-count">★ {sel.length} para propuesta</span>
            <button className="btn ghost sm" onClick={compararShortlist}>⚖️ Comparar</button>
            <button className="btn ghost sm" onClick={descargarPropuesta} disabled={genProp}>{genProp ? '⏳ Generando…' : '📄 Propuesta con tu marca'}</button>
            <button className="btn lim sm" onClick={compartirShortlist}>📲 Enviar por WhatsApp</button>
            <button className="bs-sl-x" onClick={() => setSel([])} aria-label="Vaciar">✕</button>
          </div>
        )}

        {/* Drawer: filtros avanzados (todo lo que el broker usa a veces) */}
        {masOpen && (
          <>
            <div className="drawer-bg" onClick={() => setMasOpen(false)} />
            <aside className="bs-drawer" onClick={e => e.stopPropagation()}>
              <div className="bs-drawer-h"><h2>⚙️ Más filtros{nAdv > 0 && <em className="bs-more-n">{nAdv}</em>}</h2><button className="x" onClick={() => setMasOpen(false)}>✕</button></div>
              <div className="bs-drawer-body">
                <div className="bs-dsec">🎯 Lo que busca el cliente</div>
                <div className="bs-dgroup"><label>Recámaras</label>
                  <div className="bs-chips">{RECS.map(([v, l]) => <span key={v} className={'chip' + (f.recs.includes(v) ? ' on' : '')} onClick={() => toggleArr('recs', v)}>{l}{recCounts[v] != null && <em className="chip-n">{recCounts[v]}</em>}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Baños</label>
                  <div className="bs-chips">{BANOS.map(([v, l]) => <span key={v} className={'chip' + (f.banosMin === v ? ' on' : '')} onClick={() => set('banosMin', f.banosMin === v ? '' : v)}>{l}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Estacionamientos</label>
                  <div className="bs-chips">{CAJONES.map(([v, l]) => <span key={v} className={'chip' + (f.cajonesMin === v ? ' on' : '')} onClick={() => set('cajonesMin', v)}>{l}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Metros² (habitable)</label>
                  <div className="bs-money">
                    <div className="bs-money-in"><input inputMode="numeric" placeholder="Desde" value={f.m2Min} onChange={e => set('m2Min', e.target.value.replace(/[^0-9]/g, ''))} /><span>m²</span></div>
                    <span className="bs-dash">—</span>
                    <div className="bs-money-in"><input inputMode="numeric" placeholder="Hasta" value={f.m2Max} onChange={e => set('m2Max', e.target.value.replace(/[^0-9]/g, ''))} /><span>m²</span></div>
                  </div>
                </div>
                <div className="bs-dgroup"><label>Nivel / piso</label>
                  <div className="bs-money">
                    <div className="bs-money-in"><input inputMode="numeric" placeholder="Desde" value={f.nivelMin} onChange={e => set('nivelMin', e.target.value.replace(/[^0-9]/g, ''))} /><span>piso</span></div>
                    <span className="bs-dash">—</span>
                    <div className="bs-money-in"><input inputMode="numeric" placeholder="Hasta" value={f.nivelMax} onChange={e => set('nivelMax', e.target.value.replace(/[^0-9]/g, ''))} /><span>piso</span></div>
                  </div>
                  <div className="bs-chips" style={{ marginTop: '.45rem' }}>
                    <span className={'chip sm' + (f.nivelMin === '4' && !f.nivelMax ? ' on' : '')} onClick={() => { set('nivelMin', f.nivelMin === '4' && !f.nivelMax ? '' : '4'); set('nivelMax', ''); }}>🏙️ Alturas (4+)</span>
                    <span className={'chip sm' + (f.nivelMin === '1' && f.nivelMax === '2' ? ' on' : '')} onClick={() => { const on = f.nivelMin === '1' && f.nivelMax === '2'; set('nivelMin', on ? '' : '1'); set('nivelMax', on ? '' : '2'); }}>🚶 Bajos (1–2)</span>
                  </div>
                </div>
                <div className="bs-dgroup"><label>Presupuesto</label>
                  <div className="bs-money">
                    <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Desde" value={nfmt(f.presMin)} onChange={e => set('presMin', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <span className="bs-dash">—</span>
                    <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Hasta" value={nfmt(f.presMax)} onChange={e => set('presMax', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                  </div>
                  <div className="bs-chips" style={{ marginTop: '.45rem' }}>{PRESUP.map(([v, l]) => <span key={v} className={'chip sm' + (f.presMax === v ? ' on' : '')} onClick={() => set('presMax', f.presMax === v ? '' : v)}>≤ {l}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Enganche máximo</label>
                  <div className="bs-money"><div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Sin tope" value={nfmt(f.engancheMax)} onChange={e => set('engancheMax', e.target.value.replace(/[^0-9]/g, ''))} /></div></div>
                </div>
                <div className="bs-dgroup"><label>Mensualidad máxima</label>
                  <div className="bs-money"><div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Sin tope" value={nfmt(f.mensMax)} onChange={e => set('mensMax', e.target.value.replace(/[^0-9]/g, ''))} /><span>/mes</span></div></div>
                </div>
                <div className="bs-dgroup"><label>Alcaldía</label>
                  <select value={f.zona} onChange={e => { set('zona', e.target.value); set('colonia', ''); }} className="crit-sel"><option value="">Cualquier alcaldía</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
                </div>
                {colonias.length > 0 && <div className="bs-dgroup"><label>Colonia</label>
                  <select value={f.colonia} onChange={e => set('colonia', e.target.value)} className="crit-sel"><option value="">Cualquier colonia</option>{colonias.map(z => <option key={z}>{z}</option>)}</select>
                </div>}

                <div className="bs-dsec">🗓️ Entrega y crédito</div>
                <div className="bs-dgroup"><label>Entrega</label>
                  <div className="bs-chips"><span className={'chip' + (f.entrega === '' ? ' on' : '')} onClick={() => set('entrega', '')}>Cualquiera</span>{ENTREGA_BUCKETS.map(([v, l]) => <span key={v} className={'chip' + (f.entrega === v ? ' on' : '') + (entregaCounts[v] === 0 ? ' off' : '')} onClick={() => set('entrega', f.entrega === v ? '' : v)}>{l}{entregaCounts[v] != null && <em className="chip-n">{entregaCounts[v]}</em>}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Crédito</label>
                  <div className="bs-chips">{CREDITOS.map(([k, l]) => <span key={k} className={'chip' + (f.creditos.includes(k) ? ' on' : '') + (creditoCounts[k] === 0 ? ' off' : '')} onClick={() => toggleArr('creditos', k)}>{l}{creditoCounts[k] != null && <em className="chip-n">{creditoCounts[k]}</em>}</span>)}</div>
                </div>

                <div className="bs-dsec">✨ Amenidades y exteriores</div>
                <div className="bs-dgroup"><label>Exteriores</label>
                  <div className="bs-chips">{EXT.map(([v, l]) => <span key={v} className={'chip' + (f.ext.includes(v) ? ' on' : '')} onClick={() => toggleArr('ext', v)}>{l}</span>)}{f.ext.length > 1 && <span className="crit-nota">cualquiera</span>}</div>
                </div>
                <div className="bs-dgroup"><label>Bodega</label>
                  <div className="bs-chips"><span className={'chip' + (f.bodega ? ' on' : '')} onClick={() => set('bodega', !f.bodega)}>📦 Con bodega</span></div>
                </div>
                <div className="bs-dgroup"><label>Amenidades</label>
                  <div className="bs-chips">{AMENIDADES_CLAVE.map(([k, l]) => <span key={k} className={'chip' + (f.amenidades.includes(l) ? ' on' : '')} onClick={() => toggleArr('amenidades', l)}>{l}</span>)}</div>
                </div>

                <div className="bs-dsec">💰 Oportunidad para ti</div>
                <div className="bs-dgroup"><label>Comisión mínima</label>
                  <div className="bs-chips">{COMIS.map(([v, l]) => <span key={v} className={'chip' + (f.comisionMin === v ? ' on' : '')} onClick={() => set('comisionMin', f.comisionMin === v ? '' : v)}>{l}</span>)}</div>
                </div>
                <div className="bs-dgroup"><label>Precio por m²</label>
                  <div className="bs-money">
                    <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Desde" value={nfmt(f.precioM2Min)} onChange={e => set('precioM2Min', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <span className="bs-dash">—</span>
                    <div className="bs-money-in"><span>$</span><input inputMode="numeric" placeholder="Hasta" value={nfmt(f.precioM2Max)} onChange={e => set('precioM2Max', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                  </div>
                </div>
                <div className="bs-dgroup"><label>Yield bruto mínimo <span className="crit-nota">estimado</span></label>
                  <div className="bs-money"><div className="bs-money-in"><input inputMode="numeric" placeholder="Sin mínimo" value={f.yieldMin} onChange={e => set('yieldMin', e.target.value.replace(/[^0-9.]/g, ''))} /><span>%</span></div></div>
                </div>
                <div className="bs-dgroup"><label>Oportunidad de zona</label>
                  <div className="bs-chips"><span className={'chip' + (f.oportunidad ? ' on' : '')} onClick={() => set('oportunidad', !f.oportunidad)}>🟢 Bajo el promedio de su zona</span></div>
                </div>
                <div className="bs-dgroup"><label>Extras</label>
                  <div className="bs-chips"><span className={'chip' + (f.depaMuestra ? ' on' : '')} onClick={() => set('depaMuestra', !f.depaMuestra)}>🏠 Depa muestra</span><span className={'chip' + (f.descuento ? ' on' : '')} onClick={() => set('descuento', !f.descuento)}>🔻 Promoción</span></div>
                </div>
              </div>
              <div className="bs-drawer-foot">
                <button className="btn ghost sm" onClick={() => setF(F0)}>Limpiar todo</button>
                <button className="btn lim" onClick={() => setMasOpen(false)}>Ver {activo ? `${totalU} resultado${totalU === 1 ? '' : 's'}` : 'resultados'}</button>
              </div>
            </aside>
          </>
        )}

        {/* Guardar como client card */}
        {saveOpen && (
          <>
            <div className="drawer-bg" onClick={() => setSaveOpen(false)} />
            <aside className="drawer rc" onClick={e => e.stopPropagation()}>
              <div className="dw-h"><div><span className="dw-tag">Nuevo cliente</span><h2>Guardar esta búsqueda</h2></div><button className="x" onClick={() => setSaveOpen(false)}>✕</button></div>
              <p className="fnote" style={{ marginTop: 0 }}>Guardamos los criterios de tu cliente. Cuando entre o cambie inventario, te avisamos qué le queda (reverse matching) desde <b>Clientes</b>.</p>
              <label className="lbl">Nombre del cliente</label>
              <input className="inp" value={saveForm.nombre} onChange={e => setSaveForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Ej. Laura Méndez" />
              <div className="row2">
                <div><label className="lbl">Teléfono</label><input className="inp" value={saveForm.telefono} onChange={e => setSaveForm(s => ({ ...s, telefono: e.target.value }))} placeholder="55…" /></div>
                <div><label className="lbl">Correo</label><input className="inp" value={saveForm.email} onChange={e => setSaveForm(s => ({ ...s, email: e.target.value }))} placeholder="cliente@correo.com" /></div>
              </div>
              <label className="lbl">Notas</label>
              <textarea className="inp" rows={2} value={saveForm.notas} onChange={e => setSaveForm(s => ({ ...s, notas: e.target.value }))} placeholder="Contexto, urgencia, etc." />
              <div className="crit-resumen">Criterios: {f.recs.length ? f.recs.join('/') + ' rec · ' : ''}{f.presMax ? 'hasta ' + MXN(+f.presMax) + ' · ' : ''}{f.zona || 'cualquier zona'}{f.creditos.length ? ' · ' + f.creditos.join('/') : ''}</div>
              <div className="bs-alerta">
                <label className="bs-alerta-t"><input type="checkbox" checked={saveForm.alertas} onChange={e => setSaveForm(s => ({ ...s, alertas: e.target.checked }))} /> Avísame cuando entre inventario que le quede</label>
                {saveForm.alertas && (
                  <div className="bs-alerta-canal">
                    {[['app', '🔔 En el portal'], ['whatsapp', '📲 WhatsApp'], ['email', '✉️ Correo']].map(([v, l]) =>
                      <span key={v} className={'chip sm' + (saveForm.alertas_canal === v ? ' on' : '')} onClick={() => setSaveForm(s => ({ ...s, alertas_canal: v }))}>{l}</span>)}
                  </div>
                )}
              </div>
              <button className="btn lim block" onClick={onSave} disabled={saved}>{saved ? '✓ Guardado' : 'Guardar cliente'}</button>
            </aside>
          </>
        )}
      </main>
    </>
  );
}
