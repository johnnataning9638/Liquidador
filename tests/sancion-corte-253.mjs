import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const cfg={uvt:[],ipc:[{anio:2024,inflacion:0.05},{anio:2025,inflacion:0.05}],intereses:[{desde:'2024-01-01',hasta:'2028-12-31',metodologia:'INTERES_SIMPLE_DIARIO',tasas:{'TASA DIAN':0.365}}],reglasObligaciones:[]};
let cases=0;
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial])for(const capital of [0,''])for(const valor of [0,''])for(const pagos of [[],[{id:'P',fecha:'2026-01-02',valor:10000,tipo:'TASA DIAN'}]]){
 const m=new Clase(cfg),d={concepto:'VENTAS',anio:2026,tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',tieneSancion:'SI',valorSancion:100000,fechaSancion:'2026-01-01',vencimientos:[{id:'V',fecha:'2026-01-01',impuesto:capital}],pagos:[{id:'C',fecha:'2026-01-21',valor,tdj:'CORTE'},...pagos]};
 const r=m.calcular(d);
 assert.equal(r.impuesto,0);assert.equal(r.intereses,0);assert.equal(r.sancion,100000-pagos.length*10000);assert.equal(r.total,r.sancion);
 assert.equal(r.fechaCorte,'2026-01-21');
 const futura=m.calcular({...d,vencimientos:[{id:'V',fecha:'2026-02-01',impuesto:capital}]});
 assert.equal(futura.sancion,r.sancion,'La fecha del capital cero no impide abonar a una sanción ya exigible');
 assert.equal(r.detalle.filter(x=>Number(x.pago.valor)>0).length,pagos.length);
 for(const x of r.detalle)for(const k of ['impuesto','intereses','sancion'])assert.equal(x.saldo[k],x.deudaAntes[k]-x.aplicado[k]);
 cases++;
}
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial])for(const n of [1,4,6])for(const count of [0,1,3,7]){
 const m=new Clase(cfg),pagos=Array.from({length:count},(_,i)=>({id:'P'+i,fecha:`2026-01-${String(i+2).padStart(2,'0')}`,valor:10000,tipo:'TASA DIAN'}));
 const d={concepto:n===1?'VENTAS':'SIMPLE',anio:2026,tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',tieneSancion:'NO',vencimientos:Array.from({length:n},(_,i)=>({id:'V'+i,fecha:'2026-01-01',impuesto:1000000})),pagos:[{id:'C',fecha:'2026-01-21',valor:0},...pagos.reverse()]};
 const r=m.calcular(d);assert.equal(r.fechaCorte,'2026-01-21');
 assert.equal(r.detalle.filter(x=>Number(x.pago.valor)>0).length,count);
 assert.equal(r.total,r.impuesto+r.intereses+r.sancion);
 const expected=m.interesParaPago(r.impuesto,'2026-01-01','2026-01-21').valor;
 // Cada cuota se redondea por separado: comprobar por cuota, no sobre capital agregado.
 assert.equal(r.intereses,r.vencimientos.reduce((a,v)=>a+Number(m.interesParaPago(v.saldo,v.fecha,'2026-01-21').valor||0),0));
 if(!count)assert.equal(r.intereses,n*20000);
 cases++;
}
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 const m=new Clase(cfg),tipoLiquidacion=Clase===MotorLiquidacion?'PRIVADA':'OFICIAL';
 const d={concepto:'VENTAS',anio:2026,tipoLiquidacion,tieneSancion:'SI',valorSancion:1000000,fechaSancion:'2023-06-15',vencimientos:[{id:'V',fecha:'2023-06-15',impuesto:0}],pagos:[{fecha:'2026-01-21',valor:0}]};
 const r=m.calcular(d);assert.equal(r.impuesto,0);assert.equal(r.intereses,0);assert.equal(r.sancion,tipoLiquidacion==='PRIVADA'?1081000:1103000,'Actualización vigente: privada capitalizada por tramos; oficial IPC anual');cases++;
 d.pagos=[{fecha:'2025-02-01',valor:50000,tipo:'TASA DIAN'},{fecha:'2026-01-21',valor:''}];
 const paid=m.calcular(d);assert.equal(paid.sancion,tipoLiquidacion==='PRIVADA'?1028000:1050000,'No repetir IPC aplicado antes del pago');assert.equal(paid.intereses,0);cases++;
 const p={...d,fechaSancion:'2026-01-01',pagos:[{fecha:'2026-01-05',valor:0},{fecha:'2026-01-20',valor:1000000,tipo:'TASA DIAN'}]};
 const zero=m.calcular(p);assert.equal(zero.fechaCorte,'2026-01-20','Corte anterior no descarta pago posterior');assert.equal(zero.total,0);assert.equal(zero.excedente,0);cases++;
}
console.log(`SANCIÓN/CORTE 253 OK: ${cases} escenarios, capital cero/vacío, privada/oficial y cronología sin abonos ficticios`);
