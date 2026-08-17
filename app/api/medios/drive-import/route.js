import { NextResponse } from 'next/server';
import { svc, userFromToken, googleAccessToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = ['render', 'plano', 'planta', 'amenidad', 'foto', 'brochure', 'portada'];
function tipoDeNombre(nombre, fallback) {
  const s = (nombre || '').toLowerCase();
  if (/plano/.test(s)) return 'plano';
  if (/planta/.test(s)) return 'planta';
  if (/render/.test(s)) return 'render';
  if (/amenidad|amenit|alberca|\bgym\b|roof|lobby/.test(s)) return 'amenidad';
  if (/brochure|folleto|dossier|pdf/.test(s)) return 'brochure';
  if (/fachada|portada/.test(s)) return 'render';
  if (/foto/.test(s)) return 'foto';
  return fallback;
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
      sub.files.filter(x => x.mimeType?.startsWith('image/') || x.mimeType === 'application/pdf')
        .forEach(x => trabajos.push({ ...x, tipo: x.mimeType === 'application/pdf' ? 'brochure' : t }));
    } else if (f.mimeType?.startsWith('image/') || f.mimeType === 'application/pdf') {
      trabajos.push({ ...f, tipo: f.mimeType === 'application/pdf' ? 'brochure' : tipoDeNombre(f.name, fallback) });
    }
  }
  const lote = trabajos.slice(0, max);

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
      await db.from('media').insert({ dev_sku, tipo: it.tipo, area: con_area ? area : null, url: pub.publicUrl, titulo: (it.name || '').replace(/\.[^.]+$/, '') });
      porTipo[it.tipo] = (porTipo[it.tipo] || 0) + 1; ok++;
    } catch { err++; }
  }
  return NextResponse.json({ ok: true, encontrados: trabajos.length, importados: ok, errores: err, porTipo, mas: trabajos.length > lote.length ? trabajos.length - lote.length : 0 });
}
