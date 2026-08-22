// Envío y resolución de WhatsApp Cloud API por inmobiliaria (BYOK).
import { descifrar } from './cripto';

// Envía un mensaje de texto con las credenciales de una org (phone_number_id + token).
export async function enviarWhatsAppCloud({ phoneNumberId, token }, to, texto) {
  if (!phoneNumberId || !token) return false;
  const num = String(to || '').replace(/[^0-9]/g, '');
  if (!num || !texto) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: num, type: 'text', text: { body: String(texto).slice(0, 3800) } }),
    });
    return r.ok;
  } catch { return false; }
}

// Resuelve la conexión de WhatsApp de la org dueña de ese phone_number_id.
export async function resolverWhatsAppOrg(db, phoneNumberId) {
  if (!phoneNumberId) return null;
  const { data } = await db.from('conexiones').select('org_id,etiqueta,api_key,activa').eq('proveedor', 'whatsapp').eq('activa', true);
  const c = (data || []).find(x => String(x.etiqueta) === String(phoneNumberId));
  if (!c) return null;
  const token = descifrar(c.api_key);
  if (!token) return null;
  return { orgId: c.org_id, phoneNumberId, token };
}

// Conexión de WhatsApp de una org (para enviar DESDE el panel o el cron).
export async function resolverWhatsAppPorOrg(db, orgId) {
  if (!orgId) return null;
  const { data } = await db.from('conexiones').select('etiqueta,api_key,activa').eq('proveedor', 'whatsapp').eq('org_id', orgId).eq('activa', true).limit(1).maybeSingle();
  if (!data) return null;
  const token = descifrar(data.api_key);
  return token ? { phoneNumberId: data.etiqueta, token } : null;
}

// Descarga el binario de un media (nota de voz, imagen) de la Cloud API.
export async function descargarMediaWhatsApp({ token }, mediaId) {
  try {
    const meta = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: { authorization: 'Bearer ' + token } });
    if (!meta.ok) return null;
    const j = await meta.json();
    if (!j.url) return null;
    const bin = await fetch(j.url, { headers: { authorization: 'Bearer ' + token } });
    if (!bin.ok) return null;
    return { buffer: Buffer.from(await bin.arrayBuffer()), mime: j.mime_type || 'audio/ogg' };
  } catch { return null; }
}
