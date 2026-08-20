# Sincronización Google Sheets ⇄ Supabase (en vivo, en espejo)

Vincula el Google Sheet "Quiero Casa Brokers" con la base de datos del portal. **El archivo gana**:
lo que está en el Sheet manda, y **lo que ya no está en el Sheet se borra de la base** (espejo).

## Qué sincroniza

| Pestaña del Sheet | Tabla en Supabase | Qué hace |
|---|---|---|
| `Concentrado` | `desarrollos` | Actualiza ficha + columnas de catálogo. Borrar la fila borra el desarrollo (y en cascada sus unidades y media). |
| `AC1 …`, `AI2 …`, … (una por desarrollo) | `unidades` | Una fila = una unidad. *Upsert* por SKU. Borrar la fila borra la unidad. `dev_sku` = primer token del nombre de la pestaña. |
| `Estructura de columnas`, `Catálogos` | — | Se ignoran (referencia). |

## Comportamiento (importante)

- **Editas una celda** → se **actualiza** esa fila en la base. No borra nada (modo `upsert`).
- **Borras una fila** → se **borra** de la base. El espejo compara la pestaña completa contra la base y elimina lo ausente (modo `espejo`), **acotado**:
  - En una pestaña de unidades, el borrado sólo afecta a **ese** desarrollo.
  - En el Concentrado, borrar la fila de un desarrollo lo elimina y **cae en cascada** a sus unidades y media.
- **"Sincronizar TODO"** (menú) → espejo total de todas las pestañas.
- Los **leads / citas / apartados NO se borran** al eliminar un desarrollo o unidad: sólo desaparece el inventario; tu historial se queda.

> Salvaguarda: el borrado sólo ocurre con la **pestaña completa** (al borrar una fila o en "Sincronizar TODO"), nunca en una edición suelta de celda. Además, el espejo del Concentrado no borra si la hoja llega vacía. Cuida no dejar en blanco la celda de **SKU** de una fila que quieras conservar.

## Piezas

1. **Edge Function `sync-desarrollos`** (desplegada, `verify_jwt=false`) — `db/edge/sync-desarrollos/index.ts`.
2. **Tabla `sync_config`** (`db/sync-config.sql`) — el secreto de sincronización.
3. **Apps Script `sync-sheet-a-supabase.gs`** (`db/edge/`) — va pegado en el Google Sheet.

## Instalación del Apps Script (una sola vez) — necesita DOS activadores

1. En el Sheet: **Extensiones → Apps Script**. Borra lo que haya, pega **todo** `sync-sheet-a-supabase.gs`. Guarda.
2. Ícono del reloj ⏰ (**Activadores**) → **+ Agregar activador**, dos veces:
   - función `onEditSync` → evento **"Al editar"** → Guardar.
   - función `onChangeSync` → evento **"Al cambiar"** → Guardar.
   > Se necesitan los dos: "Al editar" no se dispara al **borrar/insertar filas**; para eso sirve "Al cambiar".
3. Recarga el Sheet → menú **🔄 Sincronizar → "Sincronizar TODO"** la primera vez.

## Seguridad

El Apps Script sólo guarda `SYNC_SECRET` (capacidad limitada a actualizar/borrar desarrollos y unidades por SKU), nunca la llave maestra de Supabase.

Rotar el secreto:

```sql
update public.sync_config set sync_secret = encode(gen_random_bytes(24),'hex') where id = 1;
select sync_secret from public.sync_config where id = 1;   -- pega este valor en el .gs
```
