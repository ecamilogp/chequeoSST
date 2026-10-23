// Genera el Excel del mes: una hoja "Resumen" y una hoja por técnico con la planilla
// igual a la de papel (elementos × días), las firmas diarias y las novedades.
import { APP } from '../empresa.js';
import { SECCIONES, ALL, SYM } from './catalogo.js';
import { DIAS, pad, rangoMes, fmtMes, fmtHora, fmtFechaHora } from './fechas.js';

const COLOR = {
  tinta: 'FF16202B', gris: 'FF5B6977', linea: 'FFD5DBE2', seccion: 'FFE9EDF1', encabezado: 'FF16202B',
  C: ['FFDCF1E3', 'FF1F8A4C'], N: ['FFF9DEDB', 'FFC8362B'], NA: ['FFE4E8EC', 'FF6B7785']
};
const ESTADO = { pendiente: 'Por validar', corregida: 'Corregida · por validar', validada: 'Validada', devuelta: 'Devuelta' };
const borde = { style: 'thin', color: { argb: COLOR.linea } };
const bordes = { top: borde, left: borde, bottom: borde, right: borde };
const relleno = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function nombreHoja(nombre, usados) {
  let base = String(nombre || 'Empleado').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Empleado';
  let n = base, i = 2;
  while (usados.has(n.toLowerCase())) n = `${base.slice(0, 25)} (${i++})`;
  usados.add(n.toLowerCase());
  return n;
}

function encabezadoFormato(ws, ultimaCol, filaMes) {
  const f = APP.formato;
  ws.mergeCells(1, 1, 1, ultimaCol);
  const t = ws.getCell(1, 1);
  t.value = `${APP.empresa.toUpperCase()} · ${f.tituloLargo.toUpperCase()}`;
  t.font = { bold: true, size: 13, color: { argb: COLOR.tinta } };
  ws.mergeCells(2, 1, 2, ultimaCol);
  ws.getCell(2, 1).value = `${f.proceso}  ·  Código: ${f.codigo}  ·  Versión: ${f.version}  ·  Fecha: ${f.fecha}`;
  ws.getCell(2, 1).font = { size: 9, color: { argb: COLOR.gris } };
  ws.mergeCells(3, 1, 3, ultimaCol);
  ws.getCell(3, 1).value = filaMes;
  ws.getCell(3, 1).font = { size: 10, bold: true };
}

// Ancho y alto de un PNG en base64 (bytes 16-23 del encabezado).
function medidasPng(b64) {
  try {
    const b = atob(b64.slice(0, 44));
    const n = i => ((b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) | (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3)) >>> 0;
    return [n(16), n(20)];
  } catch { return [0, 0]; }
}

export async function generarExcel({ mes, miembros: tecnicos, inspecciones, firmas }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = APP.nombre;
  wb.created = new Date();
  const { dias } = rangoMes(mes);
  const [y, m] = mes.split('-').map(Number);
  const porTec = new Map(tecnicos.map(t => [t.id, { t, filas: [] }]));
  for (const i of inspecciones) porTec.get(i.miembro_id)?.filas.push(i);

  // ---------- Resumen ----------
  const rs = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 5 }] });
  const cols = [
    ['Fecha', 11], ['Día', 6], ['Empleado', 28], ['Correo', 26], ['Cargo', 16], ['Área', 16], ['Hora de envío', 11],
    ['No cumplen', 10], ['Elementos que no cumplen', 48], ['Observaciones', 36], ['Estado', 18],
    ['Revisó', 24], ['Fecha de validación', 17], ['Nota de revisión', 36], ['Ubicación', 22],
    ['Firma del empleado', 23], ['Firma de quien revisó', 23]
  ];
  const COL_FIRMA = cols.length - 1; // índice (base 1) de "Firma del empleado"
  // Pone una firma (PNG en base64) dentro de una celda.
  // La imagen se ajusta al recuadro ancho × alto sin deformarse.
  const ponerFirma = (hoja, b64, col, fila, ancho, alto) => {
    if (!b64) return;
    const [w, h] = medidasPng(b64);
    const k = w && h ? Math.min(ancho / w, alto / h) : 1;
    const id = wb.addImage({ base64: b64, extension: 'png' });
    hoja.addImage(id, { tl: { col: col - 1 + 0.06, row: fila - 1 + 0.08 }, ext: { width: w && h ? w * k : ancho, height: w && h ? h * k : alto }, editAs: 'oneCell' });
  };
  cols.forEach(([, w], i) => { rs.getColumn(i + 1).width = w; });
  encabezadoFormato(rs, cols.length, `Resumen de ${fmtMes(mes)} · ${inspecciones.length} inspecciones`);
  const hr = rs.getRow(5);
  cols.forEach(([h], i) => {
    const c = hr.getCell(i + 1);
    c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = relleno(COLOR.encabezado);
    c.alignment = { vertical: 'middle', wrapText: true }; c.border = bordes;
  });
  hr.height = 30;
  const ordenadas = [...inspecciones].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));
  for (const i of ordenadas) {
    const [yy, mm, dd] = i.fecha.split('-').map(Number);
    const tec = porTec.get(i.miembro_id)?.t;
    const nc = ALL.filter(e => i.respuestas[e.id] === 'N').map(e => `${e.n}: ${i.obs_items?.[e.id] || ''}`).join('\n');
    const row = rs.addRow([
      new Date(Date.UTC(yy, mm - 1, dd)), DIAS[new Date(yy, mm - 1, dd).getDay()], i.nombre, tec?.email || '', i.cargo, i.area,
      fmtHora(i.enviada_at), i.total_no_cumple, nc, i.observaciones, ESTADO[i.estado] || i.estado,
      i.revisor_nombre ? `${i.revisor_nombre}${i.revisor_cargo ? ' · ' + i.revisor_cargo : ''}` : '',
      fmtFechaHora(i.revisada_at), i.nota_revisor || '', i.ubicacion || '', '', ''
    ]);
    const lineas = Math.max(1, nc.split('\n').length, String(i.observaciones || '').split('\n').length);
    row.height = Math.max(46, lineas * 15);
    ponerFirma(rs, firmas[i.firma_path], COL_FIRMA, row.number, 150, 56);
    if (i.estado === 'validada' || i.estado === 'devuelta') ponerFirma(rs, firmas[i.firma_revisor_path], COL_FIRMA + 1, row.number, 150, 56);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.eachCell({ includeEmpty: true }, c => { c.border = bordes; c.alignment = { vertical: 'top', wrapText: true }; });
    if (i.total_no_cumple > 0) row.getCell(8).font = { bold: true, color: { argb: COLOR.N[1] } };
  }
  rs.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: cols.length } };
  rs.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  // ---------- Una hoja por técnico ----------
  const usados = new Set(['resumen']);
  const COL0 = 2; // la columna A tiene los elementos; los días empiezan en B
  for (const { t, filas } of [...porTec.values()].sort((a, b) => a.t.nombre.localeCompare(b.t.nombre))) {
    if (!filas.length) continue;
    const ws = wb.addWorksheet(nombreHoja(t.nombre, usados), { views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }] });
    const porDia = Object.fromEntries(filas.map(f => [f.fecha, f]));
    const ultima = COL0 + dias - 1;
    ws.getColumn(1).width = 36;
    for (let d = 0; d < dias; d++) ws.getColumn(COL0 + d).width = 7;
    encabezadoFormato(ws, ultima, `Mes de inspección: ${fmtMes(mes)}`);

    ws.mergeCells(4, 1, 4, ultima);
    const ultimaFila = filas[filas.length - 1];
    ws.getCell(4, 1).value = `Empleado: ${t.nombre}   ·   Correo: ${t.email}   ·   Cargo: ${ultimaFila.cargo || t.cargo || ''}   ·   Área: ${ultimaFila.area || t.area || ''}`;
    ws.getCell(4, 1).font = { bold: true };
    ws.mergeCells(5, 1, 5, ultima);
    ws.getCell(5, 1).value = `Marque: ${SYM.C} Cumple   ${SYM.N} No cumple   ${SYM.NA} No aplica.   ${APP.formato.nota}`;
    ws.getCell(5, 1).font = { size: 9, italic: true, color: { argb: COLOR.gris } };
    ws.getCell(5, 1).alignment = { wrapText: true };
    ws.getRow(5).height = 26;

    // Encabezado de días
    const hd = ws.getRow(6);
    hd.getCell(1).value = 'DESCRIPCIÓN';
    for (let d = 1; d <= dias; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      hd.getCell(COL0 + d - 1).value = `${DIAS[wd][0]}\n${d}`;
    }
    hd.height = 28;
    hd.eachCell({ includeEmpty: true }, c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; c.fill = relleno(COLOR.encabezado);
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = bordes;
    });
    hd.getCell(1).alignment = { vertical: 'middle' };

    // Secciones y elementos
    for (const s of SECCIONES) {
      const sr = ws.addRow([`${s.k}. ${s.t.toUpperCase()}`]);
      ws.mergeCells(sr.number, 1, sr.number, ultima);
      sr.getCell(1).font = { bold: true, size: 9, color: { argb: COLOR.gris } };
      sr.getCell(1).fill = relleno(COLOR.seccion);
      for (const [id, nombre] of s.items) {
        const r = ws.addRow([nombre]);
        r.getCell(1).border = bordes;
        for (let d = 1; d <= dias; d++) {
          const c = r.getCell(COL0 + d - 1);
          const v = porDia[`${mes}-${pad(d)}`]?.respuestas?.[id];
          c.border = bordes; c.alignment = { horizontal: 'center', vertical: 'middle' };
          if (v) {
            c.value = SYM[v]; c.fill = relleno(COLOR[v][0]); c.font = { bold: true, color: { argb: COLOR[v][1] } };
            const o = porDia[`${mes}-${pad(d)}`]?.obs_items?.[id];
            if (v === 'N' && o) c.note = o;
          }
        }
      }
    }

    // Firmas del trabajador (imagen por día)
    const fr = ws.addRow(['FIRMA DEL EMPLEADO']);
    fr.height = 26;
    fr.getCell(1).font = { bold: true, size: 9 }; fr.getCell(1).alignment = { vertical: 'middle' };
    for (let d = 1; d <= dias; d++) {
      const c = fr.getCell(COL0 + d - 1); c.border = bordes;
      const insp = porDia[`${mes}-${pad(d)}`];
      if (insp) ponerFirma(ws, firmas[insp.firma_path], COL0 + d - 1, fr.number, 50, 30);
    }
    fr.getCell(1).border = bordes;

    const frv = ws.addRow(['FIRMA DE QUIEN REVISÓ']);
    frv.height = 26;
    frv.getCell(1).font = { bold: true, size: 9 }; frv.getCell(1).alignment = { vertical: 'middle' }; frv.getCell(1).border = bordes;
    for (let d = 1; d <= dias; d++) {
      frv.getCell(COL0 + d - 1).border = bordes;
      const insp = porDia[`${mes}-${pad(d)}`];
      if (insp && (insp.estado === 'validada' || insp.estado === 'devuelta')) ponerFirma(ws, firmas[insp.firma_revisor_path], COL0 + d - 1, frv.number, 50, 30);
    }

    const vr = ws.addRow(['REVISIÓN']);
    vr.getCell(1).font = { bold: true, size: 9 }; vr.getCell(1).border = bordes;
    for (let d = 1; d <= dias; d++) {
      const c = vr.getCell(COL0 + d - 1); c.border = bordes; c.alignment = { horizontal: 'center' };
      const insp = porDia[`${mes}-${pad(d)}`];
      if (insp?.estado === 'validada') { c.value = SYM.C; c.font = { bold: true, color: { argb: COLOR.C[1] } }; c.note = `${insp.revisor_nombre} · ${fmtFechaHora(insp.revisada_at)}`; }
      else if (insp?.estado === 'devuelta') { c.value = '↺'; c.font = { bold: true, color: { argb: COLOR.N[1] } }; c.note = `Devuelta: ${insp.nota_revisor || ''}`; }
      else if (insp) { c.value = '…'; c.font = { color: { argb: COLOR.gris } }; c.note = 'Por validar'; }
    }

    // Novedades
    const nov = [];
    for (const f of filas) for (const e of ALL) if (f.respuestas[e.id] === 'N') nov.push([f.fecha, e.n, f.obs_items?.[e.id] || '', ESTADO[f.estado] || f.estado]);
    const obsGen = filas.filter(f => f.observaciones).map(f => [f.fecha, 'Observación general', f.observaciones, ESTADO[f.estado] || f.estado]);
    const lista = [...nov, ...obsGen].sort((a, b) => a[0].localeCompare(b[0]));
    ws.addRow([]);
    const tn = ws.addRow([lista.length ? 'NOVEDADES Y OBSERVACIONES DEL MES' : 'Sin novedades en el mes.']);
    tn.getCell(1).font = { bold: true };
    for (const [fecha, elem, det, est] of lista) {
      const r = ws.addRow([`${fecha.slice(8)}/${fecha.slice(5, 7)} · ${elem}`]);
      ws.mergeCells(r.number, COL0, r.number, ultima);
      r.getCell(COL0).value = `${det}${est ? `   (${est})` : ''}`;
      r.getCell(COL0).alignment = { wrapText: true, vertical: 'top' };
      r.getCell(1).font = { size: 9 }; r.getCell(COL0).font = { size: 9 };
    }

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


