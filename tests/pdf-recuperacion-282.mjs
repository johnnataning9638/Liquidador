import assert from 'node:assert/strict';
import {crearRespaldo, prepararRespaldo, codificarBloques, unirBloques} from '../js/importacion-web-pdf/respaldo.js';

const fecha='2026-07-29';
const pago={recibo:'4910000000001',fecha,valor:10_000_000,tipo:'TASA DIAN'};
const titulo={tdj:'4690000000001',fecha,valor:34_099_163};
const obligaciones=[2024,2025].map(anio=>({
  concepto:'RENTA',anio,periodo:1,vencimientos:[{fecha,impuesto:12_000_000}],pagos:[pago]
}));
const respaldo=crearRespaldo('TDJ',{nit:'900123456',razonSocial:'COMPAÑÍA DE PRUEBA'},obligaciones,[titulo,titulo]);
assert.deepEqual(unirBloques(codificarBloques(respaldo)),respaldo);
const dian=prepararRespaldo(respaldo,false);
assert.equal(dian.obligaciones.length,1);
assert.equal(dian.obligaciones[0].pagos[0].valor,10_000_000);
assert.equal(dian.titulos.length,1);
assert.equal(dian.titulos[0].valor,34_099_163);
const tdj=prepararRespaldo(respaldo,true);
assert.equal(tdj.obligaciones.length,2);
assert.equal(tdj.obligaciones.flatMap(o=>o.pagos).length,1);
const bloques=codificarBloques(respaldo);
bloques[0][30]^=1;
assert.throws(()=>unirBloques(bloques),/dañado/);
console.log('Recuperación PDF: integridad, primera obligación, todas las obligaciones y movimientos únicos.');
const fraccionado=structuredClone(respaldo);
fraccionado.obligaciones[0].pagos[0].valor=6_000_000;
fraccionado.obligaciones[0].pagos[0].observacion='FRACCIÓN DE RECIBO';
fraccionado.obligaciones[1].pagos[0].valor=4_000_000;
fraccionado.obligaciones[1].pagos[0].observacion='FRACCIÓN DE RECIBO';
assert.deepEqual(prepararRespaldo(fraccionado,true).obligaciones.map(o=>o.pagos[0].valor),[6_000_000,4_000_000]);
const ambiguo=structuredClone(respaldo);
ambiguo.obligaciones[1].pagos[0].valor=3_000_000;
assert.throws(()=>prepararRespaldo(ambiguo,true),/valores originales diferentes/);
