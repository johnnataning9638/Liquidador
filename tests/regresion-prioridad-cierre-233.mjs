import assert from 'node:assert/strict';
import {ajustarTDJParaPagosPosteriores} from '../js/tdj-prioridad-203.js';
const datos={fechaCorte:'2026-10-01',pagos:[
  {id:'T4',fecha:'2026-07-24',valor:10000000,tdj:'469030003387674',esTDJ:true},
  {id:'P3',fecha:'2026-10-01',valor:8193000,tipo:'TASA DIAN'}
]};
const original=structuredClone(datos);
// Caso independiente: los pagos posteriores cierran toda la deuda sin T4.
// El redondeo permite consumir hasta $1.000 sin registrar excedente posterior.
const motor={calcular(d){const actual=d.pagos.find(p=>p.id==='T4').valor;return {
  total:0,detalle:[{pago:{id:'P3'},aplicado:{total:8193000},excedente:actual>1000?actual-1000:0}]
};}};
const adjusted=ajustarTDJParaPagosPosteriores(motor,datos,{soloTDJId:'T4'});
assert.equal(adjusted.pagos[0].valor,0,'No consumir un TDJ si los pagos protegidos ya cierran la obligación');
assert.deepEqual(datos,original,'No mutar el título nominal ni los pagos de captura');
const necessaryMotor={calcular(d){const actual=d.pagos.find(p=>p.id==='T4').valor;return {
  total:Math.max(0,3000-actual),detalle:[{pago:{id:'P3'},aplicado:{total:8193000},excedente:actual>3000?actual-3000:0}]
};}};
assert.equal(ajustarTDJParaPagosPosteriores(necessaryMotor,datos,{soloTDJId:'T4'}).pagos[0].valor,3000,'Conservar el título cuando es necesario para cubrir deuda');
const noFuture={...datos,pagos:[datos.pagos[0]]};
assert.equal(ajustarTDJParaPagosPosteriores(motor,noFuture,{soloTDJId:'T4'}).pagos[0].valor,10000000,'Sin pagos posteriores se conserva la ruta ordinaria');
console.log('PRIORIDAD 233 OK: cierre sin título, título necesario, aislamiento y ruta sin pagos posteriores');
