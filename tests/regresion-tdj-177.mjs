import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(`REGRESIÓN TDJ 177: ${msg}`)};

const tdj=read('js/tdj.js');
const guard=read('js/tdj-secuencia-guard-16.33.177.js');
const importer=read('js/importador-excel.js');
const app=read('js/app.js');
const liquidacion=read('liquidacion.html');
const titulos=read('titulos.html');

assert(tdj.includes('tdj-secuencia-guard-16.33.177.js?v=16.33.177'),'tdj.js no carga la guardia 177');
assert(tdj.includes('tdj-core-16.33.143.js?v=16.33.177'),'tdj.js no conserva el core protegido 16.33.143');
assert(guard.includes('valor:0'),'la guardia 177 no tiene la simulación sin TDJ actual');
assert(guard.includes('posteriores.every'),'la guardia 177 no verifica pagos normales posteriores completamente aplicados');
assert(guard.includes('saldo<=1000'),'la tolerancia de reconciliación TDJ no está protegida en 177');
assert(!importer.includes('export-tdj-recovery-16.33.174.js'),'el overlay de recuperación 174 sigue activo en el importador DIAN');
assert(importer.includes('export-dian-tdj-control-16.33.177.js'),'el control final DIAN 177 no está cargado');
assert(app.includes('importador-excel.js?v=16.33.177'),'app.js no carga el importador Excel con cache-busting 177');
assert(liquidacion.includes('js/app.js?v=16.33.177'),'liquidacion.html no carga app.js 177');
assert(titulos.includes('TDJ UI DEPLOY 16.33.177'),'titulos.html no está alineado a 177');
assert(!titulos.includes('v!=="16.33.163"'),'titulos.html conserva el guardia obsoleto 163');
assert(!titulos.includes('tdj.js?v=16.33.163'),'titulos.html conserva el script TDJ obsoleto 163');

// Protección fuerte: ningún motor matemático protegido pudo cambiar desde
// el release 16.33.176 que se tomó como línea base.
const base='ae89374bde63b97f519d11af16ebd105596f5bf2';
for(const p of ['js/tdj-core-16.33.143.js','js/motor-liquidacion.js','js/motor-liquidacion-oficial.js','js/prioridad-tdj-v132.js']){
  const r=execFileSync('git',['diff','--quiet',`${base}...HEAD`,'--',p],{stdio:'ignore'});
  assert(r===null,`${p} fue modificado desde 16.33.176`);
}

console.log('TDJ 177 REGRESSION OK');
console.log('PROTECTED ENGINES OK');
console.log('CACHE-BUSTING 177 OK');
console.log('DIAN EXCEL CONTROL 177 OK');
