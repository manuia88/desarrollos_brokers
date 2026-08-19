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
