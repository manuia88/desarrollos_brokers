# Recordatorios de citas (WhatsApp + Email)

## Qué hace
Un job en Supabase (pg_cron) llama cada 15 min a `/api/reminders/run`. El worker:
- Solo actúa entre **8am y 8pm** (hora de México).
- Busca las citas activas y, cuando faltan **12 h** y **2 h**, manda recordatorio al
  **cliente** y al **broker** por **WhatsApp** y **correo**.
- No repite: guarda cada envío en `reminders_enviados`.

El cron **ya quedó agendado** en tu Supabase. Solo faltan las credenciales de los
proveedores (variables de entorno en Vercel). Sin ellas, el worker corre pero no envía.

## Variables de entorno en Vercel (Production)

| Variable | Valor / de dónde |
|---|---|
| `CRON_SECRET` | `qc_rem_9f3a72c1b8e4` (debe ser EXACTAMENTE este; es el que manda el cron) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (la misma de Google) |
| `TWILIO_ACCOUNT_SID` | Twilio → Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio → Auth Token |
| `TWILIO_WHATSAPP_FROM` | tu número de WhatsApp en Twilio, ej. `whatsapp:+52...` (o el sandbox `whatsapp:+14155238886`) |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM` | remitente verificado, ej. `Quiero Casa <citas@tudominio.com>` |

Después de agregarlas, **redeploy**.

## WhatsApp (Twilio) — nota importante
Los mensajes de WhatsApp iniciados por el negocio (como un recordatorio) requieren una
**plantilla aprobada** por Meta si pasaron más de 24 h sin que el cliente escriba. Para
**probar** usa el **Sandbox de WhatsApp** de Twilio (el cliente manda "join <palabra>" al
número sandbox una vez). Para producción, da de alta una plantilla de recordatorio en Twilio.

## Email (Resend)
Crea una cuenta en resend.com, verifica tu dominio (o usa el remitente de prueba), y copia
la API key. `RESEND_FROM` debe usar un dominio verificado para no caer en spam.

## Probar a mano
`GET https://desarrollos-brokers-portal.vercel.app/api/reminders/run` con el header
`x-cron-secret: qc_rem_9f3a72c1b8e4`. Responde `{ ok, enviados }` o `{ skipped: 'fuera-de-horario' }`.

## Cambiar el horario / frecuencia
El job vive en Supabase (pg_cron, `recordatorios-citas`, cada 15 min). La ventana 8am-8pm y
los tiempos 12 h / 2 h están en el worker (`app/api/reminders/run/route.js`). Se pueden ajustar ahí.

## Requisitos de datos
- El **broker** necesita teléfono/correo en **Mi marca** (o su perfil) para recibir el aviso.
- El **cliente** aporta teléfono y correo al agendar en la ficha pública.
