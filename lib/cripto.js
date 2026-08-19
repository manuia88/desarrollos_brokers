// ============================================================
// Cifrado de secretos a nivel app (AES-256-GCM). Sólo servidor.
// Se usa para las API keys de conexiones (EasyBroker, etc.).
//
// - Si hay CONEXIONES_KEY (o CONEXIONES_SECRET) en el entorno, las
//   llaves se guardan cifradas con prefijo "enc:v1:".
// - Si NO hay llave configurada, se guardan en texto plano (compat):
//   el portal sigue funcionando sin configurar nada.
// - descifrar() acepta ambos: texto plano viejo y "enc:v1:" nuevo.
//   Así la migración es transparente (no hay que recifrar lo viejo).
// ============================================================
import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function llave() {
  const s = process.env.CONEXIONES_KEY || process.env.CONEXIONES_SECRET;
  if (!s) return null;
  return crypto.createHash('sha256').update(String(s)).digest(); // 32 bytes
}

// ¿Está activo el cifrado en este entorno?
export function cifradoActivo() { return !!llave(); }

// Cifra un texto. En producción SIN llave configurada, falla cerrado (no guarda en claro).
// En desarrollo/local sin llave, devuelve el texto tal cual (compat para pruebas).
export function cifrar(texto) {
  if (texto == null || texto === '') return texto;
  const k = llave();
  if (!k) {
    if (process.env.NODE_ENV === 'production') throw new Error('cifrado_no_configurado');
    return texto;
  }
  const s = String(texto);
  if (s.startsWith(PREFIX)) return s; // ya venía cifrado
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

// Descifra. Texto plano -> lo regresa igual. Cifrado sin llave -> null.
export function descifrar(texto) {
  if (texto == null) return texto;
  const s = String(texto);
  if (!s.startsWith(PREFIX)) return texto; // compat: llave vieja en claro
  const k = llave(); if (!k) return null;
  try {
    const raw = Buffer.from(s.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch { return null; }
}
