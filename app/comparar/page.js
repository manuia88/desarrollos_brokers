'use client';
import { tituloDev } from '../../lib/nombre';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { MXN, EmptyState, ErrorCarga } from '../../components/ui';
import { meses, fitScore, parseConsulta, mensualidadHipoteca, ingresoMinimo, precioM2, yieldEstimado, rentaEstimada, creditosDe, CREDITOS } from '../../lib/matching';
import { esquemaPago } from '../../lib/finance';
import { generarPropuestaShortlist } from '../../lib/propuesta';
import { guardarCard } from '../../lib/clientcards';
import { track } from '../../lib/track';

const EJEMPLOS = ['$3.5M, 2 recámaras, Cuauhtémoc, Infonavit', 'Loft entrega inmediata con roof garden', '2 cajones y bodega hasta 6 millones', 'Preventa Benito Juárez 3 recámaras bancario'];
const CRED = Object.fromEntries(CREDITOS);

// --- copy explícito (adiós "—" ambiguo) ---
function estacTxt(u) {
  if (u.n_estac && u.n_estac > 0) return `${u.n_estac} cajón${u.n_estac > 1 ? 'es' : ''}${u.tipo_estac ? ' · ' + u.tipo_estac : ''}`;
  return 'No incluye';
}
function bodegaTxt(u) {
  if (u.bodega_m2 > 0) return `Bodega ${u.bodega_m2} m²`;
  if (u.sku_bodega) return 'Con bodega';
  return 'Sin bodega';
}
// Entrega con fecha real y meses restantes; distingue pasado/inmediata.
function entregaInfo(d) {
  if (d.etapa === 'Entrega inmediata') return { txt: 'Inmediata', m: 0 };
  if (!d.fecha_entrega) return { txt: 'Preventa', m: 9999 };
  const x = new Date(d.fecha_entrega + 'T12:00'), h = new Date();
  const m = (x.getFullYear() - h.getFullYear()) * 12 + x.getMonth() - h.getMonth();
  const fecha = x.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
  if (m <= 0) return { txt: `En entrega (${fecha})`, m: 0 };
  return { txt: `${fecha} · faltan ${m} m`, m };
}
function amenidadesShort(d) {
  const a = (d.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  return a.length ? a.slice(0, 4).join(', ') + (a.length > 4 ? '…' : '') : '—';
}

export default function Comparar() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [brand, setBrand] = useState(null);
  const [devs, setDevs] = useState(null);
  const [units, setUnits] = useState([]);
  const [errCarga, setErrCarga] = useState(false);
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [cmp, setCmp] = useState([]);           // skus a comparar
  const [soloDif, setSoloDif] = useState(false);
  const [genProp, setGenProp] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,telefono,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('nombre,logo_url').eq('id', prof.org_id).maybeSingle(); setBrand({ org_nombre: o?.nombre, org_logo: o?.logo_url }); }
      const [{ data: d, error: e1 }, { data: u, error: e2 }] = await Promise.all([
        supabase.from('desarrollos').select('*').order('nombre'),
        supabase.from('unidades').select('*').eq('estatus', 'Disponible'),
      ]);
      if (e1 || e2) setErrCarga(true);
      setDevs(d || []); setUnits(u || []);
      // Handoff desde Buscar: /comparar?skus=A,B,C precarga la comparación.
      const q = new URLSearchParams(window.location.search).get('skus');
      if (q) setCmp(q.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3));
    })();
  }, [router]);

  const zonas = useMemo(() => devs ? [...new Set(devs.flatMap(d => [d.alcaldia, d.colonia]).filter(Boolean))] : [], [devs]);
  const byId = useMemo(() => Object.fromEntries((devs || []).map(d => [d.sku, d])), [devs]);

  function buscar(q) {
    const txt = q ?? texto;
    if (!txt.trim()) { setConsulta(null); return; }
    setConsulta(parseConsulta(txt, zonas));
  }

  const ranked = useMemo(() => {
    if (!consulta || !devs) return [];
    return units.map(u => { const d = byId[u.dev_sku]; if (!d) return null; const f = fitScore(u, d, consulta.crit); return { u, d, score: f.score, reasons: f.reasons }; })
      .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
  }, [consulta, units, byId, devs]);

  useEffect(() => { if (consulta && me) track('busqueda', { fuente: 'comparar', chips: consulta.chips, criterios: consulta.crit, resultados: ranked.length }, me); }, [consulta]);

  function toggleCmp(sku) { setCmp(c => c.includes(sku) ? c.filter(x => x !== sku) : (c.length >= 3 ? c : [...c, sku])); }
  const comparados = useMemo(() => cmp.map(sku => { const u = units.find(x => x.sku === sku); return u ? { u, d: byId[u.dev_sku] } : null; }).filter(o => o && o.d), [cmp, units, byId]);

  // Filas de comparación: num() da el valor para elegir ganador; best 'min'|'max'.
  const FILAS = useMemo(() => [
    { l: 'Precio', get: o => MXN(o.u.precio), num: o => o.u.precio, best: 'min' },
    { l: 'Mensualidad est.', get: o => '~' + MXN(mensualidadHipoteca(o.u.precio, o.d)) + '/mes', num: o => mensualidadHipoteca(o.u.precio, o.d), best: 'min' },
    { l: 'Ingreso mínimo', get: o => MXN(ingresoMinimo(o.u.precio, o.d)), num: o => ingresoMinimo(o.u.precio, o.d), best: 'min' },
    { l: 'Precio / m²', get: o => { const p = precioM2(o.u); return p ? MXN(p) : '—'; }, num: o => precioM2(o.u) || Infinity, best: 'min' },
    { l: 'Rendimiento (yield)', get: o => { const y = yieldEstimado(o.u); return y != null ? y + '%' : '—'; }, num: o => yieldEstimado(o.u) || 0, best: 'max' },
    { l: 'm² habitables', get: o => o.u.m2_hab ? o.u.m2_hab + ' m²' : '—', num: o => Number(o.u.m2_hab) || 0, best: 'max' },
    { l: 'Recámaras', get: o => o.u.rec === 0 ? 'Loft' : o.u.rec },
    { l: 'Baños', get: o => o.u.banos ?? '—' },
    { l: 'Estacionamiento', get: o => estacTxt(o.u), num: o => o.u.n_estac || 0, best: 'max' },
    { l: 'Bodega', get: o => bodegaTxt(o.u) },
    { l: 'Entrega', get: o => entregaInfo(o.d).txt, num: o => entregaInfo(o.d).m, best: 'min' },
    { l: 'Comisión', get: o => o.d.comision_broker ? Math.round(o.d.comision_broker * 100) + '% · ' + MXN(Math.round(o.d.comision_broker * o.u.precio)) : '—', num: o => o.d.comision_broker ? o.d.comision_broker * o.u.precio : 0, best: 'max' },
    { l: 'Amenidades', get: o => amenidadesShort(o.d) },
    { l: 'Zona', get: o => `${o.d.colonia}, ${o.d.alcaldia}` },
  ], []);

  // Índices ganadores por fila (solo si hay variación real). Devuelve Set de índices.
  function ganadores(fila) {
    if (!fila.best || comparados.length < 2) return new Set();
    const vals = comparados.map(fila.num);
    const uniq = new Set(vals.map(v => Math.round(v)));
    if (uniq.size <= 1) return new Set();                       // todos iguales: no es diferenciador
    const objetivo = fila.best === 'min' ? Math.min(...vals) : Math.max(...vals);
    const g = new Set(); vals.forEach((v, i) => { if (Math.abs(v - objetivo) < 0.5) g.add(i); });
    return g;
  }

  // Insignias por columna: en qué gana cada unidad (para el encabezado).
  const insignias = useMemo(() => {
    const out = comparados.map(() => []);
    const marca = (l, etiqueta) => { const f = FILAS.find(x => x.l === l); if (!f) return; const g = ganadores(f); if (g.size === 1) out[[...g][0]].push(etiqueta); };
    marca('Precio', '⭐ Más barata');
    marca('Rendimiento (yield)', '📈 Mejor rendimiento');
    marca('Entrega', '⚡ Entrega más pronta');
    marca('m² habitables', '📐 Más espacio');
    return out;
  }, [comparados, FILAS]);

  const filasVis = useMemo(() => soloDif ? FILAS.filter(f => new Set(comparados.map(o => f.get(o))).size > 1) : FILAS, [soloDif, FILAS, comparados]);

  // --- cierre en acción ---
  function itemDe(o) {
    const d = o.d, u = o.u;
    const esq = esquemaPago(u.precio, { enganchePct: d.esq_enganche || 0, obraPct: d.esq_mensualidades || 0, escrituraPct: d.esq_escritura || 0, apartado: d.apartado || 0, meses: 0 });
    const ei = entregaInfo(d);
    return {
      nombre: tituloDev(d), colonia: d.colonia, alcaldia: d.alcaldia,
      headline: `${u.rec === 0 ? 'Loft' : u.rec + ' rec'} · ${u.m2_hab} m² · ${estacTxt(u)}`,
      min: u.precio, max: u.precio, pm2: precioM2(u), mens: mensualidadHipoteca(u.precio, d), ingreso: ingresoMinimo(u.precio, d), m: ei.m === 9999 ? null : ei.m,
      entrega: d.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : null,
      rec_min: u.rec, rec_max: u.rec, banos_min: u.banos, banos_max: u.banos,
      estac_min: u.n_estac, estac_max: u.n_estac, m2_min: u.m2_hab, m2_max: u.m2_hab,
      amenidades: (d.amenidades || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12),
      esq: { enganche: esq.enganche, enganchePct: Math.round((d.esq_enganche || 0) * 100), apartado: esq.apartado, mensualidadObra: esq.mensualidadObra, saldoEscritura: esq.saldoEscritura, meses: 0 },
      creditos: [...creditosDe(d)].map(k => CRED[k] || k),
      disponibles: 1,
      descuento: d.descuentos && String(d.descuentos).trim() ? String(d.descuentos).trim() : null,
      reco: { prototipo: u.prototipo, num: u.num_depto, torre: u.torre, nivel: u.nivel, rec: u.rec, banos: u.banos, m2: u.m2_hab, precio: u.precio },
      renta: rentaEstimada(u), yld: yieldEstimado(u), zonaTxt: null,
      porque: [ei.txt, precioM2(u) ? MXN(precioM2(u)) + '/m²' : null].filter(Boolean).join(' · '),
    };
  }

  async function descargarPropuesta() {
    if (comparados.length < 2 || genProp) return;
    setGenProp(true);
    try {
      const cliente = (typeof window !== 'undefined') ? (window.prompt('Nombre del cliente para la propuesta (opcional):') || '') : '';
      await generarPropuestaShortlist({
        cliente, items: comparados.map(itemDe),
        asesor: { nombre: me?.nombre, telefono: me?.telefono, org_nombre: brand?.org_nombre, org_logo: brand?.org_logo },
        titulo: cliente ? `${cliente.split(' ')[0]}, comparé estas opciones para ti` : 'Comparativo de opciones',
      });
      track('propuesta', { fuente: 'comparar', n: comparados.length }, me);
    } catch { setAviso('No se pudo generar la propuesta.'); setTimeout(() => setAviso(''), 3500); }
    setGenProp(false);
  }

  function compartirWA() {
    if (comparados.length < 2) return;
    const txt = 'Hola, te comparto estas opciones lado a lado:\n\n' + comparados.map(o =>
      `• ${tituloDev(o.d)} — T${o.u.torre}·${o.u.num_depto}\n  ${MXN(o.u.precio)} · ~${MXN(mensualidadHipoteca(o.u.precio, o.d))}/mes · ${entregaInfo(o.d).txt}`).join('\n\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    track('compartir', { fuente: 'comparar', canal: 'whatsapp', n: comparados.length }, me);
  }

  async function guardarAlCliente() {
    if (comparados.length < 2) return;
    const nombre = window.prompt('Nombre del cliente:'); if (!nombre?.trim()) return;
    const telefono = window.prompt('Teléfono (opcional):') || '';
    const c = consulta?.crit || {};
    const notas = 'Comparó: ' + comparados.map(o => `${tituloDev(o.d)} T${o.u.torre}·${o.u.num_depto} (${MXN(o.u.precio)})`).join(' · ');
    const r = await guardarCard({
      nombre: nombre.trim(), telefono: telefono.trim() || null,
      presupuestoMin: c.presMin || null, presupuestoMax: c.presMax || null,
      recs: c.recs || [], zonas: c.zona ? [c.zona] : [], creditos: c.creditos || [], notas,
    });
    setAviso(r?.error ? 'No se pudo guardar.' : '✓ Guardado al cliente en tu CRM.');
    setTimeout(() => setAviso(''), 3500);
  }

  if (devs === null) return <div className="loading">Cargando inventario…</div>;

  return (
    <>
      <Nav me={me} current="/comparar" logo="Comparar & Matcher IA" />
      <main className="wrap">
        {errCarga && <ErrorCarga />}
        <div className="buscar-intro">
          <h1>Descríbeme a tu cliente</h1>
          <p>Escríbelo como lo dirías: presupuesto, recámaras, zona, crédito… y te rankeo el inventario por compatibilidad. Luego compara las finalistas lado a lado y cierra con una propuesta.</p>
        </div>

        <div className="mia-box">
          <textarea className="mia-input" rows={2} value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) buscar(); }}
            placeholder="Ej. $3.5M, 2 recámaras en Cuauhtémoc, con Infonavit y un cajón" />
          <button className="btn mag" onClick={() => buscar()}>Buscar matches</button>
        </div>
        <div className="mia-ej">{EJEMPLOS.map(e => <button key={e} className="chip" onClick={() => { setTexto(e); buscar(e); }}>{e}</button>)}</div>

        {consulta && (
          <>
            <div className="mia-entendi">
              <span>Entendí:</span>
              {consulta.chips.length ? consulta.chips.map((c, i) => <span key={i} className="chip on">{c}</span>) : <em className="fnote">No detecté criterios claros — intenta con presupuesto y recámaras.</em>}
            </div>
            {ranked.length === 0 ? <EmptyState icon="🤔" title="Sin coincidencias">Prueba subir el presupuesto o cambiar la zona.</EmptyState> : (
              <div className="mia-list">
                {ranked.map(({ u, d, score }) => (
                  <div className={'mia-row' + (cmp.includes(u.sku) ? ' sel' : '')} key={u.sku}>
                    <span className={'fit ' + (score >= 80 ? 'hi' : score >= 55 ? 'mid' : 'lo')}>{score}%</span>
                    <div className="mia-row-main" onClick={() => router.push('/portal/' + d.sku)}>
                      <b>{tituloDev(d)}</b><span className="mia-row-sub">T{u.torre}·{u.num_depto} · {u.rec === 0 ? 'Loft' : u.rec + ' rec'} · {u.m2_hab} m² · {d.alcaldia}</span>
                    </div>
                    <div className="mia-row-price">{MXN(u.precio)}<em>~{MXN(mensualidadHipoteca(u.precio, d))}/mes</em></div>
                    <button className={'cmp-btn' + (cmp.includes(u.sku) ? ' on' : '')} title={cmp.includes(u.sku) ? 'Quitar de la comparación' : 'Agregar a la comparación'} onClick={() => toggleCmp(u.sku)}>{cmp.includes(u.sku) ? '✓' : '＋'}</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!consulta && comparados.length === 0 && <EmptyState icon="💬" title="Empieza describiendo al cliente">Toca un ejemplo o escribe arriba. Marca 2 o 3 unidades con ＋ para compararlas lado a lado.</EmptyState>}

        {comparados.length >= 2 && (
          <section className="cx">
            <div className="cx-h">
              <h2>Comparación · {comparados.length} unidades</h2>
              <div className="cx-h-acc">
                <span className={'chip sm' + (soloDif ? ' on' : '')} onClick={() => setSoloDif(v => !v)}>Solo diferencias</span>
                <button className="crit-clear" onClick={() => { setCmp([]); setSoloDif(false); }}>Limpiar</button>
              </div>
            </div>

            <div className="cx-scroll">
              <div className="cx-grid" style={{ gridTemplateColumns: `minmax(130px,1fr) repeat(${comparados.length}, minmax(160px,1fr))` }}>
                {/* Encabezados-tarjeta */}
                <div className="cx-corner" />
                {comparados.map((o, i) => (
                  <div className="cx-head" key={o.u.sku}>
                    <button className="cx-x" title="Quitar" onClick={() => toggleCmp(o.u.sku)}>✕</button>
                    <b className="cx-name" onClick={() => router.push('/portal/' + o.d.sku)}>{tituloDev(o.d)}</b>
                    <span className="cx-unit">T{o.u.torre}·{o.u.num_depto}{o.u.prototipo ? ' · ' + o.u.prototipo : ''}</span>
                    <div className="cx-price">{MXN(o.u.precio)}</div>
                    <div className="cx-mens">~{MXN(mensualidadHipoteca(o.u.precio, o.d))}/mes</div>
                    {insignias[i]?.length > 0 && <div className="cx-badges">{insignias[i].map(b => <span key={b} className="cx-badge">{b}</span>)}</div>}
                  </div>
                ))}
                {/* Filas */}
                {filasVis.map(f => {
                  const g = ganadores(f);
                  return (
                    <div className="cx-rowlabel" key={f.l} style={{ gridColumn: '1 / -1', display: 'contents' }}>
                      <div className="cx-lbl">{f.l}</div>
                      {comparados.map((o, i) => (
                        <div className={'cx-cell' + (g.has(i) ? ' win' : '')} key={o.u.sku}>{f.get(o)}{g.has(i) && <span className="cx-tick">✓</span>}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cierre en acción */}
            <div className="cx-actions">
              <button className="btn lim" disabled={genProp} onClick={descargarPropuesta}>{genProp ? 'Generando…' : '📄 Generar propuesta'}</button>
              <button className="btn ghost" onClick={compartirWA}>💬 Compartir por WhatsApp</button>
              <button className="btn ghost" onClick={guardarAlCliente}>💾 Guardar al cliente</button>
              {aviso && <em className="cv-aviso">{aviso}</em>}
            </div>
          </section>
        )}
        {comparados.length === 1 && <p className="fnote">Marca al menos una unidad más con ＋ para comparar lado a lado.</p>}
      </main>
    </>
  );
}
