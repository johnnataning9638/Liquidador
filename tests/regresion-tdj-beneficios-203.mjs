import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
import * as util from '../js/utilidades.js';
import * as decreto from '../js/decreto-1419.js';
import * as tasas203 from '../js/tdj-tasas-203.js';
import * as prioridad from '../js/prioridad-tdj-v132.js';

const file='js/tdj-core-16.33.143.js';
const src=fs.readFileSync(file,'utf8').replace(/^import .*;\s*$/gm,'')
  .replace('throw new Error(`INCONSISTENCIA TDJ:', 'globalThis.debug203={resumenObligaciones,resumenTitulos};throw new Error(`INCONSISTENCIA TDJ:')
  .replace(/if\(document.readyState==="loading"\)document.addEventListener\("DOMContentLoaded",init\);else init\(\);/,'');
const config={uvt:[],ipc:[],intereses:[{desde:'2026-01-01',hasta:'2026-12-31',metodologia:'INTERES_SIMPLE_DIARIO',tasas:{'TASA DIAN':0.365}}],reglasObligaciones:[],beneficios:[],sanciones:[]};
config.tasasMoratorias=config.intereses;
const errors=[];
const elements=new Map();
const document={readyState:'loading',querySelectorAll:()=>[],querySelector:()=>null,getElementById:id=>{
  if(!elements.has(id))elements.set(id,{value:id==='nitGlobal'?'900000088':id==='razonGlobal'?'PRUEBA FICTICIA':'',hidden:false,querySelectorAll:()=>[]});
  return elements.get(id);
}};
let priority=prioridad;
if(fs.existsSync('js/tdj-prioridad-203.js'))priority=await import('../js/tdj-prioridad-203.js');
const ctx=vm.createContext({...util,...decreto,...priority,...tasas203,MotorLiquidacion,MotorLiquidacionOficial,document,
  window:{addEventListener(){}},console:{log(){},warn(){},error(){}},alert:m=>errors.push(m),CSS:{escape:s=>s},setTimeout(){},requestAnimationFrame(){},Blob,TextEncoder,TextDecoder,DataView,Uint8Array});
vm.runInContext(src+`
sincronizarPagosVisiblesTDJ=()=>{};sincronizarTitulosVisiblesTDJ=()=>{};sincronizarCapturaManualTDJ=()=>{};
validarConfiguracionAntesCalcularTDJ=()=>{};validarDatos=()=>{};
pintarResultado=()=>{};renderPagos=()=>{};activarTab=()=>{};enfocarCampoErrorTDJ=()=>{};
descargarTDJ=blob=>{globalThis.lastBlob=blob;};
globalThis.fixture={run(os,ts,cfg){obligaciones=os;titulos=ts;resultado=null;motor=new MotorLiquidacion(cfg);motorOficial=new MotorLiquidacionOficial(cfg);aplicarTitulos();return resultado;},excel(){return construirFilasExcelTDJ();},export(){exportarExcelTDJ();return globalThis.lastBlob;}};
`,ctx);
const obligation=(id,numero,extra={})=>({id,numero,concepto:'RENTA',anio:2025,periodo:String(numero),tipoLiquidacion:'PRIVADA',tieneSancion:'NO',valorSancion:0,tipoTasa:'TASA DIAN',vencimientos:[{id:'V'+id,numero:1,fecha:'2026-01-01',impuesto:1000000}],pagos:[],...extra});
const title=(id,valor,fecha='2026-01-01',extra={})=>({id,numero:Number(id.slice(1)),tdj:'99900000000'+id.slice(1),valor,fecha,...extra});
let passed=0;
function test(name,fn){errors.length=0;try{fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.message,errors);if(ctx.debug203)console.error(JSON.stringify(ctx.debug203.resumenObligaciones.map(x=>({id:x.obligacion.id,saldo:x.saldo,apps:x.aplicaciones.map(a=>({t:a.titulo,ap:a.aplicado,tipo:a.tipoTasaObligacion})),detalle:x.estadoFinal?.detalle.map(d=>({p:d.pago.id,valor:d.pago.valor,tipo:d.tipoAplicado,ap:d.aplicado,total:d.saldo.total}))})),null,2));process.exitCode=1;}}
function run(os,ts){const r=ctx.fixture.run(structuredClone(os),structuredClone(ts),config);assert.ok(r,errors.join('\n'));return r;}
test('Dos títulos agotan primera obligación y trasladan remanente a segunda',()=>{
  const r=run([obligation('O1',1),obligation('O2',2)],[title('T1',600000),title('T2',1900000)]);
  assert.equal(r.endoso,500000);assert.equal(r.resumenTitulos[0].trazabilidad[0].aplicado,600000);
  assert.equal(r.resumenTitulos[1].trazabilidad[0].aplicado,400000);
  assert.equal(r.resumenObligaciones.every(x=>x.saldo===0),true);
});
test('Título insuficiente produce saldo, nunca endoso ficticio ni bloqueo',()=>{
  const r=run([obligation('O1',1)],[title('T1',600000)]);
  assert.equal(r.resumenTitulos[0].trazabilidad[0].aplicado,600000);assert.equal(r.endoso,0);
});
test('Artículo 9 y DIAN independientes, con mismo concepto y año',()=>{
  const r=run([obligation('O1',1),obligation('O2',2)],[title('T1',5000000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}})]);
  const a=r.resumenTitulos[0].trazabilidad;
  assert.equal(a[0].tipoTasaObligacion,decreto.TIPO_1419.ART9);assert.equal(a[0].aplicadoIntereses,27000);
  assert.equal(a[1].tipoTasaObligacion,'TASA DIAN');assert.equal(a[1].aplicadoIntereses,220000);
});
test('Cinco pagos: dos previos y tres posteriores; conservar pagos y remanente',()=>{
  const dates=['2026-07-01','2026-07-15','2026-08-15','2026-09-01','2026-10-01'];
  const o=obligation('O1',1,{pagos:dates.map((fecha,i)=>({id:'P'+i,numero:i+1,recibo:'49000000000'+i,fecha,valor:100000,tipo:'TASA DIAN'}))});
  const r=run([o,obligation('O2',2)],[title('T1',300000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}}),title('T2',4700000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}})]);
  const details=r.resumenObligaciones[0].detalleCronologicoFinal.filter(d=>!d.pago.esTDJ);
  assert.equal(details.length,5);assert.ok(details.every(d=>d.aplicado.total===100000&&Number(d.excedente||0)===0));
  assert.ok(r.resumenObligaciones.every(o=>o.saldo===0));
  assert.equal(r.totalAplicadoFinal+r.endoso,5000000);
  assert.equal(r.saldoObligacionesPDF,0);assert.ok(r.resumenObligaciones.every(x=>x.saldoFinalObligaciones===0));
});
test('Caso real anonimizado: dos obligaciones y dos TDJ misma fecha, artículo 9 en cuatro combinaciones',()=>{
  const art9=decreto.TIPO_1419.ART9;
  const o1=obligation('JUANCA-O1',1,{
    concepto:'RETENCIÓN',anio:2026,periodo:'1',vencimientos:[{id:'J-V1',numero:1,fecha:'2026-02-17',impuesto:327837}],
    pagos:[{id:'J-P1',numero:1,recibo:'PAGO-1',fecha:'2026-07-15',valor:80000,tipo:'TASA DIAN'},
           {id:'J-P2',numero:2,recibo:'PAGO-2',fecha:'2026-07-21',valor:284837,tipo:'TASA DIAN'}]
  });
  const o2=obligation('JUANCA-O2',2,{
    concepto:'VENTAS',anio:2026,periodo:'1',tieneSancion:'SI',valorSancion:8211000,
    fechaSancion:'2026-08-12',beneficioSancion:'CON BENEFICIO',
    vencimientos:[{id:'J-V2',numero:1,fecha:'2026-02-17',impuesto:23131163}]
  });
  const tasa={['JUANCA-O1']:art9,['JUANCA-O2']:art9};
  const ts=[title('T1',34099163,'2026-07-29',{tasasPorObligacion:tasa}),title('T2',14794449,'2026-07-29',{tasasPorObligacion:tasa})];
  const r=run([o1,o2],ts);
  assert.equal(r.resumenObligaciones.length,2);
  assert.equal(r.resumenTitulos.length,2);
  assert.equal(r.resumenObligaciones.every(x=>x.saldo===0),true,'Con títulos suficientes no puede quedar deuda y endoso simultáneamente');
  assert.equal(r.totalAplicadoFinal+r.endoso,48893612,'Conservación del nominal TDJ');
  assert.ok(r.resumenTitulos.flatMap(x=>x.trazabilidad).every(x=>x.tipoTasaObligacion===art9),'Ninguna combinación TDJ puede degradar ART9 a DIAN');
});
test('Excel conserva matriz completa incluso para combinaciones no aplicadas',()=>{
  run([obligation('O1',1),obligation('O2',2)],[title('T1',5000000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}})]);
  const rows=ctx.fixture.excel().rows;
  assert.ok(rows.some(r=>r[0]==='TASAS TDJ POR OBLIGACIÓN'));
  assert.ok(rows.some(r=>r.includes(decreto.TIPO_1419.ART9)&&r.includes('O1')));
});
for(const tipo of [decreto.TIPO_1419.ART10_OMISO,decreto.TIPO_1419.ART10_CORRECCION]){
  test(tipo+' solo en obligación 2',()=>{
    const o2=obligation('O2',2,{tieneSancion:'SI',valorSancion:1000000,fechaSancion:'2026-09-18',beneficioSancion:'CON BENEFICIO'});
    const r=run([obligation('O1',1),o2],[title('T1',5000000,'2026-09-18',{tasasPorObligacion:{O1:'TASA DIAN',O2:tipo}})]);
    const apps=r.resumenTitulos[0].trazabilidad;
    assert.equal(apps[0].tipoTasaObligacion,'TASA DIAN');assert.equal(apps[1].tipoTasaObligacion,tipo);
    if(tipo===decreto.TIPO_1419.ART10_CORRECCION)assert.equal(apps[1].aplicadoIntereses,0);
    else assert.equal(apps[1].aplicadoIntereses,32000);
    assert.equal(r.resumenObligaciones.every(x=>x.saldo===0),true);
  });
}
test('Recuperación Excel respeta tasas con nuevos IDs y no convierte todo a DIAN',()=>{
  const os=[obligation('ANTES1',1),obligation('ANTES2',2)];
  const ts=[title('T1',5000000,'2026-08-09',{tasasPorObligacion:{ANTES1:decreto.TIPO_1419.ART9,ANTES2:'TASA DIAN'}})];
  const rows=tasas203.filasTasasTDJ(ts,os,()=>0.045);
  const nuevos=[obligation('NUEVO1',1),obligation('NUEVO2',2)],titulos=[title('T1',5000000)];
  tasas203.recuperarTasasTDJ(rows,titulos,nuevos);
  assert.equal(tasas203.tipoTasaTDJ(titulos[0],nuevos[0]),decreto.TIPO_1419.ART9);
  assert.equal(tasas203.tipoTasaTDJ(titulos[0],nuevos[1]),'TASA DIAN');
});
test('Identidad explícita conserva obligación aun con concepto/año/período iguales',()=>{
  const os=[obligation('O1',1),obligation('O2',2,{periodo:'1'})];
  const r=run(os,[title('T1',5000000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}})]);
  assert.equal(r.resumenTitulos[0].trazabilidad[0].tipoTasaObligacion,decreto.TIPO_1419.ART9);
  assert.equal(r.resumenTitulos[0].trazabilidad[1].tipoTasaObligacion,'TASA DIAN');
});
test('Tercer título conserva identidad con fechas iguales y recálculo independiente',()=>{
  const os=[obligation('O1',1),obligation('O2',2)];
  const ts=[title('T1',300000),title('T2',300000),title('T3',1900000)];
  const a=run(os,ts),b=run(os,ts);
  assert.equal(a.endoso,500000);assert.equal(a.endoso,b.endoso);
  assert.equal(a.resumenTitulos.length,3);assert.equal(a.totalAplicadoFinal,2000000);
});
// Validar el XLSX real construido por la aplicación (sin librería de autoría alternativa).
run([obligation('O1',1),obligation('O2',2)],[title('T1',5000000,'2026-08-09',{tasasPorObligacion:{O1:decreto.TIPO_1419.ART9,O2:'TASA DIAN'}})]);
const blob=ctx.fixture.export();assert.ok(blob?.size>5000);
const bytes=new Uint8Array(await blob.arrayBuffer()),decoder=new TextDecoder();
let offset=0,sheet='';
while(offset+30<bytes.length&&new DataView(bytes.buffer).getUint32(offset,true)===0x04034b50){
  const d=new DataView(bytes.buffer),size=d.getUint32(offset+18,true),nl=d.getUint16(offset+26,true),xl=d.getUint16(offset+28,true);
  const name=decoder.decode(bytes.slice(offset+30,offset+30+nl)),start=offset+30+nl+xl;
  if(name==='xl/worksheets/sheet1.xml')sheet=decoder.decode(bytes.slice(start,start+size));
  offset=start+size;
}
assert.ok(sheet.includes('TASAS TDJ POR OBLIGACIÓN'));assert.ok(sheet.includes(decreto.TIPO_1419.ART9));
assert.ok(sheet.includes('0.045'));console.log('PASS XLSX binario: hoja, beneficio y porcentaje conservados');
if(process.env.TDJ_XLSX_EVIDENCE)fs.writeFileSync(process.env.TDJ_XLSX_EVIDENCE,bytes);
console.log('RESULTADO',passed,'casos + exportación XLSX binaria');
