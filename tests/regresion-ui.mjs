import assert from "node:assert/strict";
import fs from "node:fs";

const VERSION="16.33.122";
const app=fs.readFileSync("js/app.js","utf8");
const tdj=fs.readFileSync("js/tdj.js","utf8");
const html=fs.readFileSync("liquidacion.html","utf8");
const titulos=fs.readFileSync("titulos.html","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(app,/const capital=\(Number\(t\.base\|\|0\)>0\?Number\(t\.base\):/);
assert.match(app,/const desde=t\.desde\|\|t\.fechaVencimiento\|\|primer\.desde\|\|vto\?\.fecha\|\|"";/);
assert.match(app,/const dias=t\.dias!=null\?Number\(t\.dias\):normales\.reduce/);
assert.match(app,/const tasa=t\.tasa!=null\?Number\(t\.tasa\):\(primer\.tasa==null\?null:Number\(primer\.tasa\)\);/);
assert.match(tdj,/function configurarTabCuota\(tr,tbody\)/);
assert.match(tdj,/const siguiente=filas\[actual\+1\]\?\.querySelector\('\.fecha-campo'\);/);
assert.match(tdj,/tr\.querySelector\('\[data-v="periodo"\]'\).*tabindex="-1"/s);
assert.match(tdj,/e\.preventDefault\(\);\s*if\(impuesto\)\{impuesto\.focus/);
assert.match(html,new RegExp(`js/app\\.js\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(titulos,new RegExp(`js/tdj\\.js\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(html,new RegExp(`estilos\\.css\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(titulos,new RegExp(`estilos\\.css\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(titulos,new RegExp(`tdj-mobile\\.css\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(index,new RegExp(`liquidacion\\.html\\?v=${VERSION.replace(/\./g,"\\.")}`));
assert.match(index,new RegExp(`titulos\\.html\\?v=${VERSION.replace(/\./g,"\\.")}`));
console.log(`REGRESION UI PDF OFICIAL + TAB TDJ OK — VERSION ${VERSION}`);

assert.match(app,/function resumenExcedentesPagosPdf\(r\)/);
assert.match(app,/TOTAL EXCEDENTES/);
assert.match(app,/const resumenExcedentes=resumenExcedentesPagosPdf\(r\)/);
console.log("REGRESIÓN EXCEDENTES FINALES DE PAGOS OK");

const tdjSrc=tdj;
assert.match(tdjSrc,/function bloqueExcedentesPorObligacionTDJPdf\(o,detalles\)/);
assert.match(tdjSrc,/TOTAL EXCEDENTES DE LA OBLIGACIÓN/);
assert.match(tdjSrc,/bloqueExcedentesPorObligacionTDJPdf\(o,detalles\)/);
console.log("REGRESIÓN EXCEDENTES TDJ POR OBLIGACIÓN OK");

assert.match(tdjSrc,/d\.pago\?\.esTDJ!==true/);
assert.match(tdjSrc,/!String\(d\.pago\?\.tdj\|\|""\)\.trim\(\)/);
console.log("REGRESIÓN EXCEDENTES TDJ EXCLUYE ENDOSO DE TÍTULOS OK");

assert.match(tdjSrc,/function valorDisponiblePagoPDFTDJ\(d,o,resultado\)/);
assert.match(tdjSrc,/Number\(a\.valorAntes\|\|0\)/);
assert.match(tdjSrc,/const valorDisponible=valorDisponiblePagoPDFTDJ\(d,o,resultado\)/);
assert.match(tdjSrc,/valor:valorDisponible/);
console.log("REGRESIÓN VALOR DISPONIBLE TDJ POR OBLIGACIÓN OK");

assert.match(tdjSrc,/EXCEDENTE DE TÍTULO":"PAGO EN EXCESO/);
assert.match(tdjSrc,/const excedenteTDJ=trazaMovimiento/);
assert.match(tdjSrc,/saldoTitulo\|\|0/);
console.log("REGRESIÓN EXCEDENTE EN DETALLE PDF TDJ OK");

assert.match(tdjSrc,/function leerTitulosTDJRegistradosExcel\(rows\)/);
assert.match(tdjSrc,/const titulosCanonicos=leerTitulosTDJRegistradosExcel\(rows\)/);
assert.match(tdjSrc,/nuevosTitulos\.length=0/);
assert.match(tdjSrc,/numero:nuevosTitulos\.length\+1/);
console.log("REGRESIÓN IMPORTACIÓN EXCEL TDJ PRIMER TÍTULO OK");

const excelTitulos=[["Nº","TDJ","FECHA","VALOR"],["1","111","2026-04-01","20000000"],["2","222","2026-05-01","10000000"]];
assert.deepEqual(excelTitulos[1].slice(1),["111","2026-04-01","20000000"]);
assert.deepEqual(excelTitulos[2].slice(1),["222","2026-05-01","10000000"]);
assert.match(tdjSrc,/normImportacionTDJ\(r\?\.\[0\]\)/);
console.log("REGRESIÓN XLSX TDJ PRIMER REGISTRO OK");

assert.equal((tdjSrc.match(/function normImportacionTDJ\(/g)||[]).length,0);
assert.match(tdjSrc,/norm as normImportacionTDJ/);
console.log("REGRESIÓN SIN COLISIÓN DE NOMBRE TDJ OK");
assert.match(tdjSrc,/const esColumnaNumero=x=>/);
assert.match(tdjSrc,/s==="Nº"\|\|s==="N°"\|\|s==="NO"\|\|s==="N"/);
assert.match(tdjSrc,/s==="NUMERO TDJ"/);
assert.match(tdjSrc,/s==="VALOR DEL TDJ"/);
assert.match(tdjSrc,/if\(marca!==\"TITULOS TDJ\"\)continue/);
assert.match(tdjSrc,/const ixT=nh\.findIndex\(esColumnaTDJ\)/);
console.log("REGRESIÓN IMPORTACIÓN TDJ: ENCABEZADOS Y BLOQUE DE RECUPERACIÓN ROBUSTOS OK");

assert.match(app,/function valorNominalPagoPdf\(x,d\)/);
assert.match(app,/valorNominalPagoPdf\(x,d\)/);
assert.match(app,/EXCEDENTE DE TÍTULO/);
assert.match(tdjSrc,/const original=\(Array.isArray\(o\?\.pagos\)\?o\.pagos:\[\]\)\.find/);
console.log("REGRESIÓN VALOR NOMINAL TÍTULO + EXCEDENTE OK");
