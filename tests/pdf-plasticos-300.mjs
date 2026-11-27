import assert from 'node:assert/strict';
import fs from 'node:fs';
import {conceptoDIAN,prepararImportacion} from '../js/importacion-web-pdf/modelo.js';
import {esFilaImpuestoGenerador,leerPDF} from '../js/importacion-web-pdf/pdf.js';
const concepto='Impuesto Nacional sobre Productos Plásticos d';
assert.equal(conceptoDIAN(concepto),'PRODUCTOS PLASTICOS');
assert.equal(conceptoDIAN('PRODUCTOS PLASTICOS'),'PRODUCTOS PLASTICOS');
assert.equal(esFilaImpuestoGenerador('IMPUESTO NACIONAL P',concepto,'111'),true);
assert.equal(esFilaImpuestoGenerador('IMPUESTO NACIONAL P','RENTA','111'),false);
assert.equal(esFilaImpuestoGenerador('IMPUESTO NACIONAL P',concepto,'100'),false);
assert.equal(esFilaImpuestoGenerador('INTERESES',concepto,'111'),false);
assert.equal(esFilaImpuestoGenerador('SANCION',concepto,'111'),false);
const fuente={fuente:'PDF_1116',nit:'900123456',razonSocial:'PRUEBA',concepto,anio:2025,periodo:1,cuotas:[{numero:1,fecha:'2026-02-13',impuesto:5047000}]};
const pagos=[{fecha:'2026-03-01',valor:100000}];
const datos=prepararImportacion({pagos},fuente).datos;
assert.equal(datos.concepto,'PRODUCTOS PLASTICOS');
assert.deepEqual(datos.vencimientos,[{numero:1,fecha:'2026-02-13',impuesto:5047000,origenFecha:'PDF_1116'}]);
assert.deepEqual(datos.pagos,pagos);
// El PDF real solo se lee localmente; nunca se incorpora al repositorio.
if(process.argv[2]){
 Uint8Array.prototype.toHex??=function(){return Buffer.from(this).toString('hex');};
 Math.sumPrecise??=values=>Array.from(values).reduce((a,b)=>a+b,0);
 const real=await leerPDF(new Blob([fs.readFileSync(process.argv[2])]));
 assert.equal(real.concepto,'PRODUCTOS PLASTICOS');
 assert.equal(real.anio,2025);assert.equal(real.periodo,'1');
 assert.deepEqual(real.cuotas,datos.vencimientos);
}
console.log('PRODUCTOS PLASTICOS 1116 OK: identificación, cuota, monto, fecha y aislamiento');
