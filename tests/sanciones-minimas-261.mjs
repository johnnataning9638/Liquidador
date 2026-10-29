import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {MotorLiquidacion} from '../js/motor-liquidacion.js';
import {MotorLiquidacionOficial} from '../js/motor-liquidacion-oficial.js';
const {valores}=JSON.parse(fs.readFileSync(new URL('./fixtures/sanciones-minimas-dian-261.json',import.meta.url),'utf8'));
const uvt=JSON.parse(fs.readFileSync(new URL('../datos/uvt.json',import.meta.url),'utf8'));
assert.deepEqual(uvt.filter(x=>x.anio>=2006).map(x=>[x.anio,x.sancionMinima]),valores,'Serie 2006–2026 coincide con fuentes DIAN; 2006 no es 10 UVT');
assert.equal(new Set(uvt.map(x=>x.anio)).size,uvt.length,'Sin años duplicados');
for(const x of uvt.filter(x=>x.anio>=2007))assert.equal(x.sancionMinima,Math.floor((x.valor*10+500)/1000)*1000,'Aproximación al millar más cercano, no al superior');
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const start=app.indexOf('function actualizarSancionMinimaUI(){');
const code=app.slice(start,app.indexOf('\nfunction sincronizarTipoLiquidacionConSancion',start));
let count=0;
for(const Clase of [MotorLiquidacion,MotorLiquidacionOficial]){
 const motor=new Clase({uvt});
 for(const [anio,expected] of valores){
  assert.equal(motor.sancionMinima(anio),expected);
  assert.equal(motor.sancionMinima(String(anio)),expected);
  const datos={anio,fechaSancion:`${anio}-01-01`,vencimientos:[{fecha:`${anio}-01-01`,impuesto:1000000}],pagos:[]};
  assert.equal(motor.sancionConBeneficio(1000000,datos,{reduceSancion:true,factorSancion:0.15}),expected,'Beneficio respeta piso corregido');
  assert.equal(motor.sancionConBeneficio(expected-1000,datos,{reduceSancion:true,factorSancion:0.15}),expected-1000,'No aumentar sanción existente menor que piso');
  assert.equal(motor.sancionConBeneficio(1000000,datos,{reduceSancion:false,factorSancion:1}),1000000,'Sin beneficio conserva saldo');
  const fields={anio:{value:String(anio)},tieneSancion:{value:'SI'},beneficioSancion:{value:'CON BENEFICIO'},fechaSancion:{value:`${anio}-01-01`},sancionMinima:{value:''}};
  const ctx=vm.createContext({$:id=>fields[id],motor,pagos:[],upper:x=>String(x).toUpperCase(),fechaISO:x=>x,dinero:x=>String(x)});
  vm.runInContext(code+'\nactualizarSancionMinimaUI();',ctx);
  assert.equal(Number(fields.sancionMinima.value),expected,'Campo DIAN usa tabla corregida');
  count++;
 }
 assert.equal(motor.sancionMinima(1987),0);assert.equal(motor.sancionMinima(2027),0);
}
for(const file of ['../js/app.js','../js/tdj-core-16.33.143.js'])assert.ok(fs.readFileSync(new URL(file,import.meta.url),'utf8').includes('cargarUVTConRespaldo()'),'DIAN y TDJ usan fuente única central con respaldo');
console.log(`SANCIONES MÍNIMAS 261 OK: 21 años, ${count} controles privada/oficial, piso de beneficio, UI y límites`);
