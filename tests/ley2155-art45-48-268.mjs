import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tasaArt48Automatico} from '../js/ley2155-art48.js';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';

const tasas=JSON.parse(fs.readFileSync('datos/tasas-moratorias.json','utf8'));
const uvt=[{anio:2021,sancionMinima:363000,valor:36308}];
const casos=[['2021-09-14',.1719],['2021-12-31',.1746],['2022-01-01',.1766],['2022-02-28',.1830],['2022-03-31',.1847]];
for(const [fecha,tasa] of casos){
 const r=tasaArt48Automatico('TASA DIAN',fecha,{fechaVencimiento:'2021-06-30',valorPago:1000});
 assert.equal(r.tasa,tasa,fecha);
 assert.equal(r.aplicacionAutomaticaArt48,true);
}
for(const fecha of ['2021-09-13','2022-04-01'])
 assert.equal(tasaArt48Automatico('TASA DIAN',fecha,{fechaVencimiento:'2021-06-30',valorPago:1000}),null);
assert.equal(tasaArt48Automatico('TASA DIAN','2022-03-01',{fechaVencimiento:'2021-07-01',valorPago:1000}),null);
assert.equal(tasaArt48Automatico('ART. 45 LEY 2155','2021-09-20',{fechaVencimiento:'2021-06-01',valorPago:1000}),null);
assert.equal(tasaArt48Automatico('TASA DIAN','2022-03-01',{fechaVencimiento:'2021-06-01',valorPago:0}),null);
assert.equal(tasaArt48Automatico('TASA DIAN','2022-03-01',{vencimientos:[{fecha:'2021-06-01',impuesto:100},{fecha:'2021-07-01',impuesto:100}],valorPago:1000}).porCuota,true);

for(const Engine of [MotorLiquidacion,MotorLiquidacionOficial]){
 const m=new Engine({tasasMoratorias:tasas,uvt,reglasObligaciones:[{concepto:'PRUEBA LEY 2155',familia:'TEST',vencimientos:'MANUAL',periodicidad:'ANUAL'}]});
 assert.equal(m.tasaEspecial('TASA DIAN','2022-02-01',{fechaVencimiento:'2021-06-30',valorPago:1000}).tasa,.1830,'IBC certificado 2022');
 assert.equal(m.tasaEspecial('TASA DIAN','2022-02-01',{fechaVencimiento:'2021-07-01',valorPago:1000}).aplicacionAutomaticaArt48,undefined,'Corte 30 de junio');
 assert.equal(m.tasaEspecial('ART. 45 LEY 2155','2021-10-01',{fechaVencimiento:'2021-05-01',valorPago:1000}).factorSancion,.2,'No reemplazar art45');
 const pay=valorSancion=>({
  concepto:'PRUEBA LEY 2155',anio:2021,tieneSancion:'SI',tipoLiquidacion:Engine===MotorLiquidacionOficial?'OFICIAL':'PRIVADA',
  fechaSancion:'2021-06-01',valorSancion,
  vencimientos:[{id:'v1',numero:1,fecha:'2021-05-01',impuesto:100000}],
  pagos:[{id:'p1',fecha:'2021-09-20',valor:5000000,tipo:'ART. 45 LEY 2155'}]
 });
 for(const [base,expected] of [[3000000,600000],[1000000,363000]]){
  const r=m.calcular(pay(base));
  assert.equal(r.detalle.length,1);
  console.log('DEBUG ART45',Engine.name,base,JSON.stringify({tipo:r.detalle[0].tipoAplicado,antes:r.detalle[0].deudaAntes,sancion:r.sancion,nota:r.detalle[0].notaBeneficio,act:r.detalle[0].actualizacionSancion}));
  const eventos=r.detalle[0].actualizacionSancion.eventos.filter(x=>x.tipo==='REDUCCION POR BENEFICIO');
  assert.equal(eventos.length,1,'Una reducción por pago');
  assert.equal(eventos[0].saldoDespues,expected,'Sanción reducida con piso mínima 2021');
 }
}
console.log('LEY 2155 268 OK: límites Art48, IBC 2021–2022, exclusión beneficios manuales y sanción Art45 20%/mínima ambos motores');
