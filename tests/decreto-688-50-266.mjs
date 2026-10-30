import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TIPO_688_50,tasaIBC68850,esTipo68850} from '../js/decreto-688-50.js';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
import {importarDatosInteligente} from '../js/importador.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const table=read('datos/interes-bancario-corriente.json');
for(const row of table.filter(x=>x.desde>='2020-05-01'&&x.desde<='2020-11-01')){
 const fecha=row.desde==='2020-05-01'?'2020-05-22':row.desde;
 assert.equal(tasaIBC68850(fecha),row.tasa_puntos_basicos/20000,'50% IBC certificado '+fecha);
 for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
  const motor=new Clase({tasasMoratorias:read('datos/tasas-moratorias.json'),uvt:read('datos/uvt.json'),reglasObligaciones:read('datos/reglas-obligaciones.json')});
  const especial=motor.tasaEspecial(TIPO_688_50,fecha),normal=motor.tasaEspecial('TASA DIAN',fecha);
  assert.equal(especial.tasa,row.tasa_puntos_basicos/20000);
  assert.equal(Math.round(normal.tasa*10000),row.tasa_puntos_basicos,'Automático conserva IBC completo');
  assert.equal(especial.reduceSancion,false);assert.equal(especial.factorSancion,1);
  assert.equal(especial.aplicacionAutomatica688,undefined);
 }
}
assert.equal(tasaIBC68850('2020-05-21'),null);assert.equal(tasaIBC68850('2020-12-01'),null);assert.equal(tasaIBC68850(''),null);assert.equal(tasaIBC68850('2020-06-31'),null);
assert.equal(tasaIBC68850('2020-11-30'),0.0892);assert.equal(tasaIBC68850('2020-05-22'),0.09095,'Mayo conserva 9,095%, sin redondeo prematuro');
assert.ok(esTipo68850(TIPO_688_50));assert.ok(!esTipo68850('ART. 1 DECRETO 688 DE 2020 - IBC'));
assert.ok(!esTipo68850('DECRETO 688 — 150%'));
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 const motor=new Clase({tasasMoratorias:read('datos/tasas-moratorias.json'),uvt:read('datos/uvt.json'),reglasObligaciones:read('datos/reglas-obligaciones.json')});
 const data={concepto:'RENTA',anio:2019,tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',tieneSancion:'NO',vencimientos:[{id:'v1',fecha:'2020-01-01',impuesto:1000000}],pagos:[{id:'p1',fecha:'2020-06-01',valor:10000,tipo:TIPO_688_50}]};
 const result=motor.calcular(data);assert.equal(result.detalle[0].tipoAplicado,TIPO_688_50,'El detalle conserva el tratamiento seleccionado');
 assert.equal(result.detalle[0].interesGenerado,38000,'El cálculo real usa la tasa reducida');
 const interest=motor.interesParaPago(1000000,'2020-01-01','2020-06-01',{tasaFija:0.0906});
 assert.equal(interest.valor,38000,'1.000.000 × 9,06% × 152/365 = 37.729,315; redondeo vigente = 38.000');
 for(const fecha of ['2020-05-21','2020-12-01'])assert.throws(()=>motor.calcular({...data,pagos:[{...data.pagos[0],fecha}]}),/22\/05\/2020.*30\/11\/2020/,'Fecha inválida no se sustituye por TIM');
}
const imported=importarDatosInteligente('RECIBO\tFECHA PAGO\tVALOR PAGO\tTIPO\n4910873517651\t01/06/2020\t10000\t'+TIPO_688_50);
assert.ok(JSON.stringify(imported).includes(TIPO_688_50),'Pegado conserva selección manual');
console.log('688 MANUAL 266 OK: siete meses certificados, 9,095% mayo, límites, privado/oficial, selección explícita y sanción intacta');
