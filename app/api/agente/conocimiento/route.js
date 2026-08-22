// CRUD de la base de conocimiento del Asesor Digital. Escritura solo directivos.
// Texto largo se trocea en pedazos (~700 chars por límite de frase) para mejor recall.
import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof ? { uid, ...prof } : null;
}
const gestor = p => p && (p.rol === 'super_admin' || ['director', 'gerente'].includes(p.rol));

// Trocea texto largo en pedazos que cortan en fin de oración/párrafo, ~700 chars.
function trocear(texto, max = 700) {
  const t = String(texto || '').trim();
  if (t.length <= max) return [t];
  const partes = t.split(/\n\s*\n/);   // primero por párrafos
  const out = [];
  for (const p of partes) {
    if (p.length <= max) { if (p.trim()) out.push(p.trim()); continue; }
    let resto = p.trim();
    while (resto.length > max) {
      let corte = resto.lastIndexOf('. ', max);
      if (corte < max * 0.5) corte = resto.lastIndexOf(' ', max);
      if (corte < 1) corte = max;
      out.push(resto.slice(0, corte + 1).trim());
      resto = resto.slice(corte + 1).trim();
    }
    if (resto) out.push(resto);
  }
  return out.filter(Boolean);
}

export async function POST(req) {
  const p = await quien(req);
  if (!gestor(p)) return NextResponse.json({ error: 'solo director/gerente' }, { status: 403 });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const db = svc();
  const orgId = p.rol === 'super_admin' && b.org_id ? b.org_id : p.org_id;
  if (!orgId) return NextResponse.json({ error: 'sin inmobiliaria' }, { status: 400 });

  if (b.accion === 'borrar') {
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const del = db.from('conocimiento').delete().eq('id', b.id);
    await (p.rol === 'super_admin' ? del : del.eq('org_id', orgId));
    return NextResponse.json({ ok: true });
  }

  const titulo = String(b.titulo || '').trim().slice(0, 200);
  const texto = String(b.texto || '').trim().slice(0, 20000);
  if (!titulo || !texto) return NextResponse.json({ error: 'título y texto requeridos' }, { status: 400 });
  const dev_sku = b.dev_sku || null;

  if (b.id) {   // editar: reemplaza un trozo puntual (sin re-trocear)
    const up = db.from('conocimiento').update({ titulo, texto, dev_sku, actualizado: new Date().toISOString() }).eq('id', b.id);
    const { error } = await (p.rol === 'super_admin' ? up : up.eq('org_id', orgId));
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  const trozos = trocear(texto);
  const filas = trozos.map((tx, i) => ({ org_id: orgId, dev_sku, titulo: trozos.length > 1 ? `${titulo} (${i + 1}/${trozos.length})` : titulo, texto: tx, fuente: b.fuente || 'manual' }));
  const { error } = await db.from('conocimiento').insert(filas);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, trozos: filas.length });
}
