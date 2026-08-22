'use client';
// Genera una propuesta comercial brandeada (PDF y PowerPoint) con la cotización
// del cliente y un QR a la ficha pública en vivo. Todo en el navegador.

const money = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-MX');

function loadImg(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

// Normaliza cualquier imagen (incluye WebP) a JPEG dataURL para incrustar.
async function imgJpeg(url, maxW = 1400) {
  if (!url) return null;
  try {
    const img = await loadImg(url);
    const scale = Math.min(1, maxW / (img.width || maxW));
    const w = Math.max(1, Math.round((img.width || maxW) * scale));
    const h = Math.max(1, Math.round((img.height || maxW) * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return { data: c.toDataURL('image/jpeg', 0.86), w, h };
  } catch { return null; }
}

async function assets(p) {
  const QRCode = (await import('qrcode')).default;
  const [portada, logo] = await Promise.all([
    imgJpeg(p.portadaUrl, 1400),
    imgJpeg(p.asesor?.org_logo, 500),
  ]);
  let qr = null;
  try { if (p.link) qr = await QRCode.toDataURL(p.link, { margin: 1, width: 420 }); } catch { qr = null; }
  return { portada, logo, qr };
}

export async function generarPDF(p) {
  const { jsPDF } = await import('jspdf');
  const { portada, logo, qr } = await assets(p);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 14;
  const mag = [255, 30, 122], ink = [22, 22, 26], sub = [120, 120, 132], line = [225, 225, 232];
  const F = (s = 'normal') => doc.setFont('helvetica', s);

  // ---------- PAGE 1 · Portada ----------
  doc.setFillColor(...mag); doc.rect(0, 0, W, 4, 'F');
  if (logo) { const lw = 34, lh = Math.min(16, lw * logo.h / logo.w); doc.addImage(logo.data, 'JPEG', M, 12, lw, lh); }
  else { doc.setFontSize(13); doc.setTextColor(...ink); F('bold'); doc.text(p.asesor?.org_nombre || 'DesarrollosMX', M, 20); }
  doc.setFontSize(9); doc.setTextColor(...sub); F('normal'); doc.text('PROPUESTA COMERCIAL', W - M, 19, { align: 'right' });

  let y = 32;
  if (portada) { const iw = W - 2 * M, ih = Math.min(120, iw * portada.h / portada.w); doc.addImage(portada.data, 'JPEG', M, y, iw, ih); y += ih + 10; }
  else { doc.setFillColor(245, 245, 248); doc.rect(M, y, W - 2 * M, 55, 'F'); doc.setTextColor(...sub); doc.setFontSize(10); doc.text('Sube una portada en Gestionar medios', W / 2, y + 30, { align: 'center' }); y += 65; }

  doc.setTextColor(...ink); F('bold'); doc.setFontSize(22); doc.text(p.dev.nombre, M, y); y += 7;
  F('normal'); doc.setFontSize(11); doc.setTextColor(...sub);
  doc.text([p.dev.colonia, p.dev.alcaldia, p.dev.estado].filter(Boolean).join(', '), M, y); y += 12;
  doc.setTextColor(...mag); F('bold'); doc.setFontSize(9); doc.text('DESDE', M, y);
  doc.setTextColor(...ink); doc.setFontSize(21); doc.text(money(p.dev.precio_min), M, y + 8);

  const fy = H - 34;
  doc.setDrawColor(...line); doc.setFillColor(250, 250, 252); doc.roundedRect(M, fy, W - 2 * M, 22, 2, 2, 'FD');
  doc.setFontSize(8); doc.setTextColor(...sub); F('normal'); doc.text('TU ASESOR', M + 5, fy + 6);
  doc.setFontSize(12); doc.setTextColor(...ink); F('bold'); doc.text(p.asesor?.nombre || '—', M + 5, fy + 12);
  F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
  doc.text([p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M + 5, fy + 18);

  // ---------- PAGE 2 · Detalle + cotización ----------
  doc.addPage();
  doc.setFillColor(...mag); doc.rect(0, 0, W, 4, 'F');
  let y2 = 20;
  doc.setTextColor(...ink); F('bold'); doc.setFontSize(15); doc.text('Características y cotización', M, y2); y2 += 9;

  const specs = [
    [`${p.dev.rec_min === 0 ? 'Loft' : p.dev.rec_min}–${p.dev.rec_max}`, 'Recámaras'],
    [`${p.dev.banos_min}–${p.dev.banos_max}`, 'Baños'],
    [`${p.dev.estac_min}–${p.dev.estac_max}`, 'Estac.'],
    [`${Math.round(p.dev.m2_min)}–${Math.round(p.dev.m2_max)}`, 'm²'],
  ];
  const sw = (W - 2 * M) / 4;
  specs.forEach((s, i) => {
    const x = M + i * sw;
    doc.setFillColor(248, 248, 250); doc.roundedRect(x + 1, y2, sw - 2, 18, 2, 2, 'F');
    doc.setTextColor(...ink); F('bold'); doc.setFontSize(13); doc.text(String(s[0]), x + sw / 2, y2 + 8, { align: 'center' });
    F('normal'); doc.setFontSize(8); doc.setTextColor(...sub); doc.text(s[1], x + sw / 2, y2 + 14, { align: 'center' });
  });
  y2 += 27;

  F('bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text('Esquema de pago', M, y2); y2 += 6;
  const esqRows = [
    ['Apartado', money(p.esq.apartado)],
    [`Enganche (${Math.round((p.dev.esq_enganche || 0) * 100)}%)`, money(p.esq.enganche)],
    [`Mensualidades en obra${p.meses ? ' (' + p.meses + ')' : ''}`, money(p.esq.mensualidadObra) + (p.meses ? '/mes' : '')],
    ['Contra escritura', money(p.esq.saldoEscritura)],
  ];
  esqRows.forEach(r => {
    doc.setDrawColor(...line); doc.line(M, y2 + 1.5, W - M, y2 + 1.5);
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub); doc.text(r[0], M, y2);
    doc.setTextColor(...ink); F('bold'); doc.text(r[1], W - M, y2, { align: 'right' });
    y2 += 7;
  });
  y2 += 6;

  const boxW = W - 2 * M - 42, boxH = 46, boxY = y2;
  doc.setFillColor(255, 240, 246); doc.roundedRect(M, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(...mag); F('bold'); doc.setFontSize(10); doc.text('Tu crédito hipotecario', M + 5, boxY + 8);
  const credRows = [
    [`Banco: ${p.banco}`, null],
    [`Tasa ${p.tasa}%  ·  ${p.plazo} años`, null],
    ['Monto a financiar', money(p.financiar)],
    ['Mensualidad estimada', money(p.cred.mensualidad)],
  ];
  let cy = boxY + 16; doc.setFontSize(9.5);
  credRows.forEach(r => {
    F('normal'); doc.setTextColor(...sub); doc.text(r[0], M + 5, cy);
    if (r[1]) { F('bold'); doc.setTextColor(...ink); doc.text(r[1], M + boxW - 5, cy, { align: 'right' }); }
    cy += 8;
  });
  if (qr) {
    const qx = W - M - 38;
    doc.addImage(qr, 'PNG', qx, boxY, 38, 38);
    doc.setFontSize(7.5); doc.setTextColor(...sub);
    doc.text('Escanea para ver', qx + 19, boxY + 42, { align: 'center' });
    doc.text('disponibilidad en vivo', qx + 19, boxY + 45, { align: 'center' });
  }
  y2 = boxY + boxH + 12;

  const amen = (p.dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  if (amen.length) {
    F('bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text('Amenidades', M, y2); y2 += 6;
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
    const lines = doc.splitTextToSize(amen.join('   ·   '), W - 2 * M);
    doc.text(lines, M, y2);
  }

  doc.setDrawColor(...line); doc.line(M, H - 18, W - M, H - 18);
  doc.setFontSize(8); doc.setTextColor(...sub); F('normal');
  doc.text([p.asesor?.nombre, p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M, H - 12);
  doc.text('Generado con DesarrollosMX · Información referencial, sujeta a disponibilidad.', M, H - 8);

  doc.save(`Propuesta ${p.dev.nombre}.pdf`);
}

// ── Brochure del DESARROLLO (one-pager comercial, enfocado al proyecto) ──
// Distinto de la propuesta: no lleva cotización de una unidad, sino el resumen
// vendedor del desarrollo (modelos por recámara, esquema, amenidades, ubicación).
function modelosPorRec(units) {
  const g = {};
  (units || []).forEach(u => { const k = u.rec ?? 0; (g[k] = g[k] || []).push(u); });
  return Object.entries(g).map(([rec, us]) => ({
    rec: Number(rec),
    desde: Math.min(...us.map(u => u.precio || Infinity)),
    m2: Math.min(...us.map(u => u.m2_hab || Infinity)),
    n: us.length,
  })).sort((a, b) => a.rec - b.rec);
}
const recTit = r => r === 0 ? 'Loft' : `${r} recámara${r === 1 ? '' : 's'}`;

export async function generarBrochure(p) {
  const { jsPDF } = await import('jspdf');
  const QRCode = (await import('qrcode')).default;
  const dev = p.dev, asesor = p.asesor || {}, units = p.units || [], medios = p.medios || [];
  const IMG = ['portada', 'render', 'foto', 'amenidad', 'planta', 'plano'];
  const portadaM = medios.find(m => m.tipo === 'portada') || medios.find(m => m.tipo === 'render') || medios.find(m => m.tipo === 'foto');
  const galeria = medios.filter(m => IMG.includes(m.tipo) && m.url !== portadaM?.url).slice(0, 3);
  const [portada, logo, ...thumbs] = await Promise.all([
    imgJpeg(portadaM?.url, 1400), imgJpeg(asesor.org_logo, 500),
    ...galeria.map(g => imgJpeg(g.url, 800)),
  ]);
  let qr = null; try { if (p.link) qr = await QRCode.toDataURL(p.link, { margin: 1, width: 420 }); } catch { qr = null; }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 14;
  const mag = [255, 30, 122], ink = [22, 22, 26], sub = [120, 120, 132], line = [225, 225, 232], soft = [248, 248, 250];
  const F = (s = 'normal') => doc.setFont('helvetica', s);
  const mesesE = (() => { if (!dev.fecha_entrega) return null; const h = new Date(), f = new Date(dev.fecha_entrega + 'T12:00'); return Math.max(0, (f.getFullYear() - h.getFullYear()) * 12 + f.getMonth() - h.getMonth()); })();

  // ---------- PAGE 1 · Portada del desarrollo ----------
  doc.setFillColor(...mag); doc.rect(0, 0, W, 4, 'F');
  if (logo) { const lw = 34, lh = Math.min(16, lw * logo.h / logo.w); doc.addImage(logo.data, 'JPEG', M, 12, lw, lh); }
  else { doc.setFontSize(13); doc.setTextColor(...ink); F('bold'); doc.text(asesor.org_nombre || 'DesarrollosMX', M, 20); }
  doc.setFontSize(9); doc.setTextColor(...sub); F('normal'); doc.text('BROCHURE', W - M, 19, { align: 'right' });

  let y = 30;
  if (portada) { const iw = W - 2 * M, ih = Math.min(128, iw * portada.h / portada.w); doc.addImage(portada.data, 'JPEG', M, y, iw, ih); y += ih + 9; }
  else { doc.setFillColor(...soft); doc.rect(M, y, W - 2 * M, 60, 'F'); y += 68; }

  doc.setTextColor(...ink); F('bold'); doc.setFontSize(24); doc.text(dev.nombre || 'Desarrollo', M, y); y += 7;
  F('normal'); doc.setFontSize(11); doc.setTextColor(...sub);
  doc.text([dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', '), M, y); y += 10;

  // Badge etapa + precio desde
  doc.setTextColor(...mag); F('bold'); doc.setFontSize(9); doc.text('DESDE', M, y);
  doc.setTextColor(...ink); doc.setFontSize(21); doc.text(money(dev.precio_min), M, y + 8);
  const etapaTxt = dev.etapa === 'Entrega inmediata' ? 'Entrega inmediata' : (mesesE != null ? `Preventa · ${mesesE} meses` : 'Preventa');
  doc.setFillColor(...soft); doc.roundedRect(W - M - 52, y - 4, 52, 12, 2, 2, 'F');
  doc.setTextColor(...ink); F('bold'); doc.setFontSize(9.5); doc.text(etapaTxt, W - M - 26, y + 3.5, { align: 'center' });

  // Franja de specs
  const fy = H - 40;
  const specs = [
    [`${dev.rec_min === 0 ? 'Loft' : dev.rec_min}–${dev.rec_max}`, 'Recámaras'],
    [`${dev.banos_min}–${dev.banos_max}`, 'Baños'],
    [`${dev.estac_min}–${dev.estac_max}`, 'Estac.'],
    [`${Math.round(dev.m2_min)}–${Math.round(dev.m2_max)}`, 'm²'],
  ];
  const sw = (W - 2 * M) / 4;
  specs.forEach((s, i) => {
    const x = M + i * sw;
    doc.setFillColor(...soft); doc.roundedRect(x + 1, fy, sw - 2, 18, 2, 2, 'F');
    doc.setTextColor(...ink); F('bold'); doc.setFontSize(13); doc.text(String(s[0]), x + sw / 2, fy + 8, { align: 'center' });
    F('normal'); doc.setFontSize(8); doc.setTextColor(...sub); doc.text(s[1], x + sw / 2, fy + 14, { align: 'center' });
  });
  doc.setFontSize(8); doc.setTextColor(...sub); F('normal');
  doc.text([asesor.nombre, asesor.telefono, asesor.org_nombre].filter(Boolean).join('   ·   '), M, H - 12);

  // ---------- PAGE 2 · Modelos, pago, amenidades, ubicación ----------
  doc.addPage();
  doc.setFillColor(...mag); doc.rect(0, 0, W, 4, 'F');
  let y2 = 20;

  // Modelos por recámara
  const modelos = modelosPorRec(units);
  if (modelos.length) {
    doc.setTextColor(...ink); F('bold'); doc.setFontSize(14); doc.text('Modelos disponibles', M, y2); y2 += 7;
    modelos.forEach(mo => {
      doc.setDrawColor(...line); doc.setFillColor(...soft); doc.roundedRect(M, y2, W - 2 * M, 12, 2, 2, 'FD');
      doc.setTextColor(...ink); F('bold'); doc.setFontSize(11); doc.text(recTit(mo.rec), M + 5, y2 + 8);
      F('normal'); doc.setFontSize(9); doc.setTextColor(...sub);
      doc.text(`${isFinite(mo.m2) ? 'desde ' + Math.round(mo.m2) + ' m²' : ''}   ·   ${mo.n} disp.`, M + 48, y2 + 8);
      F('bold'); doc.setTextColor(...ink); doc.setFontSize(11); doc.text('desde ' + money(mo.desde), W - M - 5, y2 + 8, { align: 'right' });
      y2 += 15;
    });
    y2 += 4;
  }

  // Esquema de pago (del desarrollo)
  const fFirma = dev.esq_enganche || 0.15, fObra = dev.esq_mensualidades || 0.10, fEsc = dev.esq_escritura || 0.75;
  const base = dev.precio_min || 0;
  F('bold'); doc.setFontSize(12); doc.setTextColor(...ink); doc.text('Esquema de pago', M, y2); y2 += 2;
  F('normal'); doc.setFontSize(8.5); doc.setTextColor(...sub); doc.text(`sobre precio desde ${money(base)}`, M + 42, y2); y2 += 5;
  const esqRows = [
    ['Apartado', money(dev.apartado || 0)],
    [`Firma de contrato (${Math.round(fFirma * 100)}%)`, money(Math.round(base * fFirma))],
    [`Mensualidades en obra (${Math.round(fObra * 100)}%)`, money(Math.round(base * fObra))],
    [`Contra escritura (${Math.round(fEsc * 100)}%)`, money(Math.round(base * fEsc))],
  ];
  esqRows.forEach(r => {
    doc.setDrawColor(...line); doc.line(M, y2 + 1.5, W - M, y2 + 1.5);
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub); doc.text(r[0], M, y2);
    doc.setTextColor(...ink); F('bold'); doc.text(r[1], W - M, y2, { align: 'right' });
    y2 += 7;
  });
  y2 += 6;

  // Amenidades
  const amen = (dev.amenidades || '').split(',').map(s => s.trim()).filter(Boolean);
  if (amen.length) {
    F('bold'); doc.setFontSize(12); doc.setTextColor(...ink); doc.text('Amenidades', M, y2); y2 += 6;
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
    const lines = doc.splitTextToSize(amen.join('   ·   '), W - 2 * M);
    doc.text(lines, M, y2); y2 += lines.length * 5 + 6;
  }

  // Thumbnails de galería
  if (thumbs.filter(Boolean).length) {
    const tw = (W - 2 * M - 8) / 3, th = 26;
    thumbs.filter(Boolean).slice(0, 3).forEach((t, i) => {
      doc.addImage(t.data, 'JPEG', M + i * (tw + 4), y2, tw, th);
    });
    y2 += th + 8;
  }

  // Ubicación + créditos + QR
  const credAcept = [dev.credito_bancario && 'Bancario', dev.credito_ion && 'ION', dev.credito_hir && 'HIR Casa', dev.credito_yave && 'Yave']
    .filter(v => v && true).filter((v, i, arr) => arr.indexOf(v) === i);
  const boxY = Math.min(y2, H - 60), boxW = qr ? W - 2 * M - 44 : W - 2 * M;
  doc.setFillColor(255, 240, 246); doc.roundedRect(M, boxY, boxW, 46, 2, 2, 'F');
  doc.setTextColor(...mag); F('bold'); doc.setFontSize(10); doc.text('Ubicación', M + 5, boxY + 8);
  F('normal'); doc.setTextColor(...ink); doc.setFontSize(9.5);
  const dirLines = doc.splitTextToSize([dev.direccion, dev.colonia, dev.alcaldia, dev.estado].filter(Boolean).join(', '), boxW - 10);
  doc.text(dirLines, M + 5, boxY + 15);
  const credLabels = [dev.credito_bancario && 'Bancario', dev.credito_ion && 'ION', dev.credito_hir && 'HIR Casa'].filter(Boolean);
  if (credLabels.length) { doc.setTextColor(...sub); doc.setFontSize(9); doc.text('Créditos: ' + credLabels.join(', '), M + 5, boxY + 15 + dirLines.length * 5 + 4); }
  if (qr) {
    const qx = W - M - 40;
    doc.addImage(qr, 'PNG', qx, boxY + 3, 38, 38);
    doc.setFontSize(7.5); doc.setTextColor(...sub);
    doc.text('Escanea para ver', qx + 19, boxY + 44, { align: 'center' });
  }

  doc.setDrawColor(...line); doc.line(M, H - 16, W - M, H - 16);
  doc.setFontSize(8); doc.setTextColor(...sub); F('normal');
  doc.text([asesor.nombre, asesor.telefono, asesor.org_nombre].filter(Boolean).join('   ·   '), M, H - 11);
  doc.text('Generado con DesarrollosMX · Información referencial, sujeta a disponibilidad.', M, H - 7);

  doc.save(`Brochure ${dev.nombre}.pdf`);
}

export async function generarPPTX(p) {
  const pptxgen = (await import('pptxgenjs')).default;
  const { portada, logo, qr } = await assets(p);
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'W', width: 13.33, height: 7.5 });
  pptx.layout = 'W';
  const MAG = 'FF1E7A', INK = '16161A', SUB = '6E6E7A';

  const s = pptx.addSlide(); s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: MAG } });
  if (logo) s.addImage({ data: logo.data, x: 0.5, y: 0.35, w: 1.7, h: 1.7 * logo.h / logo.w });
  else s.addText(p.asesor?.org_nombre || 'DesarrollosMX', { x: 0.5, y: 0.4, w: 6, h: 0.6, bold: true, fontSize: 18, color: INK });
  s.addText('PROPUESTA COMERCIAL', { x: 7.33, y: 0.5, w: 5.5, h: 0.4, align: 'right', fontSize: 11, color: SUB });
  if (portada) s.addImage({ data: portada.data, x: 0.5, y: 1.6, w: 7.2, h: 5.3, sizing: { type: 'cover', w: 7.2, h: 5.3 } });
  else s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.6, w: 7.2, h: 5.3, fill: { color: 'F2F2F5' } });
  s.addText(p.dev.nombre, { x: 8, y: 1.7, w: 4.9, h: 1.1, bold: true, fontSize: 26, color: INK });
  s.addText([p.dev.colonia, p.dev.alcaldia].filter(Boolean).join(', '), { x: 8, y: 2.8, w: 4.9, h: 0.4, fontSize: 12, color: SUB });
  s.addText([{ text: 'DESDE\n', options: { fontSize: 10, color: MAG, bold: true } }, { text: money(p.dev.precio_min), options: { fontSize: 24, color: INK, bold: true } }], { x: 8, y: 3.4, w: 4.9, h: 1 });
  s.addText([{ text: (p.asesor?.nombre || 'Tu asesor') + '\n', options: { bold: true } }, { text: [p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('  ·  '), options: { color: SUB } }], { x: 8, y: 5.9, w: 4.9, h: 1, fontSize: 13, color: INK });

  const s2 = pptx.addSlide(); s2.background = { color: 'FFFFFF' };
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: MAG } });
  s2.addText('Características y cotización', { x: 0.5, y: 0.35, w: 12, h: 0.6, bold: true, fontSize: 22, color: INK });
  const specs = [
    [`${p.dev.rec_min === 0 ? 'Loft' : p.dev.rec_min}-${p.dev.rec_max}`, 'Recámaras'],
    [`${p.dev.banos_min}-${p.dev.banos_max}`, 'Baños'],
    [`${p.dev.estac_min}-${p.dev.estac_max}`, 'Estac.'],
    [`${Math.round(p.dev.m2_min)}-${Math.round(p.dev.m2_max)}`, 'm²'],
  ];
  specs.forEach((sp, i) => {
    const x = 0.5 + i * 3.07;
    s2.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 2.9, h: 1.2, fill: { color: 'F5F5F8' }, rectRadius: 0.06 });
    s2.addText(String(sp[0]), { x, y: 1.35, w: 2.9, h: 0.6, align: 'center', bold: true, fontSize: 18, color: INK });
    s2.addText(sp[1], { x, y: 1.95, w: 2.9, h: 0.4, align: 'center', fontSize: 11, color: SUB });
  });
  const rows = [
    ['Apartado', money(p.esq.apartado)],
    [`Enganche (${Math.round((p.dev.esq_enganche || 0) * 100)}%)`, money(p.esq.enganche)],
    ['Mensualidades en obra', money(p.esq.mensualidadObra) + (p.meses ? '/mes' : '')],
    ['Contra escritura', money(p.esq.saldoEscritura)],
    [`Crédito · ${p.banco}`, `${p.tasa}% / ${p.plazo} años`],
    ['Monto a financiar', money(p.financiar)],
    ['Mensualidad estimada', money(p.cred.mensualidad)],
  ];
  s2.addTable(rows.map(r => [
    { text: r[0], options: { color: SUB } },
    { text: r[1], options: { align: 'right', bold: true, color: INK } },
  ]), { x: 0.5, y: 2.85, w: 8, colW: [5, 3], fontSize: 12, rowH: 0.42, border: { type: 'solid', color: 'E5E5EA', pt: 0.5 } });
  if (qr) {
    s2.addImage({ data: qr, x: 10.3, y: 3, w: 2.2, h: 2.2 });
    s2.addText('Escanea para ver\ndisponibilidad en vivo', { x: 9.8, y: 5.3, w: 3.2, h: 0.6, align: 'center', fontSize: 10, color: SUB });
  }
  s2.addText('Generado con DesarrollosMX · Información referencial, sujeta a disponibilidad.', { x: 0.5, y: 7, w: 12, h: 0.3, fontSize: 9, color: SUB });

  await pptx.writeFile({ fileName: `Propuesta ${p.dev.nombre}.pptx` });
}

// ── Propuesta COMERCIAL CON TU MARCA desde el shortlist ──
// Documento de venta hiperpersonalizado: portada con el nombre del cliente,
// una página por desarrollo (unidad recomendada, características, esquema de pago,
// amenidades, por qué le queda, escasez y urgencia) y un cierre con oferta de valor.
// Lleva el logo del broker y NUNCA muestra la comisión.
export async function generarPropuestaShortlist(p) {
  const { jsPDF } = await import('jspdf');
  const logo = await imgJpeg(p.asesor?.org_logo, 500);
  let qr = null;
  try { if (p.link) { const QRCode = (await import('qrcode')).default; qr = await QRCode.toDataURL(p.link, { margin: 1, width: 420 }); } } catch { qr = null; }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 16;
  const mag = [255, 30, 122], ink = [20, 20, 26], sub = [110, 112, 124], line = [228, 228, 234], soft = [249, 247, 250], magSoft = [255, 238, 245];
  const F = (s = 'normal') => doc.setFont('helvetica', s);
  const items = p.items || [];
  const cliente = (p.cliente || '').trim();
  const nombreCorto = cliente ? cliente.split(' ')[0] : '';

  const ribbon = () => { doc.setFillColor(...mag); doc.rect(0, 0, W, 5, 'F'); };
  const marca = (yTop = 12) => {
    if (logo) { const lw = 30, lh = Math.min(14, lw * logo.h / logo.w); doc.addImage(logo.data, 'JPEG', M, yTop, lw, lh); }
    else { F('bold'); doc.setFontSize(12); doc.setTextColor(...ink); doc.text(p.asesor?.org_nombre || 'Propuesta', M, yTop + 7); }
  };
  const pie = (txt) => {
    doc.setDrawColor(...line); doc.line(M, H - 16, W - M, H - 16);
    F('normal'); doc.setFontSize(7.6); doc.setTextColor(...sub);
    doc.text([p.asesor?.nombre, p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M, H - 11);
    doc.text(txt || 'Información referencial. Precios, disponibilidad y esquemas sujetos a cambio sin previo aviso.', M, H - 7.5);
  };
  const bullet = (x, y2) => { doc.setFillColor(...mag); doc.circle(x, y2 - 1.1, 1.05, 'F'); };

  // ---------------- PORTADA ----------------
  ribbon(); marca(12);
  F('normal'); doc.setFontSize(8.5); doc.setTextColor(...sub); doc.text('PROPUESTA PERSONALIZADA', W - M, 18, { align: 'right' });
  let y = 56;
  F('bold'); doc.setTextColor(...ink); doc.setFontSize(29);
  const titulo = p.titulo || (cliente ? `${nombreCorto}, esto es lo que encontré para ti` : 'Opciones hechas a tu medida');
  const tLines = doc.splitTextToSize(titulo, W - 2 * M);
  doc.text(tLines, M, y); y += tLines.length * 11 + 4;
  if (p.sub) { F('normal'); doc.setFontSize(12.5); doc.setTextColor(...sub); const sLines = doc.splitTextToSize(p.sub, W - 2 * M); doc.text(sLines, M, y); y += sLines.length * 6.4 + 8; }

  if (p.critTxt) {
    doc.setFillColor(...magSoft); doc.roundedRect(M, y, W - 2 * M, 23, 3, 3, 'F');
    F('bold'); doc.setFontSize(9); doc.setTextColor(...mag); doc.text('LO QUE ME PEDISTE', M + 6, y + 8);
    F('normal'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text(doc.splitTextToSize(p.critTxt, W - 2 * M - 12), M + 6, y + 15.5);
    y += 31;
  }

  F('bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text(`${items.length} ${items.length === 1 ? 'opción seleccionada para ti' : 'opciones seleccionadas para ti'}`, M, y); y += 9;
  items.forEach((it, i) => {
    F('bold'); doc.setFontSize(11); doc.setTextColor(...mag); doc.text(`${i + 1}.`, M, y);
    doc.setTextColor(...ink); doc.text(it.nombre, M + 7, y);
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
    doc.text(`${[it.colonia, it.alcaldia].filter(Boolean).join(', ')}   ·   desde ${money(it.min)}`, M + 7, y + 5);
    y += 13;
  });

  const fy = H - 44;
  doc.setDrawColor(...line); doc.setFillColor(...soft); doc.roundedRect(M, fy, W - 2 * M, 26, 3, 3, 'FD');
  F('normal'); doc.setFontSize(8); doc.setTextColor(...sub); doc.text('TU ASESOR', M + 6, fy + 7);
  F('bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text(p.asesor?.nombre || '—', M + 6, fy + 14.5);
  F('normal'); doc.setFontSize(10); doc.setTextColor(...sub); doc.text([p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M + 6, fy + 21);
  if (qr) doc.addImage(qr, 'PNG', W - M - 23, fy + 2, 22, 22);
  pie();

  // ---------------- UNA PÁGINA POR DESARROLLO ----------------
  items.forEach((it, idx) => {
    doc.addPage(); ribbon(); marca(11);
    F('normal'); doc.setFontSize(8.5); doc.setTextColor(...sub); doc.text(`OPCIÓN ${idx + 1} DE ${items.length}`, W - M, 17, { align: 'right' });
    let yy = 32;
    F('bold'); doc.setFontSize(19); doc.setTextColor(...ink);
    const hLines = doc.splitTextToSize(it.headline || it.nombre, W - 2 * M);
    doc.text(hLines, M, yy); yy += hLines.length * 8 + 2;
    F('normal'); doc.setFontSize(11); doc.setTextColor(...sub);
    doc.text(`${it.nombre}   ·   ${[it.colonia, it.alcaldia].filter(Boolean).join(', ')}`, M, yy); yy += 10;

    // Precio + escasez/urgencia
    F('bold'); doc.setFontSize(9); doc.setTextColor(...mag); doc.text('DESDE', M, yy);
    doc.setTextColor(...ink); doc.setFontSize(23); doc.text(money(it.min), M, yy + 9);
    if (it.max && it.max !== it.min) { F('normal'); doc.setFontSize(10); doc.setTextColor(...sub); doc.text(`hasta ${money(it.max)}`, M, yy + 15); }
    F('bold'); doc.setFontSize(9.5); doc.setTextColor(...mag);
    doc.text(`Solo ${it.disponibles} disponible${it.disponibles === 1 ? '' : 's'}`, W - M, yy + 2, { align: 'right' });
    F('normal'); doc.setFontSize(9); doc.setTextColor(...sub);
    doc.text(it.entrega === 'Entrega inmediata' ? 'Entrega inmediata' : (it.meses != null ? `Entrega ~${it.meses} meses` : 'Preventa'), W - M, yy + 8, { align: 'right' });
    if (it.descuento) { F('bold'); doc.setFontSize(9); doc.setTextColor(...mag); doc.text('Promoción vigente', W - M, yy + 14, { align: 'right' }); }
    yy += 22;

    // Specs grid
    const specs = [
      [`${it.rec_min === 0 ? 'Loft' : it.rec_min}${it.rec_max && it.rec_max !== it.rec_min ? '–' + it.rec_max : ''}`, 'Recámaras'],
      [`${it.banos_min || '—'}${it.banos_max && it.banos_max !== it.banos_min ? '–' + it.banos_max : ''}`, 'Baños'],
      [`${it.estac_min || '—'}${it.estac_max && it.estac_max !== it.estac_min ? '–' + it.estac_max : ''}`, 'Estac.'],
      [`${Math.round(it.m2_min || 0)}${it.m2_max && it.m2_max !== it.m2_min ? '–' + Math.round(it.m2_max) : ''}`, 'm2'],
    ];
    const sw = (W - 2 * M) / 4;
    specs.forEach((s, i) => {
      const x = M + i * sw; doc.setFillColor(...soft); doc.roundedRect(x + 1, yy, sw - 2, 16, 2, 2, 'F');
      F('bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text(String(s[0]), x + sw / 2, yy + 7, { align: 'center' });
      F('normal'); doc.setFontSize(7.5); doc.setTextColor(...sub); doc.text(s[1], x + sw / 2, yy + 12.5, { align: 'center' });
    });
    yy += 24;

    // Unidad recomendada
    if (it.reco) {
      doc.setDrawColor(...mag); doc.setFillColor(...magSoft); doc.roundedRect(M, yy, W - 2 * M, 21, 2.5, 2.5, 'FD');
      F('bold'); doc.setFontSize(8.5); doc.setTextColor(...mag); doc.text('LA UNIDAD QUE TE RECOMIENDO', M + 5, yy + 7);
      const u = it.reco;
      const idu = [u.prototipo || u.num || 'Unidad', u.torre ? `Torre ${u.torre}` : null, (u.nivel != null && u.nivel !== '') ? `Piso ${u.nivel}` : null].filter(Boolean).join('  ·  ');
      F('bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text(idu, M + 5, yy + 13.5);
      F('normal'); doc.setFontSize(9); doc.setTextColor(...sub);
      const specu = [u.rec === 0 ? 'Loft' : `${u.rec} rec`, u.banos ? `${u.banos} baños` : null, u.m2 ? `${u.m2} m2` : null].filter(Boolean).join('  ·  ');
      doc.text(specu, M + 5, yy + 18);
      F('bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text(money(u.precio), W - M - 5, yy + 14, { align: 'right' });
      yy += 27;
    }

    // Cómo se paga
    F('bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text('Cómo se paga', M, yy); yy += 6;
    const rows = [];
    if (it.esq?.apartado) rows.push(['Apartado', money(it.esq.apartado)]);
    if (it.esq?.enganche) rows.push([`Enganche (${it.esq.enganchePct}%)`, money(it.esq.enganche)]);
    if (it.esq?.meses && it.esq?.mensualidadObra) rows.push([`Mensualidades en obra (${it.esq.meses})`, money(it.esq.mensualidadObra) + '/mes']);
    if (it.esq?.saldoEscritura) rows.push(['Contra escritura (con crédito)', money(it.esq.saldoEscritura)]);
    rows.push(['Mensualidad hipotecaria estimada', money(it.mens)]);
    rows.push(['Ingreso mensual sugerido', money(it.ingreso)]);
    rows.forEach(r => {
      doc.setDrawColor(...line); doc.line(M, yy + 1.5, W - M, yy + 1.5);
      F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub); doc.text(r[0], M, yy);
      F('bold'); doc.setTextColor(...ink); doc.text(r[1], W - M, yy, { align: 'right' }); yy += 7;
    });
    if (it.creditos?.length) { yy += 2; F('normal'); doc.setFontSize(9); doc.setTextColor(...sub); doc.text('Créditos aceptados: ' + it.creditos.join(', '), M, yy); yy += 6; }

    if (p.inversor && it.yld != null) {
      doc.setFillColor(...soft); doc.roundedRect(M, yy, W - 2 * M, 13, 2, 2, 'F');
      F('bold'); doc.setFontSize(10); doc.setTextColor(...mag);
      doc.text(`Renta estimada ~${money(it.renta)}/mes  ·  ${it.yld}% yield bruto${it.zonaTxt ? '  ·  precio/m2 ' + it.zonaTxt : ''}`, M + 5, yy + 8.5);
      yy += 17;
    } else { yy += 2; }

    // Amenidades
    if (it.amenidades?.length) {
      F('bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text('Amenidades y extras', M, yy); yy += 6;
      F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
      const aLines = doc.splitTextToSize(it.amenidades.join('   ·   '), W - 2 * M);
      doc.text(aLines, M, yy); yy += aLines.length * 5 + 4;
    }

    // Por qué le queda
    if (it.porque?.length) {
      const boxH = 10 + it.porque.length * 6.2 + 2;
      doc.setFillColor(...magSoft); doc.roundedRect(M, yy, W - 2 * M, boxH, 2.5, 2.5, 'F');
      F('bold'); doc.setFontSize(9.5); doc.setTextColor(...mag);
      doc.text(cliente ? `POR QUÉ LE QUEDA A ${cliente.toUpperCase()}` : 'POR QUÉ TE QUEDA', M + 5, yy + 7.5);
      F('normal'); doc.setFontSize(9.5); doc.setTextColor(...ink);
      let by = yy + 14;
      it.porque.forEach(b => { bullet(M + 6, by); const bl = doc.splitTextToSize(b, W - 2 * M - 16); doc.text(bl, M + 10, by); by += Math.max(6.2, bl.length * 5.2); });
      yy += boxH + 4;
    }
    pie();
  });

  // ---------------- CIERRE (oferta de valor) ----------------
  doc.addPage(); ribbon(); marca(11);
  let yc = 36;
  F('bold'); doc.setFontSize(21); doc.setTextColor(...ink);
  doc.text(cliente ? `${nombreCorto}, el siguiente paso es fácil` : 'El siguiente paso es fácil', M, yc); yc += 12;
  F('normal'); doc.setFontSize(11.5); doc.setTextColor(...sub);
  const cl = doc.splitTextToSize('Elige la opción que más te late y yo me encargo del resto — desde comparar tu crédito hasta la firma en notaría.', W - 2 * M);
  doc.text(cl, M, yc); yc += cl.length * 6.2 + 8;

  F('bold'); doc.setFontSize(12); doc.setTextColor(...ink); doc.text('Todo esto va incluido cuando trabajas conmigo', M, yc); yc += 8;
  const stack = p.stack || [
    'Comparativa de créditos de varios bancos para que pagues la mensualidad más baja',
    'Preapartado y negociación de las promociones vigentes con el desarrollador',
    'Acompañamiento en todo el papeleo y la firma en notaría',
    'Seguimiento de la obra y sus avances hasta tu entrega',
    'Aviso inmediato si baja el precio o entra una mejor unidad',
  ];
  F('normal'); doc.setFontSize(10.5);
  stack.forEach(s => { bullet(M + 1.5, yc); doc.setTextColor(...ink); const l = doc.splitTextToSize(s, W - 2 * M - 8); doc.text(l, M + 7, yc); yc += l.length * 5.6 + 2.6; });
  yc += 6;

  doc.setFillColor(...magSoft); doc.roundedRect(M, yc, W - 2 * M, 22, 2.5, 2.5, 'F');
  F('bold'); doc.setFontSize(10.5); doc.setTextColor(...mag); doc.text('Por qué no conviene esperar', M + 5, yc + 8);
  F('normal'); doc.setFontSize(9.5); doc.setTextColor(...ink);
  doc.text(doc.splitTextToSize('En preventa el precio sube en cada etapa y las mejores unidades —pisos altos, con vista— se van primero. Apartar hoy te congela el precio de hoy.', W - 2 * M - 10), M + 5, yc + 14);
  yc += 28;

  doc.setDrawColor(...line); doc.setFillColor(...soft); doc.roundedRect(M, yc, W - 2 * M, 30, 3, 3, 'FD');
  F('bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text('Agenda tu visita — sin costo y sin compromiso', M + 6, yc + 10);
  F('bold'); doc.setFontSize(12); doc.setTextColor(...mag); doc.text(p.asesor?.nombre || '', M + 6, yc + 18);
  F('normal'); doc.setFontSize(10.5); doc.setTextColor(...sub); doc.text([p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M + 6, yc + 24.5);
  if (qr) doc.addImage(qr, 'PNG', W - M - 26, yc + 2, 26, 26);
  pie('Sin costo y sin compromiso. Información referencial, sujeta a disponibilidad.');

  doc.save(cliente ? `Propuesta ${cliente}.pdf` : 'Propuesta de opciones.pdf');
}
