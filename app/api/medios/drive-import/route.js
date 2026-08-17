import { NextResponse } from 'next/server';
import { svc, userFromToken, googleAccessToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = ['render', 'plano', 'planta', 'amenidad', 'foto', 'brochure', 'portada'];
// Reconoce la taxonomía real de las carpetas (soporta prefijos numerados: "2. Planos", "6. Renders"…).
function tipoDeNombre(nombre, fallback) {
  const s = (nombre || '').toLowerCase();
  if (/prototipo/.test(s)) return 'planta';                          // "3. Prototipos" = plantas por unidad
  if (/planta/.test(s)) return 'planta';                             // "4. Plantas"
  if (/plano/.test(s)) return 'plano';                               // "2. Planos"
  if (/render/.test(s)) return 'render';                             // "6. Renders"
  if (/amenidad|amenit|alberca|\bgym\b|roof|lobby|terraza/.test(s)) return 'amenidad';
  if (/brochure|folleto|dossier|ficha|memoria|acabado|mantenim/.test(s)) return 'brochure'; // 1/7/8/9
  if (/ubicaci|localizaci|mapa|entorno/.test(s)) return 'foto';      // "10. Ubicación"
  if (/fachada|portada/.test(s)) return 'render';
  if (/foto/.test(s)) return 'foto';
  return fallback;
}
// De "5d.png" / "8i-F ROOF GARDEN.png" saca el prototipo "AN1-5d" / "AN1-8i-F"
// (en la base los prototipos son SKU-código, así la planta queda ligada a su unidad).
function protoDeArchivo(nombre, sku) {
  if (!sku) return null;
  const stem = (nombre || '').replace(/\.[^.]+$/, '').trim();
  const code = stem.split(/\s+/)[0];                                 // primer token: "8i-F ROOF GARDEN" -> "8i-F"
  if (!/^\d/.test(code)) return null;                                // los prototipos empiezan con dígito
  return sku + '-' + code;
}
function folderId(input) {
  const s = String(input || '').trim();
  let m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return null;
}
async function driveList(token, q) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return { ok: false, status: r.status, files: [] };
  const j = await r.json(); return { ok: true, files: j.files || [] };
}

async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof ? { uid, ...prof } : null;
}

export async function POST(req) {
  const p = await quien(req);
  if (!p) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const dev_sku = b.dev_sku; const fid = folderId(b.folder);
  const fallback = TIPOS.includes(b.tipo) ? b.tipo : 'render';
  const area = b.area || null;
  const max = Math.min(Math.max(1, b.max || 60), 120);
  if (!dev_sku || !fid) return NextResponse.json({ error: 'Falta el desarrollo o la carpeta (pega el link de la carpeta de Drive).' }, { status: 400 });

  const db = svc();
  const token = await googleAccessToken(db, p.uid);
  if (!token) return NextResponse.json({ error: 'Conecta tu Google con permiso de Drive (Agenda → Conectar Google) y vuelve a intentar.' }, { status: 200 });

  // Junta imágenes/PDF del folder y de sus subcarpetas (1 nivel), con su categoría.
  const trabajos = [];
  const top = await driveList(token, `'${fid}' in parents and trashed=false`);
  if (!top.ok) return NextResponse.json({ error: 'No pude leer la carpeta (¿es tuya o compartida contigo? status ' + top.status + ')' }, { status: 200 });
  for (const f of top.files) {
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      const sub = await driveList(token, `'${f.id}' in parents and trashed=false`);
      const t = tipoDeNombre(f.name, fallback);
      const esProto = /prototipo/i.test(f.name);                     // etiquetar prototipo desde el nombre del archivo
      sub.files.filter(x => x.mimeType?.startsWith('image/') || x.mimeType === 'application/pdf')
        .forEach(x => trabajos.push({ ...x, tipo: x.mimeType === 'application/pdf' ? 'brochure' : t, proto: esProto ? protoDeArchivo(x.name, dev_sku) : null }));
    } else if (f.mimeType?.startsWith('image/') || f.mimeType === 'application/pdf') {
      trabajos.push({ ...f, tipo: f.mimeType === 'application/pdf' ? 'brochure' : tipoDeNombre(f.name, fallback), proto: null });
    }
  }
  // Dedup: no reimportar lo que ya está (por título/nombre en este desarrollo).
  const { data: existentes } = await db.from('media').select('titulo').eq('dev_sku', dev_sku);
  const yaSet = new Set((existentes || []).map(m => (m.titulo || '').toLowerCase()));
  const lote = trabajos.filter(it => !yaSet.has((it.name || '').replace(/\.[^.]+$/, '').toLowerCase())).slice(0, max);
  const saltados = trabajos.length - trabajos.filter(it => !yaSet.has((it.name || '').replace(/\.[^.]+$/, '').toLowerCase())).length;

  const porTipo = {}; let ok = 0, err = 0;
  for (const it of lote) {
    try {
      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${it.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + token } });
      if (!dl.ok) { err++; continue; }
      const buf = Buffer.from(await dl.arrayBuffer());
      const safe = (it.name || 'img').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${dev_sku}/${it.tipo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}-${safe}`;
      const up = await db.storage.from('medios').upload(path, buf, { contentType: it.mimeType, upsert: false });
      if (up.error) { err++; continue; }
      const { data: pub } = db.storage.from('medios').getPublicUrl(path);
      const con_area = ['render', 'foto', 'amenidad', 'portada'].includes(it.tipo);
      await db.from('media').insert({ dev_sku, tipo: it.tipo, area: con_area ? area : null, prototipo: it.proto || null, url: pub.publicUrl, titulo: (it.name || '').replace(/\.[^.]+$/, '') });
      porTipo[it.tipo] = (porTipo[it.tipo] || 0) + 1; ok++;
    } catch { err++; }
  }
  // Portada automática: si el desarrollo no tiene portada, promueve el primer render/foto.
  if (ok > 0) {
    const { data: port } = await db.from('media').select('id').eq('dev_sku', dev_sku).eq('tipo', 'portada').maybeSingle();
    if (!port) {
      const { data: fr } = await db.from('media').select('id').eq('dev_sku', dev_sku).in('tipo', ['render', 'foto']).order('creado').limit(1).maybeSingle();
      if (fr) await db.from('media').update({ tipo: 'portada' }).eq('id', fr.id);
    }
  }
  const restantes = trabajos.filter(it => !yaSet.has((it.name || '').replace(/\.[^.]+$/, '').toLowerCase())).length - lote.length;
  return NextResponse.json({ ok: true, encontrados: trabajos.length, importados: ok, saltados, errores: err, porTipo, mas: restantes > 0 ? restantes : 0 });
}
