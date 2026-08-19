'use client';
import { useMemo } from 'react';

const MXN = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');
function nivelNum(n) { const m = String(n || '').match(/\d+/); return m ? +m[0] : 0; }
function hueDe(str) { let h = 0; for (const c of String(str || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

// Planta general: cuadrícula torre × nivel para ubicar cada departamento
// físicamente en el desarrollo. Colorea por prototipo. Clic → detalle de la unidad.
export default function LocalizadorView({ units, onUnit }) {
  const { torres, niveles, celdas, protos } = useMemo(() => {
    const torresSet = new Set(), nivelesSet = new Set(), celdas = {}, protos = {};
    units.forEach(u => {
      const t = u.torre || '—', nv = u.nivel || '—';
      torresSet.add(t); nivelesSet.add(nv);
      const key = t + '|' + nv;
      (celdas[key] = celdas[key] || []).push(u);
      if (u.prototipo && !protos[u.prototipo]) protos[u.prototipo] = { rec: u.rec, hue: hueDe(u.prototipo) };
    });
    const torres = [...torresSet].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
    const niveles = [...nivelesSet].sort((a, b) => nivelNum(b) - nivelNum(a)); // piso alto arriba
    return { torres, niveles, celdas, protos };
  }, [units]);

  if (!units.length) return <p className="fnote">Sin unidades disponibles para ubicar en el mapa.</p>;

  return (
    <div className="loc">
      <div className="loc-legend">
        {Object.entries(protos).sort((a, b) => (a[1].rec - b[1].rec) || a[0].localeCompare(b[0])).map(([p, info]) => (
          <span key={p} className="loc-leg"><i style={{ background: `hsl(${info.hue} 58% 52%)` }} />{info.rec === 0 ? 'Loft' : `${info.rec} rec`} · {p}</span>
        ))}
      </div>
      <div className="loc-grid-wrap">
        <table className="loc-grid">
          <thead><tr><th className="loc-corner">Nivel</th>{torres.map(t => <th key={t}>Torre {t}</th>)}</tr></thead>
          <tbody>
            {niveles.map(nv => (
              <tr key={nv}>
                <th className="loc-niv">{nv}</th>
                {torres.map(t => {
                  const us = celdas[t + '|' + nv] || [];
                  return (
                    <td key={t} className="loc-cell">
                      {us.map(u => {
                        const hue = protos[u.prototipo]?.hue ?? 0;
                        return (
                          <button key={u.sku} className="loc-u"
                            style={{ background: `hsl(${hue} 58% 52% / .2)`, borderColor: `hsl(${hue} 58% 52%)`, color: `hsl(${hue} 65% 72%)` }}
                            onClick={() => onUnit(u)} title={`${u.prototipo || ''} · ${u.rec === 0 ? 'Loft' : u.rec + ' rec'} · ${MXN(u.precio)}`}>
                            {u.num_depto}
                          </button>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fnote">Cada celda es un nivel × torre. Toca un departamento para ver su plano, plan de pago y compartirlo. El color indica el prototipo.</p>
    </div>
  );
}
