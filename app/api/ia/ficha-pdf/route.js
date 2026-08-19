import { NextResponse } from 'next/server';
import { svc, userFromToken } from '../../../../lib/googleServer';
import { llamarIA, llamarIADoc, resolverIA } from '../../../../lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Campos que la IA debe intentar extraer del documento del desarrollador.
const CAMPOS = [
  'Tipo (Depa / Casa)', 'Desarrollador', 'Dirección', 'Colonia', 'Alcaldía / Municipio', 'Estado', 'Torre(s)',
  'Preventa / En obra / Inmediata', 'Fecha de entrega', 'Unidades totales', 'Unidades disponibles',
  'Precio a partir de', 'Precio (mín)', 'Precio (máx)', 'Precio por m²',
  'Apartado', 'Enganche', 'Mensualidades', 'Escrituración', 'Descuentos disponibles',
  'M² habitables (mín)', 'M² habitables (máx)', 'Recámaras (mín)', 'Recámaras (máx)',
  'Baños (mín)', 'Baños (máx)', 'Estacionamientos (mín)', 'Estacionamientos (máx)',
  'Balcón', 'Terraza', 'Roof garden privado', 'Bodega', 'Cuarto de servicio', 'Cocina integral',
  'Lista de amenidades', 'Seguridad 24h', 'Acceso controlado', 'Elevadores',
  'Crédito Tradicional Infonavit', 'Cofinavit', 'Crédito Tradicional FOVISSSTE', 'Bancario', 'ION', 'HIR',
  'Comisión al broker', 'Contacto del desarrollador', 'Mantenimiento mensual', 'Predial estimado',
  'Agua (suministro)', 'Gas (tipo)', 'Luz (CFE)', 'Internet / fibra',
  'Tipo de construcción', 'Sistema constructivo', 'Zona sísmica',
];

export async function POST(req) {
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = await userFromToken(auth);
  if (!uid) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  let db;
  try { db = svc(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: prof } = await db.from('profiles').select('rol').eq('id', uid).maybeSingle();
  if (prof?.rol !== 'super_admin') return NextResponse.json({ error: 'solo super administrador' }, { status: 403 });

  const ia = await resolverIA(db, uid);
  if (!ia) return NextResponse.json({ error: 'no_ia', mensaje: 'Conecta tu llave de IA en Conexiones para usar el autollenado.' }, { status: 200 });

  let body = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { pdfBase64 } = body;
  if (!pdfBase64) return NextResponse.json({ error: 'falta el PDF' }, { status: 400 });

  // Extraer texto del PDF.
  let texto = '';
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const buf = Buffer.from(pdfBase64, 'base64');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: true });
    texto = (typeof r?.text === 'string' ? r.text : Array.isArray(r?.text) ? r.text.join('\n') : '').trim();
  } catch (e) {
    return NextResponse.json({ error: 'pdf', mensaje: 'No pude leer el PDF: ' + (e?.message || 'error') }, { status: 200 });
  }
  const escaneado = texto.length < 40;
  if (escaneado && ia.proveedor !== 'anthropic') {
    return NextResponse.json({ error: 'sin_texto', mensaje: 'El PDF parece un escaneo/imagen. Para leerlo con visión conecta una llave de Anthropic (Claude) en Conexiones.' }, { status: 200 });
  }

  const system = `Eres un asistente que extrae datos de fichas técnicas inmobiliarias en México. Del documento que te doy, extrae SOLO los campos de la lista y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin explicaciones, sin markdown). Reglas:
- Usa EXACTAMENTE los nombres de campo de la lista como llaves.
- Omite los campos que no aparezcan en el documento (no inventes).
- Montos de dinero como "$1,234,567". Porcentajes como "30%". Fechas como "AAAA-MM-DD". Sí/No como "Sí" o "No".
- "Lista de amenidades": una sola cadena con las amenidades separadas por comas.
- Rangos: si hay un mínimo y un máximo, llena ambos campos (mín)/(máx).

CAMPOS: ${CAMPOS.join(' | ')}`;

  let raw = '';
  try {
    if (escaneado) {
      // PDF escaneado: se manda nativo a Claude (visión).
      raw = await llamarIADoc({ apiKey: ia.apiKey, system, pregunta: 'Extrae del PDF los campos indicados y devuelve solo el JSON.', pdfBase64, maxTokens: 1500 });
    } else {
      const prompt = `DOCUMENTO:\n${texto.slice(0, 12000)}\n\nDevuelve el JSON con los campos encontrados.`;
      raw = await llamarIA({ proveedor: ia.proveedor, apiKey: ia.apiKey, system, mensajes: [{ role: 'user', content: prompt }], maxTokens: 1500 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'ia', mensaje: 'La IA no pudo procesar: ' + (e?.message || 'error') }, { status: 200 });
  }

  // Parsear el JSON de la respuesta.
  let ficha = {};
  try {
    const i = raw.indexOf('{'), j = raw.lastIndexOf('}');
    const obj = JSON.parse(raw.slice(i, j + 1));
    for (const [k, v] of Object.entries(obj)) {
      if (v == null || v === '' || String(v).trim() === '') continue;
      if (CAMPOS.includes(k)) ficha[k] = String(v).trim();
    }
  } catch {
    return NextResponse.json({ error: 'parse', mensaje: 'La IA respondió pero no pude leer los campos. Intenta de nuevo.' }, { status: 200 });
  }

  return NextResponse.json({ ficha, campos: Object.keys(ficha).length, fuente_ia: ia.fuente });
}
