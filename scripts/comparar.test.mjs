import assert from 'node:assert/strict';
// Replica exacta de los helpers de copy de comparar (con datos REALES de la BD).
function estacTxt(u){ if(u.n_estac&&u.n_estac>0) return `${u.n_estac} cajón${u.n_estac>1?'es':''}${u.tipo_estac?' · '+u.tipo_estac:''}`; return 'No incluye'; }
function bodegaTxt(u){ if(u.bodega_m2>0) return `Bodega ${u.bodega_m2} m²`; if(u.sku_bodega) return 'Con bodega'; return 'Sin bodega'; }
function entregaInfo(d, hoy){ if(d.etapa==='Entrega inmediata')return{txt:'Inmediata',m:0}; if(!d.fecha_entrega)return{txt:'Preventa',m:9999};
  const x=new Date(d.fecha_entrega+'T12:00'),h=hoy; const m=(x.getFullYear()-h.getFullYear())*12+x.getMonth()-h.getMonth();
  const fecha=x.toLocaleDateString('es-MX',{month:'short',year:'numeric'}); if(m<=0)return{txt:`En entrega (${fecha})`,m:0}; return{txt:`${fecha} · faltan ${m} m`,m}; }

const hoy = new Date('2026-08-22T12:00');
// Datos reales: RC1 (sin cajón) vs Agreda/JM1 (1 cajón Elevautos, y una con bodega)
const rc1 = { n_estac:0, tipo_estac:null, bodega_m2:0, sku_bodega:null };
const agreda = { n_estac:1, tipo_estac:'Elevautos', bodega_m2:0, sku_bodega:null };
const conBodega = { n_estac:1, tipo_estac:'Elevautos', bodega_m2:2.58, sku_bodega:'JM1-0A-N003-B-4' };

assert.equal(estacTxt(rc1), 'No incluye');                          // adiós "—" ambiguo
assert.equal(estacTxt(agreda), '1 cajón · Elevautos');
assert.equal(bodegaTxt(rc1), 'Sin bodega');
assert.equal(bodegaTxt(conBodega), 'Bodega 2.58 m²');

// Entrega: futuro con fecha, no "5 meses" a secas
const eRC = entregaInfo({ etapa:'Preventa', fecha_entrega:'2027-01-28' }, hoy);
const eAG = entregaInfo({ etapa:'Preventa', fecha_entrega:'2027-05-28' }, hoy);
assert.equal(eRC.m, 5); assert.ok(eRC.txt.includes('ene 2027') && eRC.txt.includes('faltan 5'));
assert.equal(eAG.m, 9); assert.ok(eAG.txt.includes('may 2027'));
// Fecha pasada NO se ve como "0 meses" confuso
const ePast = entregaInfo({ etapa:'Preventa', fecha_entrega:'2026-03-15' }, hoy);
assert.equal(ePast.m, 0); assert.ok(ePast.txt.startsWith('En entrega'));
assert.equal(entregaInfo({ etapa:'Entrega inmediata' }, hoy).txt, 'Inmediata');

// Ganador por fila: precio mínimo gana, sin resaltar si todos iguales
function ganadores(vals, best){ const uniq=new Set(vals.map(v=>Math.round(v))); if(uniq.size<=1)return new Set();
  const obj=best==='min'?Math.min(...vals):Math.max(...vals); const g=new Set(); vals.forEach((v,i)=>{if(Math.abs(v-obj)<0.5)g.add(i);}); return g; }
assert.deepEqual([...ganadores([2426226,2413465,3413727],'min')], [1]);   // la 2a es la más barata
assert.deepEqual([...ganadores([48.91,48.91,47.98],'max')], [0,1]);       // empate en m² -> ambas
assert.deepEqual([...ganadores([5.5,5.5,5.5],'max')], []);                // yield igual -> nadie resalta (no es diferenciador)

console.log('cx_check OK ✓ — copy explícito, entrega con fecha, ganador por fila');
