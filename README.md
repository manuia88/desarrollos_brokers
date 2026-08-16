# desarrollos_brokers — Portal de Brokers (Quiero Casa)

Next.js (App Router) + Supabase (Postgres con RLS). Diseño dark: negro / magenta / verde lima.

## Rutas
- `/` landing del programa de brokers
- `/login` · `/registro` (Supabase Auth)
- `/portal` catálogo con filtros y vistas inteligentes (requiere sesión)
- `/portal/[sku]` ficha del desarrollo + registrar cliente (CRM)

## Backend
Supabase proyecto `toqgeimczebtndkatczn`: tenancy multi-inmobiliaria, RLS fail-closed,
anti-fraude en leads, audit_log inmutable. La llave anon (pública) está en `lib/supabase.js`.

Deploy: Vercel (framework Next.js autodetectado).
