# Agenda: Cal.com y Google Calendar

## 1) Cal.com — funciona ya, sin configuración

Cada asesor entra a **Mi marca** y pega su link de Cal.com (`cal.com/su-usuario`).
Con eso, su **ficha pública** muestra el botón **"Reservar un horario disponible (en vivo)"**,
que abre su Cal.com con el nombre y el interés prellenados. Cal.com se encarga de la
disponibilidad, los recordatorios y de crear el evento en el Google/Outlook que el asesor
ya tenga conectado en su cuenta de Cal.com.

No necesitas hacer nada más para Cal.com.

---

## 2) Google Calendar directo (OAuth) — requiere configuración una sola vez

Esto conecta la cuenta de Google de cada asesor para que las citas que agenden sus
clientes se creen **solas** en su Google Calendar. El código ya está en la app; solo falta
darle credenciales. Lo haces una vez.

### A. Google Cloud
1. Entra a https://console.cloud.google.com y crea (o elige) un proyecto.
2. **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo: **Externo**. Llena nombre de la app, correo de soporte y de contacto.
   - En **Ámbitos (scopes)** agrega: `.../auth/calendar.events` y `.../auth/userinfo.email`.
   - En **Usuarios de prueba** agrega los correos de los asesores que van a conectar
     (mientras la app esté "En pruebas"). Cuando quieras abrirlo a todos, publica la app.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **URI de redirección autorizado**:
     `https://desarrollos-brokers-portal.vercel.app/api/google/callback`
     (usa tu dominio real si es otro).
   - Guarda y copia el **Client ID** y el **Client Secret**.

### B. Variables de entorno en Vercel
Vercel → tu proyecto → **Settings → Environment Variables**. Agrega (Production):

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | el Client ID de Google |
| `GOOGLE_CLIENT_SECRET` | el Client Secret de Google |
| `GOOGLE_REDIRECT_URI` | `https://desarrollos-brokers-portal.vercel.app/api/google/callback` |
| `SUPABASE_URL` | `https://toqgeimczebtndkatczn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secreta) |

Luego **redeploy** (o haz un push) para que tome las variables.

> ⚠️ La `service_role` es secreta y va **solo** en variables de entorno del servidor.
> Nunca la pongas con prefijo `NEXT_PUBLIC_` ni en el código del cliente.

### C. Conectar
Cada asesor entra a **Mi marca → Agenda y calendario → Conectar Google Calendar**,
autoriza con su cuenta de Google, y listo. A partir de ahí, cada cita agendada desde su
ficha (o desde el CRM) se crea automáticamente en su Google Calendar.

### Notas
- Mientras no existan las variables, el botón "Conectar" avisará que Google no está
  configurado; el resto de la app (incluido Cal.com y el "Agregar a Google Calendar" con
  un clic) sigue funcionando igual.
- La creación del evento es *best-effort*: si algo falla, la cita igual queda registrada en
  el CRM; solo no se habrá creado el evento en Google.
