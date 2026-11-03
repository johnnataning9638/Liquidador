import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const cfg={uvt:[],ipc:[{anio:2025,inflacion:0.10}],intereses:[{desde:'2024-01-01',hasta:'2028-12-31',metodologia:'INTERES_SIMPLE_DIARIO',tasas:{'TASA DIAN':0.365}}],reglasObligaciones:[]};
const tipo='ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO';
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 const m=new Clase(cfg),datos={concepto:'RENTA',anio:2025,periodo:1,tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',tieneSancion:'SI',valorSancion:100000,fechaSancion:'2025-01-01',vencimientos:[{id:'V',fecha:'2025-01-01',impuesto:1000000}],pagos:[{id:'Q',fecha:'2026-02-01',valor:0,tipo}]};
 const original=JSON.stringify(datos),r=m.calcular(datos),u=r.ultimo;
 assert.equal(r.impuesto,1000000);assert.equal(r.intereses,49000);assert.equal(r.sancion,Clase===MotorLiquidacion?15000:17000,'Reducción en el saldo principal');
 assert.equal(r.total,r.impuesto+r.intereses+r.sancion);assert.equal(r.proyeccionesBeneficio,undefined,'Sin resumen adicional');
 assert.equal(u.pago.valor,0);assert.equal(u.pago.tipo,tipo);assert.equal(u.pago.fecha,'2026-02-01');assert.equal(u.aplicado.total,0);assert.equal(u.excedente,0);
 for(const k of ['impuesto','intereses','sancion']){assert.equal(u.deudaAntes[k],r[k]);assert.equal(u.saldo[k],u.deudaAntes[k],k+': deuda igual a saldo');assert.equal(u.aplicado[k],0);}
 assert.equal(u.saldo.total,r.total);assert.equal(r.excedente,0);assert.equal(JSON.stringify(datos),original,'Datos de entrada inmutables');
 const conUnPeso=m.calcular({...datos,pagos:[{...datos.pagos[0],valor:1}]});
 assert.deepEqual(u.deudaAntes,conUnPeso.ultimo.deudaAntes,'Mismo tratamiento del beneficio que con un peso');
 const vacio=m.calcular({...datos,pagos:[{...datos.pagos[0],valor:''}]});assert.deepEqual(vacio,r,'Vacío y cero idénticos');
 const varias=m.calcular({...datos,pagos:[...datos.pagos,{id:'Q2',fecha:'2026-03-01',valor:0,tipo}]});assert.equal(varias.sancion,r.sancion,'Consultas no acumulan reducciones');assert.equal(varias.ultimo.pago.fecha,'2026-03-01');assert.equal(varias.detalle.length,2);
 const pago={id:'P',fecha:'2026-01-01',valor:10000,tipo:'TASA DIAN'};
 const previos=m.calcular({...datos,pagos:[pago,...datos.pagos]});const ref=m.calcular({...datos,pagos:[pago,{...datos.pagos[0],valor:1}]}).ultimo;
 assert.deepEqual(previos.ultimo.deudaAntes,ref.deudaAntes,'Pagos anteriores se conservan');assert.equal(previos.ultimo.aplicado.total,0);
 const futuro={id:'F',fecha:'2026-03-01',valor:1000,tipo:'TASA DIAN'};
 const conFuturo=m.calcular({...datos,pagos:[pago,...datos.pagos,futuro]}),sinConsulta=m.calcular({...datos,pagos:[pago,futuro]});
 for(const k of ['impuesto','intereses','sancion','total','excedente'])assert.equal(conFuturo[k],sinConsulta[k],'Una consulta no altera pagos posteriores');
 for(const fechaCorte of ['2026-01-15','2026-03-10']){
  const corte=m.calcular({...datos,fechaCorte});const refCorte=m.calcular({...datos,fechaCorte,_sinProyecciones276:true,pagos:[{...datos.pagos[0],esConsultaBeneficio276:true}]});
  for(const k of ['impuesto','intereses','sancion','total'])assert.equal(corte[k],refCorte[k],'Respetar corte explícito');
 }
 for(const invalido of ['BENEFICIO NO REGISTRADO','ART. 1 DECRETO 688 DE 2020 - 50% INTERÉS CORRIENTE'])assert.throws(()=>m.calcular({...datos,pagos:[{...datos.pagos[0],tipo:invalido}]}),/beneficio|DECRETO 688/i,'No sustituir beneficio inválido');
}
console.log('CUADRO PRINCIPAL 277 OK: privada/oficial, cero/vacío, deuda=saldo, paridad con $1, pagos reales, cortes y consultas independientes');
