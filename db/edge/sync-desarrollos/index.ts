// Sync Google Sheets -> Supabase, para TODAS las pestañas del libro.
//  - "Concentrado" (una fila por desarrollo)  -> tabla public.desarrollos
//  - Pestañas por desarrollo (una fila = unidad) -> tabla public.unidades  (upsert por sku)
//
// modo:
//  - 'upsert' (default): sólo crea/actualiza. Se usa en la edición suelta (onEdit): NUNCA borra.
//  - 'espejo': crea/actualiza + BORRA lo que ya no está en la hoja (mirror). Se usa cuando se borra
//              una fila (onChange) o en "Sincronizar TODO". Borrado ACOTADO:
//                * unidades -> sólo dentro del dev de esa pestaña (dev_sku).
//                * desarrollos -> borra los SKU ausentes (la FK cae en cascada a unidades + media).
//
// Auth: header x-sync-secret contra public.sync_config (NUNCA expone el service_role).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============ DESARROLLOS (Concentrado) ============
const RENAME: Record<string,string> = {
  'No. de niveles del edificio':'Niveles del edificio','Suministro (municipal/pozo/pipa)':'Agua (suministro)',
  'Agua caliente (boiler ind./central)':'Agua caliente','Tipo (Natural / Estacionario)':'Gas (tipo)',
  'Suministro (CFE)':'Luz (CFE)','Tipo de suelo / cimentación':'Suelo / cimentación',
  'Comisión al broker (%)':'Comisión al broker','Contacto del desarrollador (tel/WhatsApp)':'Contacto del desarrollador',
  'Descuentos disponibles (sí/no)':'Descuentos disponibles','Seguridad 24h (sí/no)':'Seguridad 24h',
  'Acceso controlado (sí/no)':'Acceso controlado','Elevadores (número)':'Elevadores',
  'Permite Airbnb (sí/no)':'Permite Airbnb','Permite mascotas (sí/no)':'Permite mascotas',
  'Escrituras listas (sí/no)':'Escrituras listas','Estacionamiento a la venta (sí/no)':'Estacionamiento a la venta',
  'Bodega a la venta (sí/no)':'Bodega a la venta','Altura piso a techo (libre)':'Altura piso a techo',
  'Meses para entrega (auto)':'Meses para entrega','Mensualidad estimada (auto)':'Mensualidad estimada',
  'M2 habitables (–)':'M² habitables (mín)','M2 habitables (+)':'M² habitables (máx)','M2 terreno':'M² terreno',
  'Recámaras (–)':'Recámaras (mín)','Recámaras (+)':'Recámaras (máx)','Baños (–)':'Baños (mín)','Baños (+)':'Baños (máx)',
  'Estacionamientos (–)':'Estacionamientos (mín)','Estacionamientos (+)':'Estacionamientos (máx)',
  'Precio (–)':'Precio (mín)','Precio (+)':'Precio (máx)',
};
const SKIP = new Set(['#','Código / SKU','Desarrollo','Inventario (liga a lista de precios)','Disponibilidad en línea (liga)','Mapa (auto)','Acabados a la entrega (liga)','Memoria de acabados (liga)','Liga Drive','Liga EasyBroker','Liga brochure','Liga recorrido 360 / video']);
const MONEY = new Set(['Precio a partir de','Precio (–)','Precio (+)','Apartado','Precio por m²','Mantenimiento mensual','Mantenimiento anticipado','Cuota de equipamiento','Predial estimado','Gastos de escrituración estimados','Precio por cajón','Precio de bodega']);
const PCT = new Set(['% vendido','% avance de obra']);
const PCTF = new Set(['Comisión al broker (%)','Enganche','Mensualidades','Escrituración']);
const DATE = new Set(['Fecha de entrega','Fecha de inicio de ventas','Fecha de actualización del dato']);
const mx = (n:number)=>'$'+Math.round(n).toLocaleString('es-MX');
function fmtFecha(v:any){ if(v==null||v==='')return null; if(v instanceof Date)return v.toISOString().slice(0,10); const n=Number(v); if(!isNaN(n)&&n>20000&&n<80000){const d=new Date(Math.round((n-25569)*86400000)); if(!isNaN(d.getTime()))return d.toISOString().slice(0,10);} const s=String(v); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?m[0]:s; }
function fmtValor(h:string, raw:any){ if(raw==null||raw==='')return null; const s=String(raw).trim(); if(s==='')return null; const n=Number(String(raw).replace(/[^0-9.\-]/g,'')); if(MONEY.has(h)&&!isNaN(n)&&/[0-9]/.test(s))return mx(n); if(PCT.has(h)&&!isNaN(n))return (n<=1?Math.round(n*100):Math.round(n))+'%'; if(PCTF.has(h)&&!isNaN(n))return (n<=1?Math.round(n*100):Math.round(n))+'%'; if(DATE.has(h))return fmtFecha(raw); return s; }

const COLMAP: Record<string,[string,string]> = {
  'Tipo (Depa / Casa)':['tipo','text'],'Torre(s)':['torres','text'],'Dirección':['direccion','text'],
  'Desarrollador':['desarrollador','text'],'Colonia':['colonia','text'],'Alcaldía / Municipio':['alcaldia','text'],'Estado':['estado','text'],
  'Preventa / En obra / Inmediata':['etapa','text'],'Fecha de entrega':['fecha_entrega','date'],'Unidades totales':['unidades_totales','int'],
  'Precio (–)':['precio_min','money'],'Precio (+)':['precio_max','money'],'Apartado':['apartado','money'],
  'Enganche':['esq_enganche','pct'],'Mensualidades':['esq_mensualidades','pct'],'Escrituración':['esq_escritura','pct'],
  'M2 habitables (–)':['m2_min','num'],'M2 habitables (+)':['m2_max','num'],'M2 terreno':['terreno_m2','num'],
  'Recámaras (–)':['rec_min','int'],'Recámaras (+)':['rec_max','int'],'Baños (–)':['banos_min','num'],'Baños (+)':['banos_max','num'],
  'Estacionamientos (–)':['estac_min','int'],'Estacionamientos (+)':['estac_max','int'],
  'Balcón':['balcon','text'],'Terraza':['terraza','text'],'Roof garden privado':['roof','text'],'Bodega':['bodega','text'],
  'Lista de amenidades':['amenidades','text'],'Comisión al broker (%)':['comision_broker','pct'],
  'ION':['credito_ion','bool'],'HIR':['credito_hir','bool'],'Yave':['credito_yave','bool'],'Bancario':['credito_bancario','bool'],
  'Suministro (municipal/pozo/pipa)':['agua','text'],'Tipo (Natural / Estacionario)':['gas','text'],
  'Descuentos disponibles (sí/no)':['descuentos','text'],'Estacionamiento para clientes':['estac_clientes','text'],
  'Caseta de venta (sí/no)':['caseta_venta','bool'],'Depa muestra (sí/no)':['depa_muestra','bool'],'Notas':['notas','text'],
};

// ============ UNIDADES (pestañas por desarrollo) ============
const UCOLMAP: Record<string,[string,string]> = {
  'Torre':['torre','text'],'Nivel':['nivel','text'],'N° Depto':['num_depto','text'],
  'Estatus':['estatus','text'],'Rec':['rec','int'],'Baños':['banos','num'],'Estac':['n_estac','int'],
  'm² Hab':['m2_hab','num'],'Balcón m²':['balcon_m2','num'],'Terraza m²':['terraza_m2','num'],
  'Roof Garden Privado m²':['roof_m2','num'],'m² Total':['m2_total','num'],
  'Precio':['precio','money'],'Apartado':['apartado','money'],'Fecha Escrituración':['fecha_escrituracion','date'],
  'Tipo Estac':['tipo_estac','text'],'Tamaño Estac':['tam_estac','text'],'Elevautos':['elevautos','text'],
  'SKU Cajones':['sku_cajones','text'],'Bodega m²':['bodega_m2','num'],'SKU Bodega':['sku_bodega','text'],
  'Prototipo':['prototipo','text'],'N° Balcones':['n_balcones','int'],'Descripción':['descripcion','text'],
};

function coerce(kind:string, raw:any){
  if(raw==null)return undefined;
  const s=String(raw).trim(); if(s==='')return undefined;
  const num=Number(s.replace(/[^0-9.\-]/g,''));
  switch(kind){
    case 'text': return s;
    case 'int': return isNaN(num)?undefined:Math.round(num);
    case 'num': return isNaN(num)?undefined:num;
    case 'money': return isNaN(num)?undefined:Math.round(num);
    case 'pct': if(isNaN(num))return undefined; return num>1?Math.round(num)/100:num;
    case 'date': return fmtFecha(raw);
    case 'bool': if(/^(s[íi]|x|1|true|yes)$/i.test(s))return 'Sí'; if(/^(no|0|false)$/i.test(s))return 'No'; return s;
  }
  return undefined;
}
const norm = (x:any)=> x==null?'':String(x).trim();
// Quita un paréntesis final del encabezado: "Enganche (15%)" -> "Enganche" (los % son dinámicos).
const stripParen = (h:string)=> String(h).replace(/\s*\([^)]*\)\s*$/,'').trim();
const J = (o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json'}});
const chunk = <T,>(a:T[],n:number):T[][]=>{ const o:T[][]=[]; for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n)); return o; };

function headerDesarrollos(values:any[]){ for(let i=0;i<Math.min(values.length,25);i++){ const r=(values[i]||[]).map(norm); if(r.includes('Código / SKU'))return i; } return -1; }
function headerUnidades(values:any[]){ for(let i=0;i<Math.min(values.length,25);i++){ const r=(values[i]||[]).map(norm); if(r.includes('SKU')&&r.includes('Torre'))return i; } return -1; }

async function syncDesarrollos(supa:any, values:any[], modo:string){
  const hi=headerDesarrollos(values);
  if(hi<0) return J({error:'no encontré la fila de encabezados (Código / SKU)'},400);
  const hdr=(values[hi]||[]).map(norm);
  const iSku=hdr.indexOf('Código / SKU');
  let updated=0; const notFound:string[]=[]; const enSheet:string[]=[];
  for(let r=hi+1;r<values.length;r++){
    const row=values[r]||[]; const sku=norm(row[iSku]);
    if(!sku||sku.toLowerCase()==='código / sku') continue;
    enSheet.push(sku);
    const { data: cur } = await supa.from('desarrollos').select('ficha').eq('sku',sku).maybeSingle();
    if(!cur){ notFound.push(sku); continue; }
    const ficha:Record<string,any>={}; const cols:Record<string,any>={};
    hdr.forEach((h:string,c:number)=>{ if(!h)return; const raw=row[c];
      if(COLMAP[h]){ const v=coerce(COLMAP[h][1],raw); if(v!==undefined) cols[COLMAP[h][0]]=v; }
      if(!SKIP.has(h)){ const key=RENAME[h]||h; const val=fmtValor(h,raw); if(val!=null) ficha[key]=val; }
    });
    const patch:Record<string,any>={ ...cols, ficha:{ ...(cur.ficha||{}), ...ficha }, actualizado:new Date().toISOString() };
    const { error } = await supa.from('desarrollos').update(patch).eq('sku',sku);
    if(!error) updated++;
  }

  const eliminados:string[]=[];
  // ESPEJO: borra los desarrollos que ya no están en el Concentrado (cae en cascada a unidades + media).
  // Salvaguarda: sólo si la hoja trae al menos 1 SKU (evita un borrado masivo por lectura vacía).
  if(modo==='espejo' && enSheet.length>=1){
    const keep=new Set(enSheet);
    const { data: all } = await supa.from('desarrollos').select('sku');
    const sobran=(all||[]).map((d:any)=>d.sku).filter((s:string)=>!keep.has(s));
    for(const c of chunk(sobran,200)){
      const { error } = await supa.from('desarrollos').delete().in('sku',c);
      if(!error) eliminados.push(...c);
    }
  }
  return J({ ok:true, tipo:'desarrollos', modo, actualizados:updated, eliminados, no_encontrados:notFound });
}

async function syncUnidades(supa:any, values:any[], devSkuBody:string|null, modo:string){
  const hi=headerUnidades(values);
  if(hi<0) return J({error:'no encontré la fila de encabezados de unidades (SKU / Torre)'},400);
  const hdr=(values[hi]||[]).map(norm);
  const iSku=hdr.indexOf('SKU');
  const active:[number,string,string][]=[];
  hdr.forEach((h:string,c:number)=>{ if(UCOLMAP[h]) active.push([c, UCOLMAP[h][0], UCOLMAP[h][1]]); });

  const rows:Record<string,any>[]=[]; const now=new Date().toISOString();
  const skusPorDev:Record<string,Set<string>>={};   // dev -> SKUs presentes en la hoja
  for(let r=hi+1;r<values.length;r++){
    const row=values[r]||[]; const sku=norm(row[iSku]);
    if(!sku||sku.toUpperCase()==='SKU') continue;
    const dev = devSkuBody || sku.split('-')[0];
    (skusPorDev[dev] ||= new Set()).add(sku);
    const obj:Record<string,any>={ sku, dev_sku:dev, actualizado:now };
    for(const [c,col,kind] of active){
      const v=coerce(kind, row[c]);
      if(col==='estatus'){ obj.estatus = (v===undefined? 'Disponible' : v); }
      else { obj[col] = (v===undefined? null : v); }   // el archivo gana: celda vacía -> null
    }
    // Snapshot COMPLETO de la fila: TODAS las columnas, keyed por encabezado normalizado.
    // Garantiza que ninguna columna de la hoja se pierda (incluye cálculos y ligas de plano).
    const ficha:Record<string,any>={};
    for(let c=0;c<hdr.length;c++){
      const h=stripParen(hdr[c]); if(!h||h==='SKU') continue;
      const raw=row[c]; if(raw===''||raw==null) continue;
      ficha[h]=(typeof raw==='number'||typeof raw==='boolean') ? raw : String(raw).trim();
    }
    obj.ficha=ficha;   // el archivo gana: se reemplaza el snapshot completo en cada sync
    rows.push(obj);
  }

  // Dev(s) a considerar: los que traen filas, y si vino dev_sku explícito, también ese
  // (así una pestaña que quedó en 0 filas = "todo vendido" puede vaciar sus unidades).
  const devsConsiderar = new Set(Object.keys(skusPorDev));
  if(devSkuBody) devsConsiderar.add(devSkuBody);

  // Validar FK (que el desarrollo exista) para no abortar por FK.
  const { data: devs } = await supa.from('desarrollos').select('sku').in('sku', Array.from(devsConsiderar));
  const okDev=new Set((devs||[]).map((d:any)=>d.sku));
  const sinDev=Array.from(devsConsiderar).filter(d=>!okDev.has(d));

  // Upsert de las filas válidas (PK = sku).
  const validRows=rows.filter(o=>okDev.has(o.dev_sku));
  let upserted=0;
  for(const c of chunk(validRows,500)){
    const { error } = await supa.from('unidades').upsert(c, { onConflict:'sku' });
    if(error) return J({ ok:false, tipo:'unidades', error:String(error.message||error), actualizados:upserted, eliminados:[], sin_desarrollo:sinDev }, 200);
    upserted+=c.length;
  }

  const eliminados:string[]=[];
  // ESPEJO: por cada dev de esta pestaña, borra sus unidades que ya no están en la hoja. ACOTADO al dev.
  if(modo==='espejo'){
    for(const dev of devsConsiderar){
      if(!okDev.has(dev)) continue;
      const keep = skusPorDev[dev] || new Set<string>();
      const { data: exist } = await supa.from('unidades').select('sku').eq('dev_sku',dev);
      const sobran=(exist||[]).map((u:any)=>u.sku).filter((s:string)=>!keep.has(s));
      for(const c of chunk(sobran,200)){
        const { error } = await supa.from('unidades').delete().in('sku',c);
        if(!error) eliminados.push(...c);
      }
    }
  }
  return J({ ok:true, tipo:'unidades', modo, actualizados:upserted, eliminados, sin_desarrollo:sinDev });
}

Deno.serve(async (req)=>{
  if(req.method!=='POST') return J({error:'method'},405);
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await supa.from('sync_config').select('sync_secret').eq('id',1).maybeSingle();
  const secret = req.headers.get('x-sync-secret')||'';
  if(!cfg || !secret || secret!==cfg.sync_secret) return J({error:'no autorizado'},401);

  let body:any={}; try{ body=await req.json(); }catch{ /* */ }
  const values:any[] = Array.isArray(body.values)?body.values:[];
  if(values.length===0) return J({error:'sin datos (values vacío)'},400);
  const devSku = body.dev_sku? String(body.dev_sku).trim() : null;
  const modo = String(body.modo||'').toLowerCase()==='espejo' ? 'espejo' : 'upsert';

  let kind = String(body.kind||'').toLowerCase();
  if(kind!=='desarrollos' && kind!=='unidades'){
    kind = headerDesarrollos(values)>=0 ? 'desarrollos' : (headerUnidades(values)>=0 ? 'unidades' : '');
  }
  if(kind==='desarrollos') return await syncDesarrollos(supa, values, modo);
  if(kind==='unidades')   return await syncUnidades(supa, values, devSku, modo);
  return J({error:'no reconocí la pestaña (ni Concentrado ni unidades)'},400);
});
