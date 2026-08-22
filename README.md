# DesarrollosMX — Portal de Brokers

Next.js 16 (App Router, Turbopack) + React 19 + Supabase (Postgres con RLS). Deploy: Vercel (push a `main` = producción).

## Mapa rápido
- **Público:** `/` landing · `/para/[perfil]` sub-landings · `/f/[sku]` ficha pública con cotizador · `/login` · `/registro` · `/unirme`
- **Broker:** `/hoy` resumen del día · `/buscar` búsqueda con filtros y propuestas · `/portal` catálogo · `/comparar` · `/clientes` · `/crm` · `/seguimiento` · `/copiloto` (IA) · `/precalifica` · `/escrituracion` · `/comisiones` · `/materiales` · `/marca` · `/academia` · `/conexiones`
- **Análisis:** `/metricas` · `/calor` interés · `/cambios` diario de inventario (triggers en Postgres)
- **Admin:** `/kpis` · `/motor` · `/captura` · `/fichas` · `/publicador` · `/pricing` · `/integraciones` · `/altas`
- **API:** `app/api/*` (IA, Google Calendar, WhatsApp Cloud, integraciones, webhooks) — usan `SUPABASE_SERVICE_ROLE_KEY`

## Datos
Supabase `toqgeimczebtndkatczn`. El inventario entra por Google Apps Script ([db/edge/sync-sheet-a-supabase.gs](db/edge/sync-sheet-a-supabase.gs)) → edge function `sync-desarrollos` (upsert por SKU, espejo). Los `db/*.sql` son el registro versionado de migraciones ya aplicadas.

## Convenciones
- Título de desarrollo en UI: SIEMPRE `tituloDev(d)` de `lib/nombre.js` — nunca `d.nombre` crudo (ese es la llave del sync).
- Consultas >1000 filas: `selectAll()` de `lib/supabase.js`.
- Primitivas UI en `components/ui.js`; tokens de diseño en `app/globals.css` (`--mag` / `--lime` sobre fondo oscuro).

## Desarrollo
```bash
npm install
npm test        # golden tests de lib/finance.js (rutas de dinero)
npm run dev
```
CI (GitHub Actions): `npm test` + `npm run build` en cada push. Ver también SEGURIDAD.md y SETUP-*.md.
