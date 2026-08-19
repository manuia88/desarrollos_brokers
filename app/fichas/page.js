'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { construirImport, diffContra } from '../../lib/fichasImport';

export default function CargarFichas() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [fichasActuales, setFichasActuales] = useState(null); // sku -> {nombre, ficha}
  const [items, setItems] = useState(null);      // resultado del parseo
  const [err, setErr] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [res, setRes] = useState(null);
  const [modo, setModo] = useState('excel');   // 'excel' | 'pdf'
  const [token, setToken] = useState('');
  const [pdfDev, setPdfDev] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setToken(session.access_token);
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      if (prof?.rol !== 'super_admin') return;
      const { data } = await supabase.from('desarrollos').select('sku,nombre,ficha');
      const map = {}; (data || []).forEach(d => { map[d.sku] = { nombre: d.nombre, ficha: d.ficha || {} }; });
      setFichasActuales(map);
    })();
  }, [router]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setRes(null); setItems(null); setArchivo(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      // Elige la hoja con la estructura de columnas (la que trae 'Código / SKU').
      let rows = null;
      const pref = wb.SheetNames.find(n => /concentrado/i.test(n)) || wb.SheetNames[0];
      const orden = [pref, ...wb.SheetNames.filter(n => n !== pref)];
      for (const nombre of orden) {
        const r = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null, raw: true });
        if (r.some(row => (row || []).some(c => c != null && String(c).trim() === 'Código / SKU'))) { rows = r; break; }
      }
      if (!rows) { setErr('El archivo no tiene una hoja con la columna "Código / SKU". Sube el Excel con la estructura de columnas (hoja Concentrado).'); return; }
      const out = construirImport(rows);
      if (out.error) { setErr(out.error); return; }
      if (!out.items.length) { setErr('No encontré desarrollos con datos en el archivo.'); return; }
      setItems(out.items);
    } catch (e2) {
      setErr('No pude leer el archivo: ' + (e2?.message || 'error') + '. Debe ser .xlsx.');
    }
  }

  async function onPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pdfDev) { setErr('Primero elige a qué desarrollo pertenece el PDF.'); e.target.value = ''; return; }
    setErr(null); setRes(null); setItems(null); setArchivo(file.name); setPdfBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(bin);
      const r = await fetch('/api/ia/ficha-pdf', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ devSku: pdfDev, pdfBase64 }),
      });
      const j = await r.json();
      if (j.error) { setErr(j.mensaje || j.error); setPdfBusy(false); return; }
      if (!j.campos) { setErr('La IA no encontró campos en ese PDF. Prueba con un documento con más datos.'); setPdfBusy(false); return; }
      const nombre = fichasActuales[pdfDev]?.nombre || pdfDev;
      setItems([{ sku: pdfDev, nombre, ficha: j.ficha, campos: j.campos }]);
    } catch (e2) {
      setErr('No pude procesar el PDF: ' + (e2?.message || 'error'));
    }
    setPdfBusy(false);
  }

  const resumen = useMemo(() => {
    if (!items || !fichasActuales) return null;
    let nuevos = 0, cambian = 0, enBase = 0, fuera = 0;
    const filas = items.map(it => {
      const actual = fichasActuales[it.sku];
      if (!actual) { fuera++; return { ...it, fuera: true }; }
      enBase++;
      const d = diffContra(it, actual.ficha);
      nuevos += d.nuevos; cambian += d.cambian;
      return { ...it, nombreBase: actual.nombre, ...d };
    });
    return { filas, nuevos, cambian, enBase, fuera };
  }, [items, fichasActuales]);

  async function aplicar() {
    if (!resumen) return;
    setAplicando(true); setErr(null);
    const payload = resumen.filas.filter(f => !f.fuera).map(f => ({ sku: f.sku, ficha: f.ficha }));
    const { data, error } = await supabase.rpc('importar_fichas', { p_items: payload });
    setAplicando(false);
    if (error) { setErr(error.message); return; }
    setRes(data);
    // refresca fichas actuales
    const { data: fresh } = await supabase.from('desarrollos').select('sku,nombre,ficha');
    const map = {}; (fresh || []).forEach(d => { map[d.sku] = { nombre: d.nombre, ficha: d.ficha || {} }; });
    setFichasActuales(map);
    setItems(null); setArchivo('');
  }

  if (me && me.rol !== 'super_admin') {
    return (<><Nav me={me} current="/fichas" /><main className="wrap"><div className="loading">Solo para super administradores.</div></main></>);
  }
  if (!me || fichasActuales === null) return <div className="loading">Cargando…</div>;

  return (
    <>
      <Nav me={me} current="/fichas" logo="Cargar fichas técnicas" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Cargar fichas técnicas</h1>
          <p>Llena las fichas automáticamente: sube el <b>Excel estructurado</b> (extracción exacta) o el <b>PDF del desarrollador</b> y deja que la IA lo lea. En ambos casos te muestro qué va a cambiar antes de aplicar.</p>
        </div>

        {res && (
          <div className="msg ok" style={{ marginBottom: '1rem' }}>
            ✓ Listo: actualicé <b>{res.actualizados}</b> desarrollo{res.actualizados === 1 ? '' : 's'} con <b>{res.campos}</b> campos.
            {res.no_encontrados?.length ? <> No encontré en la base: {res.no_encontrados.join(', ')}.</> : null}
          </div>
        )}

        {/* Paso 1: subir */}
        <div className="fcard" style={{ marginBottom: '1rem' }}>
          <div className="vtoggle" style={{ marginBottom: '.9rem' }}>
            <button className={'vt' + (modo === 'excel' ? ' on' : '')} onClick={() => { setModo('excel'); setErr(null); setItems(null); }}>📊 Excel estructurado</button>
            <button className={'vt' + (modo === 'pdf' ? ' on' : '')} onClick={() => { setModo('pdf'); setErr(null); setItems(null); }}>🤖 PDF con IA</button>
          </div>

          {modo === 'excel' ? (
            <>
              <h3 style={{ marginTop: 0 }}>1 · Sube el Excel</h3>
              <label className="upload-box">
                <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
                <span className="upload-ic">📄</span>
                <span>{archivo ? <b>{archivo}</b> : 'Toca para elegir el archivo .xlsx'}</span>
                <span className="upload-hint">Usa la hoja con la estructura de columnas (Concentrado) — SKU, precios, créditos, servicios, etc.</span>
              </label>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>1 · Sube el PDF del desarrollador</h3>
              <p className="fnote" style={{ marginTop: 0 }}>Para brochures o listas de precios en PDF (con texto). La IA lee el documento y llena la ficha del desarrollo que elijas. Usa tu llave de IA conectada en <b>Conexiones</b>.</p>
              <label className="lbl">¿De qué desarrollo es este PDF?</label>
              <select className="inp" value={pdfDev} onChange={e => setPdfDev(e.target.value)}>
                <option value="">Elige el desarrollo…</option>
                {Object.entries(fichasActuales).sort((a, b) => (a[1].nombre || '').localeCompare(b[1].nombre || '')).map(([sku, d]) => <option key={sku} value={sku}>{d.nombre} ({sku})</option>)}
              </select>
              <label className={'upload-box' + (pdfDev ? '' : ' disabled')} style={{ marginTop: '.7rem', opacity: pdfDev ? 1 : .5, pointerEvents: pdfBusy ? 'none' : 'auto' }}>
                <input type="file" accept="application/pdf,.pdf" onChange={onPdf} style={{ display: 'none' }} disabled={!pdfDev || pdfBusy} />
                <span className="upload-ic">{pdfBusy ? '⏳' : '🤖'}</span>
                <span>{pdfBusy ? <b>Leyendo el PDF con IA…</b> : archivo ? <b>{archivo}</b> : 'Toca para elegir el PDF'}</span>
                <span className="upload-hint">{pdfDev ? 'La IA extrae precios, créditos, amenidades, entrega, etc. y te muestra qué cambia antes de aplicar.' : 'Primero elige el desarrollo arriba.'}</span>
              </label>
            </>
          )}
          {err && <div className="msg err" style={{ marginTop: '.8rem' }}>{err}</div>}
        </div>

        {/* Paso 2: previsualización */}
        {resumen && (
          <div className="fcard" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>2 · Revisa qué va a cambiar</h3>
            <div className="imp-stats">
              <div><span>Desarrollos</span><b>{resumen.enBase}</b></div>
              <div className="lime"><span>Campos nuevos</span><b>{resumen.nuevos}</b></div>
              <div className="amber"><span>Campos que cambian</span><b>{resumen.cambian}</b></div>
              {resumen.fuera > 0 && <div className="off"><span>SKU no en base</span><b>{resumen.fuera}</b></div>}
            </div>

            <div className="imp-list">
              {resumen.filas.map(f => (
                <div className={'imp-row' + (f.fuera ? ' fuera' : '')} key={f.sku}>
                  <button className="imp-head" onClick={() => setExpandido(expandido === f.sku ? null : f.sku)}>
                    <div><b>{f.nombreBase || f.nombre}</b> <span className="imp-sku">{f.sku}</span></div>
                    {f.fuera
                      ? <span className="imp-badge off">no está en la base</span>
                      : <span className="imp-badge">{f.nuevos > 0 && <em className="n">+{f.nuevos} nuevos</em>}{f.cambian > 0 && <em className="c">{f.cambian} cambian</em>}{f.nuevos === 0 && f.cambian === 0 && 'sin cambios'}</span>}
                  </button>
                  {expandido === f.sku && !f.fuera && (
                    <div className="imp-detalle">
                      {f.detalle.filter(x => x.tipo !== 'igual').length === 0 ? <p className="fnote">Sin cambios respecto a lo que ya tiene.</p> :
                        f.detalle.filter(x => x.tipo !== 'igual').map((x, i) => (
                          <div className="imp-campo" key={i}>
                            <span className="imp-k">{x.k}</span>
                            {x.tipo === 'nuevo'
                              ? <b className="imp-nuevo">＋ {x.a}</b>
                              : <b className="imp-cambio"><s>{x.de}</s> → {x.a}</b>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="cotiz-actions" style={{ marginTop: '1rem' }}>
              <button className="btn mag block" disabled={aplicando || resumen.nuevos + resumen.cambian === 0} onClick={aplicar}>
                {aplicando ? 'Aplicando…' : `Aplicar a ${resumen.enBase} desarrollo${resumen.enBase === 1 ? '' : 's'}`}
              </button>
              <button className="btn ghost block" onClick={() => { setItems(null); setArchivo(''); }}>Cancelar</button>
            </div>
            <p className="fnote" style={{ marginTop: '.6rem' }}>Solo se llenan los campos de la ficha del desarrollo; el inventario de unidades no se toca. Puedes volver a subir el Excel cuando el desarrollador actualice datos.</p>
          </div>
        )}

        {/* IA / PDF */}
        <div className="fcard imp-ia">
          <h3 style={{ marginTop: 0 }}>Extracción con IA <span className="imp-soon">próximamente</span></h3>
          <p className="fnote" style={{ margin: 0 }}>Para documentos libres del desarrollador (PDF, listas de precios, brochures sin la estructura de columnas), la IA leerá el documento y llenará la ficha automáticamente. Se activa en cuanto conectemos la API de IA en Vercel (con topes de gasto). Para el Excel estructurado, la carga de arriba es más confiable y no tiene costo.</p>
        </div>
      </main>
    </>
  );
}
