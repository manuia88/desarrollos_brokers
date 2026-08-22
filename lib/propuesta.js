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

// ── Propuesta CON TU MARCA desde el shortlist (varios desarrollos) ──
// One-pager para el cliente que compara las opciones que el broker eligió (★).
// Lleva el logo del broker y NUNCA muestra la comisión.
export async function generarPropuestaShortlist(p) {
  const { jsPDF } = await import('jspdf');
  const logo = await imgJpeg(p.asesor?.org_logo, 500);
  let qr = null;
  try { if (p.link) { const QRCode = (await import('qrcode')).default; qr = await QRCode.toDataURL(p.link, { margin: 1, width: 420 }); } } catch { qr = null; }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 14;
  const mag = [255, 30, 122], ink = [22, 22, 26], sub = [120, 120, 132], line = [225, 225, 232], soft = [248, 248, 250];
  const F = (s = 'normal') => doc.setFont('helvetica', s);
  const items = p.items || [];

  function encabezado() {
    doc.setFillColor(...mag); doc.rect(0, 0, W, 4, 'F');
    if (logo) { const lw = 32, lh = Math.min(15, lw * logo.h / logo.w); doc.addImage(logo.data, 'JPEG', M, 11, lw, lh); }
    else { doc.setFontSize(12); doc.setTextColor(...ink); F('bold'); doc.text(p.asesor?.org_nombre || 'Propuesta', M, 19); }
    doc.setFontSize(9); doc.setTextColor(...sub); F('normal'); doc.text('PROPUESTA DE OPCIONES', W - M, 18, { align: 'right' });
  }
  function pie() {
    doc.setDrawColor(...line); doc.line(M, H - 18, W - M, H - 18);
    doc.setFontSize(8); doc.setTextColor(...sub); F('normal');
    doc.text([p.asesor?.nombre, p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M, H - 12);
    doc.text('Información referencial, sujeta a disponibilidad y cambios sin previo aviso.', M, H - 8);
  }

  encabezado();
  let y = 30;
  doc.setTextColor(...ink); F('bold'); doc.setFontSize(20);
  doc.text(p.cliente ? `Opciones para ${p.cliente}` : 'Opciones seleccionadas para ti', M, y); y += 8;
  F('normal'); doc.setFontSize(10.5); doc.setTextColor(...sub);
  doc.text(doc.splitTextToSize(`Seleccionamos ${items.length} ${items.length === 1 ? 'desarrollo' : 'desarrollos'} que encajan con lo que buscas. Cada uno incluye rango de precio, mensualidad estimada y precio por m2.`, W - 2 * M), M, y);
  y += 14;

  const CARD_H = 34;
  items.forEach((it, i) => {
    if (y + CARD_H > H - 24) { pie(); doc.addPage(); encabezado(); y = 30; }
    // tarjeta
    doc.setDrawColor(...line); doc.setFillColor(...soft); doc.roundedRect(M, y, W - 2 * M, CARD_H, 2.5, 2.5, 'FD');
    // índice
    doc.setFillColor(...mag); doc.circle(M + 8, y + 9, 4.2, 'F');
    doc.setTextColor(255, 255, 255); F('bold'); doc.setFontSize(10); doc.text(String(i + 1), M + 8, y + 10.3, { align: 'center' });
    // nombre + ubicación
    doc.setTextColor(...ink); F('bold'); doc.setFontSize(13); doc.text(it.nombre || '—', M + 16, y + 8);
    F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
    doc.text([it.colonia, it.alcaldia].filter(Boolean).join(', '), M + 16, y + 14);
    // specs
    const specs = [];
    if (it.rec_min != null && it.rec_max != null) specs.push(`${it.rec_min === 0 ? 'Loft' : it.rec_min}–${it.rec_max} rec`);
    if (it.m2_min != null && it.m2_max != null) specs.push(`${Math.round(it.m2_min)}–${Math.round(it.m2_max)} m2`);
    if (it.entrega) specs.push(it.entrega);
    else if (it.meses != null) specs.push(`entrega ~${it.meses} meses`);
    if (specs.length) { doc.setFontSize(9); doc.setTextColor(...sub); doc.text(specs.join('   ·   '), M + 16, y + 20); }
    // precio + mensualidad + m2 (derecha)
    const rx = W - M - 5;
    doc.setTextColor(...mag); F('bold'); doc.setFontSize(8); doc.text('DESDE', rx, y + 8, { align: 'right' });
    doc.setTextColor(...ink); doc.setFontSize(14);
    doc.text(it.min === it.max ? money(it.min) : `${money(it.min)} – ${money(it.max)}`, rx, y + 15, { align: 'right' });
    F('normal'); doc.setFontSize(9); doc.setTextColor(...sub);
    const linea2 = [it.mens ? `~${money(it.mens)}/mes` : null, it.pm2 ? `${money(it.pm2)}/m2` : null].filter(Boolean).join('   ·   ');
    if (linea2) doc.text(linea2, rx, y + 22, { align: 'right' });
    y += CARD_H + 6;
  });

  // Bloque de cierre: contacto + QR (si hay link)
  if (y + 30 > H - 24) { pie(); doc.addPage(); encabezado(); y = 30; }
  y += 2;
  const boxH = 26;
  doc.setFillColor(255, 240, 246); doc.roundedRect(M, y, W - 2 * M, boxH, 2.5, 2.5, 'F');
  doc.setTextColor(...mag); F('bold'); doc.setFontSize(10); doc.text('¿Cuál te late? Con gusto te agendo una visita.', M + 6, y + 9);
  doc.setTextColor(...ink); F('bold'); doc.setFontSize(11); doc.text(p.asesor?.nombre || '', M + 6, y + 16);
  F('normal'); doc.setFontSize(9.5); doc.setTextColor(...sub);
  doc.text([p.asesor?.telefono, p.asesor?.org_nombre].filter(Boolean).join('   ·   '), M + 6, y + 21);
  if (qr) { doc.addImage(qr, 'PNG', W - M - 24, y + 2, 22, 22); }

  pie();
  const nombreArch = p.cliente ? `Propuesta ${p.cliente}.pdf` : 'Propuesta de opciones.pdf';
  doc.save(nombreArch);
}
