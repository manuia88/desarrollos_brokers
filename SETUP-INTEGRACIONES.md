# Integraciones (Fase 3.8)

Todo el cableado ya está en el código. Cada conector se **activa solo** cuando agregas
sus variables de entorno en **Vercel → Project → Settings → Environment Variables
(Production)** y haces **Redeploy**. Puedes ver el estado en `/integraciones` (super-admin).

## Variable base (para leads de entrada)

| Variable | Para qué |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Ya la usas para Google/recordatorios. Necesaria para que los webhooks escriban leads. |
| `DEFAULT_ORG_ID` | A qué inmobiliaria caen los leads que entran por integración (el `id` de la fila en `orgs`). Si no se define, se usa la primera org. |
| `INTEGRACIONES_WEBHOOK_SECRET` | Un texto secreto que tú inventas (ej. `qc_intg_9f2a...`). Protege el webhook universal y el dispatch. |

## Entrada de leads

### Webhook universal (n8n / Make / Zapier / GoHighLevel / formularios)
- **URL:** `https://TU-DOMINIO/api/webhooks/lead`
- **Método:** `POST` con header `x-webhook-secret: <INTEGRACIONES_WEBHOOK_SECRET>`
- **Body JSON:** `{ "nombre": "...", "telefono": "...", "email": "...", "dev_sku": "opcional", "fuente": "opcional", "org_id": "opcional", "asesor_id": "opcional" }`
- Crea el lead en el CRM al instante. Si mandas `asesor_id`, además le llega aviso.

### Meta Lead Ads (Facebook / Instagram)
| Variable | De dónde |
|---|---|
| `META_VERIFY_TOKEN` | Un texto que tú inventas; lo pones igual en Meta al configurar el webhook. |
| `META_PAGE_TOKEN` | Page Access Token de la app de Meta con permiso `leads_retrieval`. |
- **Callback URL en Meta:** `https://TU-DOMINIO/api/webhooks/meta`
- **Verify Token:** el mismo de `META_VERIFY_TOKEN`.
- Suscribe el campo `leadgen` de tu página. Los leads entran solos con fuente “Meta Lead Ads”.

### EasyBroker (importar listados)
| Variable | De dónde |
|---|---|
| `EASYBROKER_API_KEY` | EasyBroker → Configuración → API. |
- En `/integraciones` toca **Sincronizar ahora**: trae los listados como **desarrollos en borrador** para que los revises y publiques en **Captura**.

## Salida de leads (CRMs)

Cuando registras un lead, se puede empujar automáticamente a estos CRMs. Para activarlo,
crea un **Database Webhook** en Supabase (Database → Webhooks) sobre `INSERT` en `leads`
que haga `POST` a `https://TU-DOMINIO/api/integraciones/dispatch` con el header
`x-webhook-secret`. (También puedes llamarlo desde n8n.)

| Proveedor | Variables |
|---|---|
| Salesforce | `SF_INSTANCE_URL`, `SF_ACCESS_TOKEN` |
| HubSpot | `HUBSPOT_TOKEN` (Private App token) |
| GoHighLevel | `GHL_API_KEY` |

El dispatch ignora los leads que ya entraron por integración (evita bucles).

## WhatsApp Business (API oficial de Meta — Cloud API)

| Variable | De dónde |
|---|---|
| `WA_PHONE_ID` | Phone Number ID en Meta (WhatsApp → API Setup). |
| `WA_TOKEN` | Token permanente del sistema con permiso de mensajería. |

Con esto, los envíos de WhatsApp pueden salir por la API oficial (además del sandbox de
Twilio que ya usan los recordatorios). Nota: los mensajes iniciados por el negocio a más de
24 h necesitan **plantilla aprobada** por Meta.

## Salesforce / HubSpot / Zoho — nota

Los **contratos y la firma** siguen en Salesforce (así lo definiste). Estas integraciones
son para **sincronizar leads e inventario**, no para reemplazar ese flujo.

## Cómo probar

1. Agrega las variables del conector que quieras en Vercel y haz **Redeploy**.
2. Abre `/integraciones` como super-admin: el conector debe aparecer **● Conectado**.
3. Manda un `POST` de prueba al webhook universal (con Postman o `curl`) y revisa que el
   lead aparezca en el CRM.

## Cuotas de IA del Asesor Digital (variables opcionales en Vercel)

| Variable | Default | Qué controla |
|---|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | (ninguna) | Llave de la PLATAFORMA. Si la pones (con tope de gasto en el proveedor), una inmobiliaria nueva SIN llave propia recibe una **prueba gratis**. Si no la pones, el bot le dice "conecta tu llave" desde el primer mensaje. |
| `IA_TRIAL_DIA` | 25 | Respuestas de prueba/día por inmobiliaria con la llave de la plataforma. Al agotarse, el bot invita a conectar su propia llave (aviso 🔑 al asesor). |
| `IA_MAX_DIA` | 500 | Tope anti-abuso/día por inmobiliaria cuando ya usa SU propia llave (protege su factura de un DoS; su uso normal casi nunca lo alcanza). |

Flujo: una inmobiliaria prueba gratis (≤ `IA_TRIAL_DIA` (25 por defecto)) → conecta su llave en **/conexiones** → de ahí corre con su cuenta (BYOK, hasta `IA_MAX_DIA`/día). El cobro con margen (tú facturas a la inmobiliaria) es la Fase F (Stripe), aún no implementada.
