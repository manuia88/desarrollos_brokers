'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

// Definición de pasos y campos. type: text|num|pct|money|date|sel|bool|area
const PASOS = [
  ['Generales', [
    ['sku', 'SKU (clave única)', 'text'], ['nombre', 'Nombre del desarrollo', 'text'],
    ['tipo', 'Tipo', 'text'], ['desarrollador', 'Desarrollador', 'text'],
    ['etapa', 'Etapa', 'sel', ['Preventa', 'En obra', 'Entrega inmediata']],
    ['fecha_entrega', 'Fecha de entrega', 'date'],
    ['torres', 'Torres', 'text'], ['unidades_totales', 'Unidades totales', 'num'],
  ]],
  ['Ubicación', [
    ['direccion', 'Dirección', 'text'], ['colonia', 'Colonia', 'text'],
    ['alcaldia', 'Alcaldía / Municipio', 'text'], ['estado', 'Estado', 'text'],
  ]],
  ['Precios y unidad', [
    ['precio_min', 'Precio desde', 'money'], ['precio_max', 'Precio hasta', 'money'],
    ['m2_min', 'm² habitables (mín)', 'num'], ['m2_max', 'm² habitables (máx)', 'num'],
    ['rec_min', 'Recámaras (mín)', 'num'], ['rec_max', 'Recámaras (máx)', 'num'],
    ['banos_min', 'Baños (mín)', 'num'], ['banos_max', 'Baños (máx)', 'num'],
    ['estac_min', 'Estac. (mín)', 'num'], ['estac_max', 'Estac. (máx)', 'num'],
    ['tipo_estac', 'Tipo de estac.', 'text'],
  ]],
  ['Esquema y comisión', [
    ['apartado', 'Apartado', 'money'], ['esq_enganche', 'Enganche (%)', 'pct'],
    ['esq_mensualidades', 'Mensualidades en obra (%)', 'pct'], ['esq_escritura', 'Contra escritura (%)', 'pct'],
    ['comision_broker', 'Comisión al broker (%)', 'pct'],
  ]],
  ['Amenidades y créditos', [
    ['amenidades', 'Amenidades (separadas por coma)', 'area'],
    ['depa_muestra', 'Depa muestra', 'bool'], ['caseta_venta', 'Caseta de venta', 'bool'],
    ['credito_ion', 'Acepta ION', 'bool'], ['credito_hir', 'Acepta HIR', 'bool'],
    ['credito_yave', 'Acepta Yave', 'bool'], ['credito_bancario', 'Acepta Bancario', 'bool'],
    ['descuentos', 'Descuentos / promoción', 'text'],
  ]],
  ['Links y publicar', [
    ['liga_disponibilidad', 'Sitio oficial / disponibilidad', 'text'],
    ['whatsapp', 'WhatsApp (liga)', 'text'], ['notas', 'Notas internas', 'area'],
    ['publicado', 'Publicado (visible para brokers)', 'bool'],
    ['permite_eb', 'Autorizo exportar este inventario a EasyBroker', 'bool'],
    ['permite_portales', 'Autorizo publicarlo en portales inmobiliarios (visible al público)', 'bool'],
  ]],
];
const TODOS = PASOS.flatMap(([, c]) => c.map(f => f[0]));

export default function Captura() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [lista, setLista] = useState([]);
  const [d, setD] = useState({});
  const [paso, setPaso] = useState(0);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [csv, setCsv] = useState(null);
  const [hist, setHist] = useState([]);
  const nuevo = !d._existente;

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      // Super, o director/gerente de una org DESARROLLADOR (dueña de inventario).
      let tipoOrg = null;
      if (prof?.org_id) { const { data: o } = await supabase.from('orgs').select('tipo').eq('id', prof.org_id).maybeSingle(); tipoOrg = o?.tipo; }
      const puede = prof?.rol === 'super_admin' || (tipoOrg === 'desarrollador' && ['director', 'gerente'].includes(prof?.rol));
      if (!puede) { router.replace('/portal'); return; }
      setMe({ id: session.user.id, email: session.user.email, tipoOrg, ...(prof || {}) });
      const { data: devs } = await supabase.from('desarrollos').select('sku,nombre,publicado').order('nombre');
      setLista(devs || []);
    })();
  }, [router]);

  async function cargar(sku) {
    if (!sku) { setD({}); setPaso(0); setMsg(null); setHist([]); setCsv(null); return; }
    const { data } = await supabase.from('desarrollos').select('*').eq('sku', sku).single();
    setD({ ...(data || {}), _existente: true }); setPaso(0); setMsg(null); setCsv(null);
    const { data: ev } = await supabase.from('eventos').select('creado,meta,actor').eq('entidad', 'desarrollo').eq('entidad_id', sku).eq('tipo', 'dev_editado').order('creado', { ascending: false }).limit(8);
    setHist(ev || []);
  }

  // ---- Carga masiva de unidades por CSV ----
  const COLS_CSV = ['sku', 'dev_sku', 'torre', 'num_depto', 'nivel', 'prototipo', 'rec', 'banos', 'n_estac', 'm2_hab', 'm2_total', 'balcon_m2', 'terraza_m2', 'roof_m2', 'precio', 'estatus'];
  function plantillaCSV() {
    const ej = [d.sku ? d.sku + '-101' : 'DEV-101', d.sku || 'DEV', '1', '101', '1', 'Tipo A', '2', '2', '1', '65', '78', '0', '0', '0', '3500000', 'Disponible'];
    const csvTxt = COLS_CSV.join(',') + '\n' + ej.join(',');
    const blob = new Blob(['﻿' + csvTxt], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'plantilla_unidades.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function parseCSV(txt) {
    const lines = txt.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lines.length) return [];
    const head = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(l => {
      const cells = l.split(','); const row = {};
      head.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
      return row;
    });
  }
  async function onCSV(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const txt = await file.text();
    const raw = parseCSV(txt);
    const rows = raw.map(r => {
      const o = {}; COLS_CSV.forEach(k => { if (r[k] !== undefined && r[k] !== '') o[k] = r[k]; });
      if (!o.dev_sku && d.sku) o.dev_sku = d.sku;
      ['torre', 'num_depto', 'nivel', 'rec', 'banos', 'n_estac', 'precio'].forEach(k => { if (o[k] != null) o[k] = Number(String(o[k]).replace(/[^0-9.]/g, '')) || 0; });
      ['m2_hab', 'm2_total', 'balcon_m2', 'terraza_m2', 'roof_m2'].forEach(k => { if (o[k] != null) o[k] = Number(String(o[k]).replace(/[^0-9.]/g, '')) || 0; });
      if (!o.estatus) o.estatus = 'Disponible';
      return o;
    }).filter(o => o.sku && o.dev_sku);
    setCsv({ rows, total: raw.length, ok: rows.length });
    e.target.value = '';
  }
  async function importarCSV() {
    if (!csv?.rows?.length) return;
    const { error } = await supabase.from('unidades').upsert(csv.rows, { onConflict: 'sku' });
    if (error) { setCsv(c => ({ ...c, err: error.message })); return; }
    try { await supabase.from('eventos').insert({ tipo: 'dev_editado', entidad: 'desarrollo', entidad_id: d.sku, actor: me.id, org_id: me.org_id, meta: { accion: 'carga_masiva', unidades: csv.rows.length } }); } catch { /* noop */ }
    setCsv(c => ({ ...c, done: true }));
    cargar(d.sku);
  }

  const pct = useMemo(() => {
    const llenos = TODOS.filter(k => { const v = d[k]; return v != null && v !== '' && v !== false; }).length;
    return Math.round((llenos / TODOS.length) * 100);
  }, [d]);

  const set = (k, v) => setD(o => ({ ...o, [k]: v }));

  async function guardar(publicarAhora) {
    if (!d.sku || !d.nombre) { setMsg({ t: 'err', m: 'SKU y Nombre son obligatorios.' }); setPaso(0); return; }
    setSaving(true); setMsg(null);
    const row = {};
    TODOS.forEach(k => { if (d[k] !== undefined) row[k] = d[k] === '' ? null : d[k]; });
    // normaliza numéricos/porcentajes
    ['precio_min', 'precio_max', 'apartado', 'unidades_totales', 'm2_min', 'm2_max', 'rec_min', 'rec_max', 'banos_min', 'banos_max', 'estac_min', 'estac_max'].forEach(k => { if (row[k] != null && row[k] !== '') row[k] = Number(String(row[k]).replace(/[^0-9.]/g, '')) || null; });
    ['esq_enganche', 'esq_mensualidades', 'esq_escritura', 'comision_broker'].forEach(k => { if (row[k] != null && row[k] !== '') { let n = Number(String(row[k]).replace(/[^0-9.]/g, '')); if (n > 1) n = n / 100; row[k] = n; } });
    ['credito_ion', 'credito_hir', 'credito_yave', 'credito_bancario', 'depa_muestra', 'caseta_venta'].forEach(k => { if (typeof row[k] === 'boolean') row[k] = row[k] ? 'Sí' : 'No'; });
    if (publicarAhora != null) row.publicado = publicarAhora;
    if (me.rol !== 'super_admin' && me.org_id) row.dev_org_id = me.org_id; // el desarrollo pertenece a este desarrollador
    const { error } = await supabase.from('desarrollos').upsert(row, { onConflict: 'sku' });
    setSaving(false);
    if (error) { setMsg({ t: 'err', m: 'No se pudo guardar: ' + error.message }); return; }
    setMsg({ t: 'ok', m: nuevo ? '✓ Desarrollo creado.' : '✓ Cambios guardados.' });
    try { await supabase.from('eventos').insert({ tipo: 'dev_editado', entidad: 'desarrollo', entidad_id: row.sku, actor: me.id, org_id: me.org_id, meta: { accion: nuevo ? 'crear' : 'editar', publicado: row.publicado ?? d.publicado } }); } catch { /* noop */ }
    setD(o => ({ ...o, _existente: true, publicado: publicarAhora != null ? publicarAhora : o.publicado }));
    const { data: devs } = await supabase.from('desarrollos').select('sku,nombre,publicado').order('nombre');
    setLista(devs || []);
    const { data: ev } = await supabase.from('eventos').select('creado,meta,actor').eq('entidad', 'desarrollo').eq('entidad_id', row.sku).eq('tipo', 'dev_editado').order('creado', { ascending: false }).limit(8);
    setHist(ev || []);
  }

  function field([k, label, type, opts]) {
    const v = d[k] ?? '';
    if (type === 'bool') return (
      <label className="cap-bool" key={k}><input type="checkbox" checked={!!d[k] && !/^no$/i.test(String(d[k]))} onChange={e => set(k, e.target.checked)} /> {label}</label>
    );
    if (type === 'sel') return (
      <div className="cap-f" key={k}><label className="lbl">{label}</label>
        <select className="inp" value={v} onChange={e => set(k, e.target.value)}><option value="">—</option>{opts.map(o => <option key={o}>{o}</option>)}</select></div>
    );
    if (type === 'area') return (
      <div className="cap-f wide" key={k}><label className="lbl">{label}</label><textarea className="inp" rows={2} value={v} onChange={e => set(k, e.target.value)} /></div>
    );
    return (
      <div className="cap-f" key={k}><label className="lbl">{label}</label>
        <input className="inp" type={type === 'date' ? 'date' : 'text'} inputMode={['num', 'money', 'pct'].includes(type) ? 'decimal' : undefined}
          value={v} onChange={e => set(k, e.target.value)} placeholder={type === 'money' ? '$' : type === 'pct' ? '% o decimal' : ''} /></div>
    );
  }

  if (!me) return <div className="loading">Cargando…</div>;
  const [titulo, campos] = PASOS[paso];

  return (
    <>
      <Nav me={me} current="/captura" logo="Captura de desarrollos" />
      <main className="wrap">
        <div className="cap-top">
          <div>
            <h1>{nuevo ? 'Nuevo desarrollo' : d.nombre || 'Editar desarrollo'}</h1>
            <p className="fnote" style={{ margin: '.2rem 0 0' }}>Carga o actualiza un desarrollo paso a paso. Guarda cuando quieras — no tienes que llenar todo de una.</p>
          </div>
          <select className="inp cap-pick" value={d.sku || ''} onChange={e => cargar(e.target.value)}>
            <option value="">➕ Nuevo desarrollo</option>
            {lista.map(x => <option key={x.sku} value={x.sku}>{x.nombre}{x.publicado ? '' : ' (borrador)'}</option>)}
          </select>
        </div>

        <div className="cap-prog">
          <div className="cap-prog-bar"><i style={{ width: pct + '%' }} /></div>
          <span>{pct}% completo{d._existente && d.publicado === false ? ' · borrador' : ''}</span>
        </div>

        <div className="cap-steps">
          {PASOS.map(([t], i) => <button key={t} className={'cap-step' + (i === paso ? ' on' : '')} onClick={() => setPaso(i)}>{i + 1}. {t}</button>)}
        </div>

        <section className="sec">
          <h2>{titulo}</h2>
          <div className="cap-grid">{campos.map(field)}</div>
        </section>

        {msg && <div className={'cap-msg ' + msg.t}>{msg.m}</div>}

        <div className="cap-acts">
          <button className="btn ghost" disabled={paso === 0} onClick={() => setPaso(p => Math.max(0, p - 1))}>← Anterior</button>
          {paso < PASOS.length - 1 && <button className="btn ghost" onClick={() => setPaso(p => Math.min(PASOS.length - 1, p + 1))}>Siguiente →</button>}
          <div style={{ flex: 1 }} />
          <button className="btn lim" disabled={saving} onClick={() => guardar(null)}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
          {d.publicado
            ? <button className="btn ghost" disabled={saving} onClick={() => guardar(false)}>Despublicar</button>
            : <button className="btn mag" disabled={saving} onClick={() => guardar(true)}>Publicar</button>}
        </div>
        <p className="fnote">Las 113 columnas de la ficha técnica (servicios, legal, obra, etc.) viven en el detalle de la ficha; este wizard cubre los campos que mueven catálogo y búsqueda. Para fotos y planos usa <b>🖼️ Gestionar medios</b> dentro de la ficha del desarrollo.</p>

        {/* Carga masiva de unidades */}
        <section className="sec" style={{ marginTop: '1.4rem' }}>
          <h2>Carga masiva de unidades (CSV)</h2>
          <p className="fnote" style={{ marginTop: 0 }}>Sube muchas unidades de golpe. Descarga la plantilla, llénala en Excel y súbela — se actualizan por SKU (las que ya existen se sobrescriben).{d.sku ? ` Se asignan al desarrollo ${d.nombre || d.sku} si no traen dev_sku.` : ' Selecciona o crea primero un desarrollo, o incluye la columna dev_sku.'}</p>
          <div className="cap-acts" style={{ marginTop: '.3rem' }}>
            <button className="btn ghost" onClick={plantillaCSV}>⬇ Descargar plantilla</button>
            <label className="btn lim" style={{ cursor: 'pointer' }}>Elegir CSV<input type="file" accept=".csv,text/csv" onChange={onCSV} style={{ display: 'none' }} /></label>
          </div>
          {csv && !csv.done && (
            <div className="csv-prev">
              Detecté <b>{csv.ok}</b> unidad{csv.ok === 1 ? '' : 'es'} válida{csv.ok === 1 ? '' : 's'}{csv.total !== csv.ok ? ` de ${csv.total} filas (las demás sin SKU/dev_sku se ignoran)` : ''}.
              {csv.err ? <div className="cap-msg err" style={{ marginTop: '.6rem' }}>{csv.err}</div> :
                <button className="btn mag sm" style={{ marginLeft: '.6rem' }} onClick={importarCSV} disabled={!csv.ok}>Importar {csv.ok}</button>}
            </div>
          )}
          {csv?.done && <div className="cap-msg ok" style={{ marginTop: '.6rem' }}>✓ Unidades importadas.</div>}
        </section>

        {/* Historial de cambios */}
        {d._existente && hist.length > 0 && (
          <section className="sec">
            <h2>Historial de cambios</h2>
            {hist.map((h, i) => (
              <div className="hist-row" key={i}>
                <span className="calor-dot" />
                <div><b>{h.meta?.accion === 'carga_masiva' ? `Carga masiva (${h.meta?.unidades} unidades)` : h.meta?.accion === 'crear' ? 'Creación' : 'Edición'}</b>
                  {h.meta?.publicado != null && <span className="hist-tag">{h.meta.publicado ? 'publicado' : 'borrador'}</span>}
                  <div className="calor-feed-t">{new Date(h.creado).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
