/**
 * Sincroniza TODO el Google Sheet <-> Supabase, EN VIVO y en ESPEJO. El archivo GANA.
 *
 *   - Pestaña "Concentrado"                    -> tabla desarrollos
 *   - Pestañas por desarrollo (AC1, AI2, ...)  -> tabla unidades (una fila = una unidad)
 *   - Se IGNORAN "Estructura de columnas" y "Catálogos".
 *
 * COMPORTAMIENTO:
 *   • Editas una celda           -> se ACTUALIZA esa fila en la base (no borra nada).
 *   • Borras una fila            -> se BORRA de la base (espejo de la pestaña completa).
 *   • Borras una fila del Concentrado -> se borra ese desarrollo y, en cascada, sus unidades.
 *   • "Sincronizar TODO"         -> espejo total: crea/actualiza lo que hay y borra lo que ya no está.
 *
 * INSTALACIÓN (una sola vez): necesita DOS activadores instalables.
 *  1. Extensiones → Apps Script. Borra lo que haya, pega TODO este archivo y guarda.
 *  2. Ícono del reloj ⏰ (Activadores) → + Agregar activador:
 *       (a) función: onEditSync    → evento: "Al editar"   → Guardar.
 *       (b) función: onChangeSync  → evento: "Al cambiar"  → Guardar.
 *     (Autoriza los permisos que pida. Se necesitan los DOS: "Al editar" no se dispara al
 *      borrar/insertar filas; para eso sirve "Al cambiar".)
 *  3. Recarga el Sheet → menú "🔄 Sincronizar" → "Sincronizar TODO" la primera vez.
 *
 * SEGURIDAD: sólo guarda el SYNC_SECRET (capacidad limitada a "actualizar/borrar por SKU"),
 * nunca la llave maestra de Supabase.
 */

// ==== CONFIG ====
var FUNCTION_URL = 'https://toqgeimczebtndkatczn.supabase.co/functions/v1/sync-desarrollos';
var SYNC_SECRET  = 'fd92f12b8a17bdda3b5f68433fa2d26b150ced9d8420d328';

var TAB_CONCENTRADO = 'Concentrado';
var TABS_IGNORAR    = ['Estructura de columnas', 'Catálogos'];

// ---- Menú ----
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Sincronizar')
    .addItem('Sincronizar TODO (espejo, todas las pestañas)', 'syncTodo')
    .addItem('Sincronizar solo la hoja activa (espejo)', 'syncHojaActiva')
    .addToUi();
}

function _clasificar(nombre) {
  if (TABS_IGNORAR.indexOf(nombre) >= 0) return { tipo: 'ignorar' };
  if (nombre === TAB_CONCENTRADO)        return { tipo: 'desarrollos' };
  return { tipo: 'unidades', devSku: String(nombre).trim().split(/\s+/)[0] };
}

function _headerConcentrado(sheet) {
  var n = Math.min(sheet.getLastRow(), 20); if (n < 1) return -1;
  var vals = sheet.getRange(1, 1, n, sheet.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++)
    for (var j = 0; j < vals[i].length; j++)
      if (String(vals[i][j]).trim() === 'Código / SKU') return i + 1;
  return -1;
}
function _headerUnidades(sheet) {
  var n = Math.min(sheet.getLastRow(), 20); if (n < 1) return -1;
  var vals = sheet.getRange(1, 1, n, sheet.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    var fila = vals[i].map(function (x) { return String(x).trim(); });
    if (fila.indexOf('SKU') >= 0 && fila.indexOf('Torre') >= 0) return i + 1;
  }
  return -1;
}
function _headerRow(sheet, tipo) {
  return tipo === 'desarrollos' ? _headerConcentrado(sheet) : _headerUnidades(sheet);
}

function _post(payload) {
  var res = UrlFetchApp.fetch(FUNCTION_URL, {
    method: 'post', contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  return res.getResponseCode() + ' ' + res.getContentText();
}

// Envía la pestaña COMPLETA en modo espejo (crea/actualiza + borra lo ausente).
function _mirror(sheet) {
  var cls = _clasificar(sheet.getName());
  if (cls.tipo === 'ignorar') return null;
  var hr = _headerRow(sheet, cls.tipo);
  if (hr < 0) return null;
  var lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  var nRows = Math.max(lastRow - hr + 1, 1);                 // al menos el encabezado (0 filas = vaciar)
  var values = sheet.getRange(hr, 1, nRows, lastCol).getValues();
  var payload = { kind: cls.tipo, modo: 'espejo', values: values };
  if (cls.tipo === 'unidades') payload.dev_sku = cls.devSku;
  return _post(payload);
}

// ---- EN VIVO: edición de celda -> ACTUALIZA (no borra) ----
function onEditSync(e) {
  try {
    var sheet = e.range.getSheet();
    var cls = _clasificar(sheet.getName());
    if (cls.tipo === 'ignorar') return;
    var hr = _headerRow(sheet, cls.tipo);
    if (hr < 0) return;
    var lastCol = sheet.getLastColumn();
    var header = sheet.getRange(hr, 1, 1, lastCol).getValues()[0];
    var from = Math.max(e.range.getRow(), hr + 1);
    var to = e.range.getLastRow();
    if (to < from) return;                                   // se editó el encabezado o arriba
    var filas = sheet.getRange(from, 1, to - from + 1, lastCol).getValues();
    var payload = { kind: cls.tipo, modo: 'upsert', values: [header].concat(filas) };  // upsert: NUNCA borra
    if (cls.tipo === 'unidades') payload.dev_sku = cls.devSku;
    _post(payload);
  } catch (err) { console.error(err); }
}

// ---- EN VIVO: se borró/insertó una fila -> ESPEJO de la hoja activa (reconcilia borrados) ----
function onChangeSync(e) {
  try {
    var t = e && e.changeType ? e.changeType : '';
    // Sólo cambios estructurales de filas. (EDIT ya lo cubre onEditSync.)
    if (t !== 'REMOVE_ROW' && t !== 'INSERT_ROW') return;
    var sheet = (e.source || SpreadsheetApp.getActiveSpreadsheet()).getActiveSheet();
    var cls = _clasificar(sheet.getName());
    if (cls.tipo === 'ignorar') return;
    _mirror(sheet);
  } catch (err) { console.error(err); }
}

// ---- Espejo COMPLETO (manual): recorre TODAS las pestañas de datos ----
function syncTodo() {
  var hojas = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var lineas = [], okCount = 0, skip = 0;
  for (var i = 0; i < hojas.length; i++) {
    var cls = _clasificar(hojas[i].getName());
    if (cls.tipo === 'ignorar') { skip++; continue; }
    var r = _mirror(hojas[i]);
    if (r === null) { lineas.push('• ' + hojas[i].getName() + ': (sin encabezado / vacía)'); continue; }
    okCount++;
    lineas.push('• ' + hojas[i].getName() + '  →  ' + r);
  }
  SpreadsheetApp.getUi().alert(
    'Espejo COMPLETO enviado.\nPestañas sincronizadas: ' + okCount + '   (ignoradas: ' + skip + ')\n\n' +
    lineas.join('\n')
  );
}

// ---- Espejo de la hoja activa (manual) ----
function syncHojaActiva() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cls = _clasificar(sheet.getName());
  if (cls.tipo === 'ignorar') {
    SpreadsheetApp.getUi().alert('La pestaña "' + sheet.getName() + '" es de referencia y no se sincroniza.');
    return;
  }
  var r = _mirror(sheet);
  SpreadsheetApp.getUi().alert(
    (r === null) ? 'No encontré el encabezado esperado en "' + sheet.getName() + '".'
                 : 'Espejo enviado (' + sheet.getName() + ').\n\nRespuesta de Supabase:\n' + r
  );
}
