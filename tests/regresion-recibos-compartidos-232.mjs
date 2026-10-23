import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {calcularRecibosCompartidos} from '../js/recibos-compartidos-232.js';

const read=n=>JSON.parse(fs.readFileSync(`datos/${n}.json`,'utf8'));
const cfg={uvt:read('uvt'),ipc:read('ipc'),tasasMoratorias:read('tasas-moratorias'),beneficios:read('beneficios'),sanciones:read('sanciones'),reglasObligaciones:read('reglas-obligaciones')};
const motor=new MotorLiquidacion(cfg);
const payment=(id,recibo,fecha,valor)=>({id,numero:1,recibo,fecha,valor,tipo:'TASA DIAN'});
function fixture(){
 return [
  {id:'A',numero:1,documentoFuente:'1117607606949',valorSancion:0,fechaSancion:'',capital:[8712000,8712000],pagos:[payment('P1A','4910873517651','2024-10-29',19112000)]},
  {id:'B',numero:2,documentoFuente:'1117624959145',valorSancion:524000,fechaSancion:'2026-03-19',capital:[7669000,7670000],pagos:[payment('P1B','4910873517651','2024-10-29',380000),payment('P2B','4911147953139','2026-07-31',12185000)]},
  {id:'C',numero:3,documentoFuente:'1117626729327',valorSancion:24889000,fechaSancion:'2026-05-08',capital:[127064000,127064000],pagos:[payment('P2C','4911147953139','2026-07-31',107815000)]}
 ].map(o=>({...o,obligacionDIAN:'100123000616347',concepto:'RENTA',anio:2023,periodo:'1',tipoLiquidacion:'PRIVADA',tipoTasa:'TASA DIAN',beneficioTributario:'NINGUNO',beneficioSancion:'SIN BENEFICIO',tieneSancion:o.valorSancion?'SI':'NO',vencimientos:o.capital.map((impuesto,i)=>({id:o.id+'V'+i,numero:i+1,fecha:i?'2024-07-16':'2024-05-16',impuesto}))}));
}
const datos=(o,pagos=o.pagos,fechaCorte=pagos.at(-1)?.fecha||'2026-07-31')=>({...o,pagos,fechaCorte});
const run=os=>calcularRecibosCompartidos(os,{motor,datosMotor:datos});
const os=fixture(),before=JSON.stringify(os),original=motor.aplicarProporcionalidad;
const result=run(os);
const get=(id,p)=>result.get(id).detalle.find(d=>d.pago.id===p);
const amounts=d=>[d.aplicado.impuesto,d.aplicado.intereses,d.aplicado.sancion];
assert.deepEqual(amounts(get('A','P1A')),[17424000,1688000,0]);
assert.deepEqual(amounts(get('B','P1B')),[335000,33000,12000]);
assert.deepEqual(amounts(get('B','P2B')),[7334000,4339000,512000]);
assert.deepEqual(amounts(get('C','P2C')),[64799000,36719000,6297000]);
assert.equal(get('B','P2B').aplicacionesVto.length,1,'No reportar filas vacías como nuevas aplicaciones');
assert.equal(get('B','P2B').aplicacionesVto[0].aplicadoSancion,512000);
assert.equal(result.get('B').vencimientos[1].saldo,7670000);
assert.equal(result.get('C').vencimientos[0].saldo,62265000);
assert.equal([...result.values()].reduce((s,r)=>s+r.impuesto,0),196999000);
assert.equal([...result.values()].reduce((s,r)=>s+r.sancion,0),18592000);
assert.equal(JSON.stringify(os),before,'No mutar datos de captura');assert.equal(motor.aplicarProporcionalidad,original,'No modificar motor compartido');
assert.deepEqual(JSON.parse(JSON.stringify([...run(os)])),JSON.parse(JSON.stringify([...result])),'Repetir cálculo produce el mismo resultado');
for(const r of result.values())for(const d of r.detalle){assert.equal(d.aplicado.total+d.excedente,d.pago.valor);assert.ok(d.saldo.impuesto>=0&&d.saldo.sancion>=0);}
assert.equal(run(os.map(({obligacionDIAN,documentoFuente,...o})=>o)).size,0,'Activación explícita obligatoria');
assert.equal(run([os[0]]).size,0,'Un documento conserva comportamiento');
for(const count of [1,3,4,5,6]){
 const bad=structuredClone(os);bad[1].vencimientos=Array.from({length:count},(_,i)=>({...bad[1].vencimientos[0],id:'X'+i}));
 assert.throws(()=>run(bad),/dos cuotas/i);
}
for(const cambio of [{concepto:'SIMPLE'},{tipoLiquidacion:'OFICIAL'},{tipoTasa:'ART. 9 DECRETO 1419'},{beneficioSancion:'CON BENEFICIO'},{periodo:'2'}]){
 const bad=structuredClone(os);Object.assign(bad[1],cambio);assert.throws(()=>run(bad));
}
const tdj=structuredClone(os);tdj[1].pagos[0].esTDJ=true;assert.throws(()=>run(tdj),/TDJ/i);
const duplicate=structuredClone(os);duplicate[2].documentoFuente=duplicate[1].documentoFuente;assert.throws(()=>run(duplicate),/documento/i);
const mismatch=structuredClone(os);mismatch[1].pagos[1].valor+=1000;mismatch[2].pagos[0].valor-=1000;assert.throws(()=>run(mismatch),/fracci.n/i,'No mover dinero silenciosamente entre documentos');
// Segundo caso independiente: base $600.000 + sanción $30.000, pago al 20%.
const zeroRates=[{desde:'2024-01-01',hasta:'2024-12-31',tasas:{'TASA DIAN':0},metodologia:'INTERES_SIMPLE_DIARIO'}];
const simpleMotor=new MotorLiquidacion({...cfg,ipc:[],tasasMoratorias:zeroRates});
const second=fixture().slice(0,2).map((o,i)=>({...o,fechaSancion:'2024-05-01',tieneSancion:'SI',valorSancion:i?20000:10000,vencimientos:o.vencimientos.map(v=>({...v,impuesto:i?200000:100000})),pagos:[payment('SEG'+i,'RECIBO-SEGUNDO','2024-10-29',i?20000:106000)]}));
const secondResult=calcularRecibosCompartidos(second,{motor:simpleMotor,datosMotor:datos});
assert.deepEqual(amounts(secondResult.get('A').detalle[0]),[100000,0,6000]);
assert.deepEqual(amounts(secondResult.get('B').detalle[0]),[20000,0,0]);
const duplicatePayment=fixture();duplicatePayment[1].pagos[1].id=duplicatePayment[1].pagos[0].id;assert.throws(()=>run(duplicatePayment),/identificadores de pago/);
const cut=fixture();cut[0].__corteRecibo='2026-07-31';assert.throws(()=>run(cut),/fecha de corte/);
// Fuera de la ruta: regresión diferencial de los motores ordinario y SIMPLE.
for(const count of [1,2,3,4,5,6]){
 const o={...os[1],obligacionDIAN:'',documentoFuente:'',concepto:count>=4?'SIMPLE':'RENTA',vencimientos:Array.from({length:count},(_,i)=>({id:'V'+i,fecha:'2024-05-16',impuesto:100000})),pagos:[payment('Q','R','2024-10-29',100000)]};
 const expected=motor.calcular(datos(o));assert.equal(run([o]).size,0);assert.deepEqual(motor.calcular(datos(o)),expected);
}
console.log('RECIBOS COMPARTIDOS 232 OK: AINNEX exacto, aislamiento, conservación, cronología e idempotencia');
export {fixture,cfg,datos};
