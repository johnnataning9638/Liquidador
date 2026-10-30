import fs from 'node:fs';
import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const table=JSON.parse(fs.readFileSync('datos/interes-bancario-corriente.json'));
const cfg={tasasMoratorias:JSON.parse(fs.readFileSync('datos/tasas-moratorias.json'))};
const data={anio:0,concepto:'',tieneSancion:'NO',vencimientos:[{id:'v1',fecha:'2019-08-27',impuesto:5000000}],pagos:[{fecha:'2019-12-28',valor:8000000,tipo:'TASA DIAN'}]};
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 data.tipoLiquidacion=Clase===MotorLiquidacionOficial?'OFICIAL':'PRIVADA';
 const m=new Clase(cfg),r=m.calcular(data),d=r.detalle[0];
 assert.equal(d.interesGenerado,352000,'PDF abc: 5.000.000 × 20,91% × 123/365, redondeo vigente');
 assert.equal(d.excedente,2648000);assert.equal(d.tasaVisible,20.91);assert.ok(d.notaBeneficio.includes('APLICACIÓN AUTOMÁTICA'));
 for(const row of table.filter(x=>x.desde<='2020-05-01')){
  const fecha=row.desde==='2019-12-01'?'2019-12-27':row.desde;
  const result=m.calcular({...data,pagos:[{...data.pagos[0],fecha}]});assert.equal(Math.round(result.detalle[0].tasa*10000),row.tasa_puntos_basicos+200);
 }
 for(const [fecha,tasa] of [['2020-05-21',0.2019],['2020-05-22',0.1819],['2020-11-30',0.1784]])assert.equal(Math.round(m.calcular({...data,pagos:[{...data.pagos[0],fecha}]}).detalle[0].tasa*10000),Math.round(tasa*10000),fecha);
 const nuevo=m.calcular({...data,vencimientos:[{id:'v1',fecha:'2019-12-27',impuesto:5000000}]});assert.equal(Math.round(nuevo.detalle[0].tasa*10000),2637,'No inferir elegibilidad por el año gravable');
 for(const fecha of ['2019-12-26','2020-12-01'])assert.equal(m.calcular({...data,pagos:[{...data.pagos[0],fecha}]}).detalle[0].tasa,m.tasaPorFecha(fecha,'TASA DIAN'),'Fuera del plazo conserva la TIM '+fecha);
 const mixto=m.calcular({...data,vencimientos:[...data.vencimientos,{id:'v2',fecha:'2019-12-27',impuesto:5000000}]});assert.equal(mixto.detalle[0].tasaVisible,null,'No mostrar tasa única incorrecta en obligaciones mixtas');
 assert.deepEqual(mixto.detalle[0].interesesPorCuota.map(x=>Math.round(x.tasa*10000)),[2091,2637]);
 assert.equal(m.calcular({...data,pagos:[],fechaCorte:'2019-12-28'}).detalle.length,0,'Un corte no se convierte en pago con beneficio');
}
console.log('FAVORABILIDAD 267 OK: caso abc, seis meses IBC+2, límites, vencimientos mixtos, privada/oficial y cortes sin pago');
