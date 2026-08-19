# Seguridad — variables de entorno requeridas (post-auditoría v5)

Tras la remediación de la auditoría, estas variables se volvieron **obligatorias en producción**
(el código ahora falla cerrado si faltan, en lugar de degradar de forma insegura):

| Variable | Para qué | Obligatoria |
|---|---|---|
| `CONEXIONES_KEY` (o `CONEXIONES_SECRET`) | Cifrado AES de las API keys en `conexiones`. Sin ella, en producción **se rechaza** guardar credenciales (ya no se guardan en texto plano). | Sí, en prod |
| `META_APP_SECRET` | Firma HMAC (`X-Hub-Signature-256`) de los webhooks de WhatsApp Cloud y Meta Lead Ads. Sin ella, los webhooks **no procesan** nada (fail-closed). | Sí, si usas WhatsApp/Meta |
| `WHATSAPP_VERIFY_TOKEN` | Verificación del webhook de WhatsApp (ya **no** hay valor por defecto `quierocasa`). | Sí, si usas WhatsApp |
| `CRON_SECRET` | Autoriza `/api/reminders/run`. Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` automáticamente cuando está configurada. Sin ella, el endpoint **rechaza** todo. | Sí, para recordatorios |
| `META_VERIFY_TOKEN` | Verificación del webhook de Meta Lead Ads. | Si usas Meta Lead Ads |
| `IA_MAX_DIA` | Tope diario de llamadas a la IA por inmobiliaria (default 500). Opcional. | No |

## Notas
- **No** dejes `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` en Vercel si la plataforma no debe pagar: los canales
  públicos (concierge y webhook de WhatsApp) ahora **nunca** usan la llave de plataforma; solo la BYOK del asesor/org.
- Los cambios de base de datos ya están aplicados en Supabase (ver `db/seguridad-v5.sql`).
- Enlaces de cliente: ahora se comparten con un **token opaco** (`?c=<token>`) en vez del id de la tarjeta.
