import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { validarEB } from '../../../../lib/integraciones';
import { validarIA } from '../../../../lib/ia';
import { cifrar, cifradoActivo } from '../../../../lib/cripto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(token); if (!uid) return null;
  const { data: prof } = await svc().from('profiles').select('rol,org_id').eq('id', uid).maybeSingle();
  return prof ? { uid, ...prof } : null;
}

// Conectar / actualizar una credencial de integración (por ahora EasyBroker).
export async function POST(req) {
  const p = await quien(req);
  if (!p) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const proveedor = b.proveedor || 'easybroker';
  const scope = b.scope === 'asesor' ? 'asesor' : 'org';
  // Para IA, "ambiente" guarda el proveedor del LLM; para WhatsApp, el canal.
  const ambiente = proveedor === 'ia'
    ? (b.ambiente === 'openai' ? 'openai' : 'anthropic')
    : proveedor === 'whatsapp'
    ? 'cloud'
    : (b.ambiente === 'staging' ? 'staging' : 'produccion');
  const api_key = (b.api_key || '').trim();
  if (!api_key) return NextResponse.json({ error: 'falta la API key' }, { status: 400 });
  // Fail-closed: en producción no se guardan credenciales sin cifrado configurado.
  if (!cifradoActivo() && process.env.NODE_ENV === 'production')
    return NextResponse.json({ error: 'El cifrado de credenciales no está configurado (falta CONEXIONES_KEY). Pide al administrador que la configure antes de conectar llaves.' }, { status: 200 });
  if (!p.org_id && p.rol !== 'super_admin') return NextResponse.json({ error: 'tu usuario no tiene inmobiliaria' }, { status: 400 });

  // Permisos: scope 'org' solo director/super/independiente; scope 'asesor' el propio asesor.
  if (scope === 'org' && !['director', 'super_admin', 'independiente', 'gerente'].includes(p.rol))
    return NextResponse.json({ error: 'solo el director puede conectar la cuenta de la inmobiliaria' }, { status: 403 });

  const org_id = p.org_id;
  const asesor_id = scope === 'asesor' ? p.uid : null;

  // Validar la llave antes de guardar (EasyBroker o IA).
  let valida = true;
  if (proveedor === 'easybroker') valida = await validarEB(api_key, ambiente);
  else if (proveedor === 'ia') valida = await validarIA(ambiente, api_key);
  else if (proveedor === 'telegram') {
    try { const r = await fetch(`https://api.telegram.org/bot${api_key}/getMe`); const j = await r.json(); valida = !!j.ok; if (j.ok && !b.etiqueta) b.etiqueta = j.result?.username || null; }
    catch { valida = false; }
  }

  // Cuota opcional: máximo de anuncios vivos que esta cuenta puede tener en el portal.
  let cuota = null;
  if (b.cuota != null && b.cuota !== '') { const n = parseInt(b.cuota, 10); if (Number.isFinite(n) && n > 0) cuota = n; }

  const db = svc();
  const { error } = await db.from('conexiones').upsert({
    org_id, scope, asesor_id, proveedor, ambiente, api_key: cifrar(api_key), cuota,
    etiqueta: b.etiqueta || null, activa: true, valida, ultimo_check: new Date().toISOString(), actualizado: new Date().toISOString(),
  }, { onConflict: 'org_id,proveedor,scope,asesor_id' });
  if (error) return NextResponse.json({ error: 'no se pudo guardar la conexión' }, { status: 200 });
  return NextResponse.json({ ok: true, valida });
}

// Desconectar una credencial (verifica que sea de tu org).
export async function DELETE(req) {
  const p = await quien(req);
  if (!p) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  let b = {}; try { b = await req.json(); } catch { /* noop */ }
  const db = svc();
  const { data: c } = await db.from('conexiones').select('id,org_id,asesor_id,scope').eq('id', b.id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'no encontrada' }, { status: 404 });
  const puede = p.rol === 'super_admin' || (c.org_id === p.org_id && (c.scope === 'org' ? ['director', 'gerente', 'independiente'].includes(p.rol) : c.asesor_id === p.uid));
  if (!puede) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
  await db.from('conexiones').delete().eq('id', b.id);
  return NextResponse.json({ ok: true });
}
