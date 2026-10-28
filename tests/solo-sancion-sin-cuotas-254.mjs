import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const cfg={uvt:[],ipc:[{anio:2023,inflacion:0.05},{anio:2024,inflacion:0.05},{anio:2025,inflacion:0.05}],intereses:[],reglasObligaciones:[{concepto:'RENTA',vencimientos:'NO_AUTOGENERAR'}]};
let casos=0;
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial])for(const vencimientos of [[],[{fecha:'',impuesto:''}],[{fecha:'',impuesto:0}]])for(const fechaSancion of ['2023-01-01','2026-01-01'])for(const pagos of [[],[{id:'P',fecha:'2026-01-02',valor:10000,tipo:'TASA DIAN'}],[{id:'T',tdj:'T1',esTDJ:true,fecha:'2026-01-02',valor:1000,tipo:'TASA DIAN'}]]){
 const m=new Clase(cfg),tipoLiquidacion=Clase===MotorLiquidacion?'PRIVADA':'OFICIAL';
 const datos={concepto:'RENTA',anio:2022,periodo:1,tieneSancion:'SI',valorSancion:2500000,fechaSancion,tipoLiquidacion,vencimientos,pagos:[...pagos,{fecha:'2026-01-21',valor:''}]};
 const r=m.calcular(datos);assert.equal(r.impuesto,0);assert.equal(r.intereses,0);assert.equal(r.vencimientos.length,0,'No crear cuota ni fecha ficticia');
 const saldoInicial=fechaSancion==='2026-01-01'?2500000:tipoLiquidacion==='PRIVADA'?2763000:2894000;
 assert.equal(r.sancion,saldoInicial-pagos.reduce((a,p)=>a+p.valor,0),'Sanción desde fecha propia y pago descontado una vez');
 assert.equal(r.total,r.sancion);
 for(const d of r.detalle){assert.equal(d.aplicado.impuesto,0);assert.equal(d.aplicado.intereses,0);assert.equal(d.saldo.sancion,d.deudaAntes.sancion-d.aplicado.sancion);}
 casos++;
}
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial])for(const variante of [{tieneSancion:'NO'},{valorSancion:0},{fechaSancion:''}]){
 const d={concepto:'RENTA',tieneSancion:'SI',valorSancion:2500000,fechaSancion:'2023-01-01',tipoLiquidacion:Clase===MotorLiquidacion?'PRIVADA':'OFICIAL',vencimientos:[],pagos:[{fecha:'2026-01-21',valor:0}],...variante};
 assert.throws(()=>new Clase(cfg).calcular(d),'No aceptar obligación vacía sin sanción válida');casos++;
}
console.log(`SOLO SANCIÓN 254 OK: ${casos} escenarios sin cuotas, actualizada/no actualizada, pagos/TDJ y validación negativa`);
