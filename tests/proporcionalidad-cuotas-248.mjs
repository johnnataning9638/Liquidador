import assert from 'node:assert/strict';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const config={uvt:[],ipc:[],intereses:[{desde:'2025-01-01',hasta:'2028-12-31',metodologia:'INTERES_SIMPLE_DIARIO',tasas:{'TASA DIAN':0}}],reglasObligaciones:[]};
const datos=(count,fecha='2026-01-01',valor=10000)=>({concepto:'SIMPLE',anio:2026,tipoLiquidacion:'PRIVADA',tieneSancion:'SI',valorSancion:30000,fechaSancion:'2026-01-03',vencimientos:Array.from({length:count},(_,i)=>({id:'V'+i,fecha:`2026-01-0${i+1}`,numero:i+1,impuesto:100000})),pagos:[{id:'P1',fecha,valor,tipo:'TASA DIAN'}]});
let cases=0;
function conciliar(r){
 for(const d of r.detalle){
  const a=d.aplicado,s=d.saldo,b=d.deudaAntes;
  for(const k of ['impuesto','intereses','sancion']){
   assert.equal(s[k],b[k]-a[k],`Saldo ${k} = deuda menos aplicado`);
   assert.ok(a[k]>=0&&s[k]>=0,'Sin valores negativos');
  }
  assert.equal(a.total,a.impuesto+a.intereses+a.sancion);
  assert.equal(Number(d.pago.valor),a.total+d.excedente);
  assert.equal(s.total,s.impuesto+s.intereses+s.sancion);
  assert.equal(d.aplicacionesVto.reduce((n,v)=>n+v.aplicado,0),a.impuesto,'Detalle de cuotas coincide con impuesto aplicado');
  assert.equal(d.aplicacionesVto.reduce((n,v)=>n+Number(v.aplicadoSancion||0),0),a.sancion);
 }
 assert.equal(r.total,r.impuesto+r.intereses+r.sancion);
 assert.equal(r.vencimientos.reduce((n,v)=>n+v.saldo,0),r.impuesto);
 cases++;
}
for(const count of [4,5,6]){
 for(const fecha of ['2025-12-31','2026-01-01','2026-01-02','2026-01-08']){
  const r=new MotorLiquidacion(config).calcular(datos(count,fecha));
  assert.deepEqual([r.detalle[0].aplicado.impuesto,r.detalle[0].aplicado.intereses,r.detalle[0].aplicado.sancion],[9000,0,1000],'Proporción con redondeo vigente: 9000 impuesto + 1000 sanción');
  assert.deepEqual([r.impuesto,r.sancion,r.total],[count*100000-9000,29000,count*100000+20000]);
  conciliar(r);
 }
 const input=datos(count);input.pagos=[{id:'P1',fecha:'2026-01-01',valor:10000,tipo:'TASA DIAN'},{id:'P2',fecha:'2026-01-01',valor:10000,tipo:'TASA DIAN'}];
 const repeated=new MotorLiquidacion(config).calcular(input);conciliar(repeated);
 assert.equal(repeated.total,count*100000+30000-20000,'Cada pago se descuenta una vez');
 const excess=new MotorLiquidacion(config).calcular(datos(count,'2026-01-08',count*100000+50000));conciliar(excess);
 assert.equal(excess.total,0);assert.equal(excess.excedente,20000,'Excedente real conservado');
 const small=datos(count,'2026-01-01',1000);small.pagos[0].tdj='TDJ-1000';small.pagos[0].esTDJ=true;
 const tiny=new MotorLiquidacion(config).calcular(small);conciliar(tiny);
 assert.deepEqual([tiny.detalle[0].aplicado.impuesto,tiny.detalle[0].aplicado.sancion],[1000,0],'TDJ mínimo sin intereses conserva prioridad actual');
 for(const valor of [1001,10000]){
  const input=datos(count,'2026-01-01',valor);input.pagos[0].tdj='TDJ'+valor;input.pagos[0].esTDJ=true;
  const r=new MotorLiquidacion(config).calcular(input);conciliar(r);
  assert.deepEqual([r.detalle[0].aplicado.impuesto,r.detalle[0].aplicado.sancion],[valor-1000,1000],'TDJ superior a 1000 conserva proporcionalidad y redondeo');
 }
}
for(const tipoLiquidacion of ['PRIVADA','OFICIAL']){
 for(const count of [1,2,3,4,5,6]){
  const Clase=tipoLiquidacion==='OFICIAL'?MotorLiquidacionOficial:MotorLiquidacion;
  const r=new Clase(config).calcular({...datos(count,'2026-01-08'),tipoLiquidacion});conciliar(r);
  assert.equal(r.total,count*100000+20000,'Control ordinario/oficial conserva dinero');
 }
}
// La prioridad de intereses del TDJ mínimo se verifica con interés disponible.
const cfgInteres={...config,intereses:[{...config.intereses[0],tasas:{'TASA DIAN':0.365}}]};
for(const count of [4,5,6]){
 const input=datos(count,'2026-01-11');
 input.vencimientos.forEach(v=>v.fecha='2026-01-01');
 const r=new MotorLiquidacion(cfgInteres).calcular(input);
 assert.deepEqual([r.detalle[0].aplicado.impuesto,r.detalle[0].aplicado.intereses,r.detalle[0].aplicado.sancion],[8000,1000,1000],'Proporción con tres componentes y redondeo vigente');
 assert.equal(r.total,count*101000+20000);
 conciliar(r);
}
for(const valor of [157,1000]){
 const input=datos(4,'2026-01-20',valor);input.pagos[0].tdj='TDJ'+valor;input.pagos[0].esTDJ=true;
 const r=new MotorLiquidacion(cfgInteres).calcular(input);
 assert.equal(r.detalle[0].aplicado.intereses,valor);assert.equal(r.detalle[0].aplicado.impuesto,0);assert.equal(r.detalle[0].aplicado.sancion,0);
 cases++;
}
for(const count of [4,6]){
 const input=datos(count);input.valorSancion=1000000;input.fechaSancion='2026-01-01';input.vencimientos.forEach(v=>v.fecha='2026-01-01');
 input.pagos[0]={...input.pagos[0],tdj:'T-ART9',esTDJ:true,tipo:'ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO'};
 const r=new MotorLiquidacion(config).calcular(input);conciliar(r);
 assert.equal(r.detalle[0].deudaAntes.sancion,150000,'Respetar reducción vigente sin reconstruir la sanción original');
 assert.equal(r.detalle[0].aplicado.total,10000);
 assert.equal(r.total,count*100000+150000-10000);
}
console.log(`PROPORCIÓN 248 OK: ${cases} escenarios, cuotas 4–6, ordinario/oficial, conciliación y TDJ mínimo`);
