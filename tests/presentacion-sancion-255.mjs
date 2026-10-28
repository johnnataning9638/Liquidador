import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {crearRenderSancionTDJ,esSoloSancionSinPagosTDJ} from '../js/tdj-soporte-sancion-255.js';
const app=fs.readFileSync('js/app.js','utf8').replace(/\r\n/g,'\n'),module=fs.readFileSync('js/tdj-soporte-sancion-255.js','utf8').replace(/\r\n/g,'\n');
const fn=app.slice(app.indexOf('function bloquePdfSinPagos('),app.indexOf('\nfunction exportarPdf('));
const css=app.slice(app.indexOf('function estilosPdf('),app.indexOf('\nfunction bloquePdfSinPagos('));
assert.ok(module.includes(fn),'Plantilla DIAN copiada literalmente');assert.ok(module.includes(css),'Estilos DIAN copiados literalmente');
const helpers={escPdf:String,dinero:n=>String(n||0),fechaVisible:String,hoyISO:()=> '2026-10-28',dvNIT:()=> '9',tasaPdfArt45:(_,v)=>String(v)};
const ctx=vm.createContext({...helpers});vm.runInContext(fn,ctx);
for(const fechaVencimientoDeclarar of ['','2022-01-01'])for(const sancion of [2500000,2771000]){
 const d={nit:'900000001',razonSocial:'PRUEBA',anio:2022,concepto:'RENTA',periodo:1,tipoLiquidacion:'PRIVADA',fechaSancion:'2023-01-01',fechaVencimientoDeclarar,fechaCorte:'2026-10-27'};
 const r={impuesto:0,intereses:0,sancion,total:sancion,fechaCorte:d.fechaCorte,interesesPorCuota:[],sancionActualizacion:{tramos:[]}};
 const before=JSON.stringify({d,r});assert.equal(crearRenderSancionTDJ(helpers)(d,r),ctx.bloquePdfSinPagos(d,r));assert.equal(JSON.stringify({d,r}),before,'Presentación no cambia resultados');
}
const x={obligacion:{tieneSancion:'SI',valorSancion:2500000,vencimientos:[],pagos:[]},estadoFinal:{impuesto:0,intereses:0,sancion:2771000,detalle:[]},aplicaciones:[]};
assert.equal(esSoloSancionSinPagosTDJ(x),true);
assert.equal(esSoloSancionSinPagosTDJ({...x,obligacion:{...x.obligacion,vencimientos:[{impuesto:0}]}}),true);
assert.equal(esSoloSancionSinPagosTDJ({...x,obligacion:{...x.obligacion,vencimientos:[{impuesto:1000}]}}),false,'Obligación con capital conserva presentación');
assert.equal(esSoloSancionSinPagosTDJ({...x,obligacion:{...x.obligacion,pagos:[{valor:1000}]}}),false,'Pagos reales conservan presentación');
assert.equal(esSoloSancionSinPagosTDJ({...x,aplicaciones:[{aplicado:1000}]}),false,'TDJ real conserva presentación');
console.log('PRESENTACIÓN 255 OK: paridad DIAN exacta, datos inmutables y alcance exclusivo de solo sanción sin movimientos');
