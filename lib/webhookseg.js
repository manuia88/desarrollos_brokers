// Verificación de firma de webhooks de Meta (WhatsApp Cloud y Lead Ads).
// Meta firma el cuerpo CRUDO con HMAC-SHA256 usando el App Secret y lo manda
// en el header X-Hub-Signature-256: "sha256=<hex>".
import crypto from 'crypto';

export function verificarFirmaMeta(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader || rawBody == null) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
