// Canal Telegram por inmobiliaria (BYOK): token del bot en conexiones (cifrado).
import { createHash } from 'crypto';
import { descifrar } from './cripto';

export const hashToken = t => createHash('sha256').update(String(t)).digest('hex').slice(0, 12);

export async function resolverTelegramPorOrg(db, orgId) {
  const { data } = await db.from('conexiones').select('etiqueta,api_key').eq('proveedor', 'telegram').eq('org_id', orgId).eq('activa', true).limit(1).maybeSingle();
  if (!data) return null;
  const token = descifrar(data.api_key);
  return token ? { token, username: data.etiqueta } : null;
}

// Encuentra la org dueña del webhook por el hash del token (viene en la URL ?k=).
export async function resolverTelegramPorHash(db, k) {
  if (!k) return null;
  const { data } = await db.from('conexiones').select('org_id,api_key').eq('proveedor', 'telegram').eq('activa', true);
  for (const c of (data || [])) {
    const token = descifrar(c.api_key);
    if (token && hashToken(token) === k) return { orgId: c.org_id, token };
  }
  return null;
}

export async function enviarTelegram({ token }, chatId, texto) {
  if (!token || !chatId || !texto) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(texto).slice(0, 3900) }),
    });
    return r.ok;
  } catch { return false; }
}
