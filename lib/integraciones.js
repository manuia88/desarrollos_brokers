// ============================================================
// Capa de integraciones. Cada proveedor se ACTIVA solo cuando
// sus variables de entorno están presentes en Vercel. Sin ellas,
// las funciones no hacen nada (no-op) y el resto del portal sigue igual.
// ============================================================

export const PROVIDERS = {
  salesforce: { label: 'Salesforce', env: ['SF_INSTANCE_URL', 'SF_ACCESS_TOKEN'], dir: 'salida', doc: 'Sincroniza leads hacia Salesforce.' },
  hubspot: { label: 'HubSpot', env: ['HUBSPOT_TOKEN'], dir: 'salida', doc: 'Crea contactos en HubSpot al registrar un lead.' },
  ghl: { label: 'GoHighLevel', env: ['GHL_API_KEY'], dir: 'salida', doc: 'Crea contactos en GHL.' },
  easybroker: { label: 'EasyBroker', env: ['EASYBROKER_API_KEY'], dir: 'entrada', doc: 'Importa listados de EasyBroker al catálogo.' },
  meta: { label: 'Meta Lead Ads', env: ['META_VERIFY_TOKEN', 'META_PAGE_TOKEN'], dir: 'entrada', doc: 'Recibe leads de Facebook/Instagram automáticamente.' },
  whatsapp: { label: 'WhatsApp Business (Cloud API)', env: ['WA_PHONE_ID', 'WA_TOKEN'], dir: 'salida', doc: 'Envía mensajes por la API oficial de WhatsApp.' },
  webhook: { label: 'Webhook universal (n8n/Make/Zapier/GHL)', env: ['INTEGRACIONES_WEBHOOK_SECRET'], dir: 'entrada', doc: 'Cualquier herramienta puede crear leads con un POST.' },
};

const has = (...keys) => keys.every(k => !!process.env[k]);

// Estado de cada integración (solo booleanos: nunca expone las llaves).
export function estadoIntegraciones() {
  const out = {};
  for (const [k, p] of Object.entries(PROVIDERS)) out[k] = { ...p, configured: has(...p.env) };
  return out;
}

// ---- SALIDA: empujar un lead a los CRMs configurados ----
export async function pushSalesforce(lead) {
  if (!has('SF_INSTANCE_URL', 'SF_ACCESS_TOKEN')) return { skipped: true };
  const r = await fetch(`${process.env.SF_INSTANCE_URL}/services/data/v60.0/sobjects/Lead`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.SF_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ LastName: lead.nombre || 'Lead', Company: lead.org_nombre || 'Broker Portal', Phone: lead.telefono || null, Email: lead.email || null, LeadSource: lead.fuente || 'Portal Brokers', Description: lead.mensaje || null }),
  });
  return { ok: r.ok, status: r.status };
}
export async function pushHubspot(lead) {
  if (!has('HUBSPOT_TOKEN')) return { skipped: true };
  const [firstname, ...rest] = (lead.nombre || 'Lead').split(' ');
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.HUBSPOT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { firstname, lastname: rest.join(' ') || firstname, phone: lead.telefono || '', email: lead.email || '', hs_lead_status: 'NEW' } }),
  });
  return { ok: r.ok, status: r.status };
}
export async function pushGHL(lead) {
  if (!has('GHL_API_KEY')) return { skipped: true };
  const r = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.GHL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: lead.nombre || 'Lead', phone: lead.telefono || '', email: lead.email || '', source: lead.fuente || 'Portal Brokers' }),
  });
  return { ok: r.ok, status: r.status };
}
// Fan-out: manda el lead a todos los CRMs activos.
export async function dispatchLead(lead) {
  const res = {};
  for (const [name, fn] of [['salesforce', pushSalesforce], ['hubspot', pushHubspot], ['ghl', pushGHL]]) {
    try { res[name] = await fn(lead); } catch (e) { res[name] = { error: String(e?.message || e) }; }
  }
  return res;
}

// ---- SALIDA: WhatsApp Business Cloud API (oficial de Meta) ----
export async function sendWhatsAppCloud(to, texto) {
  if (!has('WA_PHONE_ID', 'WA_TOKEN')) return { skipped: true };
  const num = String(to || '').replace(/[^0-9]/g, '');
  const e164 = num.length === 10 ? '52' + num : num;
  const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: e164, type: 'text', text: { body: texto } }),
  });
  return { ok: r.ok, status: r.status };
}

// ---- ENTRADA: EasyBroker: traer listados ----
export async function fetchEasyBroker(page = 1, limit = 50) {
  if (!has('EASYBROKER_API_KEY')) return { skipped: true, propiedades: [] };
  const r = await fetch(`https://api.easybroker.com/v1/properties?page=${page}&limit=${limit}`, {
    headers: { 'X-Authorization': process.env.EASYBROKER_API_KEY, accept: 'application/json' },
  });
  if (!r.ok) return { ok: false, status: r.status, propiedades: [] };
  const j = await r.json();
  return { ok: true, propiedades: j.content || [], pagination: j.pagination };
}

// ---- SALIDA: publicar una propiedad en EasyBroker (POST/PATCH) ----
// Construye el body de EasyBroker a partir de una unidad + su desarrollo.
export function mapEasyBroker({ ref, title, description, propertyType, status, price, bedrooms, bathrooms, halfBaths, parking, construction, lot, locationName, images }) {
  const body = {
    internal_id: ref,
    property_type: propertyType || 'Departamento',
    title: title || 'Propiedad',
    description: description || title || 'Sin descripción.',
    status: status || 'not_published',            // 'published' | 'not_published' | ...
    operations: [{ type: 'sale', amount: Math.round(price || 0), currency: 'MXN', unit: 'total' }],
    location: { name: locationName || 'México' },
  };
  if (bedrooms != null) body.bedrooms = bedrooms;
  if (bathrooms != null) body.bathrooms = bathrooms;
  if (halfBaths != null) body.half_bathrooms = halfBaths;
  if (parking != null) body.parking_spaces = parking;
  if (construction != null) body.construction_size = Math.round(construction);
  if (lot != null) body.lot_size = Math.round(lot);
  if (images && images.length) body.property_images = images.slice(0, 50).map((url, i) => ({ url, title: title || 'Imagen', position: i + 1 }));
  return body;
}
// Crea (POST) o actualiza (PATCH) una propiedad. Devuelve el external_id.
export async function pushEasyBroker(body, externalId) {
  if (!has('EASYBROKER_API_KEY')) return { skipped: true };
  const url = externalId
    ? `https://api.easybroker.com/v1/properties/${externalId}`
    : 'https://api.easybroker.com/v1/properties';
  const r = await fetch(url, {
    method: externalId ? 'PATCH' : 'POST',
    headers: { 'X-Authorization': process.env.EASYBROKER_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch { /* noop */ }
  return { ok: r.ok, status: r.status, external_id: j?.public_id || j?.id || externalId || null, error: r.ok ? null : (j?.error || j?.message || ('HTTP ' + r.status)) };
}

// ---- ENTRADA: EasyBroker: jalar los leads (contact requests) que generan los anuncios ----
export async function fetchEBContactRequests(page = 1) {
  if (!has('EASYBROKER_API_KEY')) return { skipped: true, leads: [] };
  const r = await fetch(`https://api.easybroker.com/v1/contact_requests?page=${page}&limit=50`, {
    headers: { 'X-Authorization': process.env.EASYBROKER_API_KEY, accept: 'application/json' },
  });
  if (!r.ok) return { ok: false, status: r.status, leads: [] };
  const j = await r.json();
  return { ok: true, leads: j.content || [], pagination: j.pagination };
}

// ---- ENTRADA: Meta Lead Ads: leer el detalle de un leadgen ----
export async function fetchMetaLead(leadgenId) {
  if (!has('META_PAGE_TOKEN')) return null;
  const r = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${process.env.META_PAGE_TOKEN}`);
  if (!r.ok) return null;
  const j = await r.json();
  const campos = {};
  (j.field_data || []).forEach(f => { campos[f.name] = (f.values || [])[0]; });
  return {
    nombre: campos.full_name || campos.name || [campos.first_name, campos.last_name].filter(Boolean).join(' ') || 'Lead de Meta',
    telefono: campos.phone_number || campos.phone || null,
    email: campos.email || null,
  };
}
