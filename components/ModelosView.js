'use client';
import { useMemo, useState } from 'react';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
const m2 = v => (v == null || v === '') ? '—' : (Math.round(v * 10) / 10);

function agrupar(units) {
  const g = {};
  units.forEach(u => { const k = u.prototipo || 'Sin prototipo'; (g[k] = g[k] || []).push(u); });
  return Object.entries(g).map(([proto, us]) => {
    const s = us.slice().sort((a, b) => (a.precio || 0) - (b.precio || 0))[0];
    return {
      proto, us: us.slice().sort((a, b) => (a.precio || 0) - (b.precio || 0)),
      rec: s.rec, banos: s.banos, n_estac: s.n_estac, m2_hab: s.m2_hab, m2_total: s.m2_total,
      balcon: s.balcon_m2, terraza: s.terraza_m2, roof: s.roof_m2,
      desde: Math.min(...us.map(u => u.precio || Infinity)),
      n: us.length,
    };
  }).sort((a, b) => a.desde - b.desde);
}

export default function ModelosView({ dev, units, medios = [], asesorId, onUnit }) {
  const [sel, setSel] = useState(null);
  const modelos = useMemo(() => agrupar(units), [units]);
  const imgDe = proto =>
    medios.find(x => (x.tipo === 'planta' || x.tipo === 'plano') && x.prototipo === proto) ||
    medios.find(x => x.tipo === 'render' || x.tipo === 'foto' || x.tipo === 'portada');

  if (!modelos.length) return <p className="fnote">Sin unidades que cumplan el filtro.</p>;

  return (
    <>
      <div className="mgrid">
        {modelos.map(mm => {
          const img = imgDe(mm.proto);
          const ext = [mm.balcon > 0 && 'Balcón', mm.terraza > 0 && 'Terraza', mm.roof > 0 && 'Roof garden'].filter(Boolean);
          return (
            <article className="mcard" key={mm.proto} onClick={() => setSel(mm)}>
              <div className="mcard-img">{img ? <img src={img.url} alt={mm.proto} loading="lazy" /> : <div className="mcard-ph">🏙️</div>}
                <span className="mcard-n">{mm.n} disp.</span></div>
              <div className="mcard-body">
                <h4>{mm.proto}</h4>
                <div className="mcard-specs">
                  <span>🛏 {mm.rec === 0 ? 'Loft' : (mm.rec ?? '—')}</span>
                  <span>🛁 {mm.banos ?? '—'}</span>
                  <span>🚗 {mm.n_estac || '—'}</span>
                  <span>📐 {m2(mm.m2_hab)} m²</span>
                </div>
                {ext.length > 0 && <div className="mcard-ext">{ext.map(e => <span key={e}>+ {e}</span>)}</div>}
                <div className="mcard-price"><span>desde</span><b>{MXN(mm.desde)}</b></div>
              </div>
            </article>
          );
        })}
      </div>

      {sel && (() => {
        const img = imgDe(sel.proto);
        const link = u => (typeof window !== 'undefined' && asesorId) ? `${window.location.origin}/f/${dev.sku}?a=${asesorId}&u=${u.sku}` : '';
        return (
          <>
            <div className="drawer-bg" onClick={() => setSel(null)} />
            <aside className="drawer" onClick={e => e.stopPropagation()}>
              <div className="dw-h">
                <div><span className="dw-tag">Modelo</span><h2>{sel.proto}</h2>
                  <div className="ud-sub">🛏 {sel.rec === 0 ? 'Loft' : sel.rec} · 🛁 {sel.banos} · 🚗 {sel.n_estac || '—'} · 📐 {m2(sel.m2_hab)} m² hab · {m2(sel.m2_total)} m² tot</div></div>
                <button className="x" onClick={() => setSel(null)}>✕</button>
              </div>
              {img && <img className="ud-img" src={img.url} alt={sel.proto} style={{ marginBottom: '.9rem' }} />}
              <div className="mdrawer-desde"><span>Desde</span><b>{MXN(sel.desde)}</b><em>{sel.n} disponibles</em></div>
              <h3 className="mdrawer-h">Unidades disponibles</h3>
              <div className="ulist">
                {sel.us.map(u => (
                  <div className="urow" key={u.sku}>
                    <div><b>T{u.torre} · {u.num_depto}</b>{u.nivel ? <span className="urow-piso">Nivel {u.nivel}</span> : null}</div>
                    <div className="urow-price">{MXN(u.precio)}</div>
                    <div className="urow-acts">
                      <button className="cotiz-mini" onClick={() => { setSel(null); onUnit(u); }}>+ info</button>
                      {link(u) && <a className="cotiz-mini" href={'https://wa.me/?text=' + encodeURIComponent(`Depa T${u.torre} ${u.num_depto} de ${dev.nombre}: ${link(u)}`)} target="_blank" rel="noopener">Compartir</a>}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </>
        );
      })()}
    </>
  );
}
