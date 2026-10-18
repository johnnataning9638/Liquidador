import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const blobSha=p=>execFileSync('git',['rev-parse',`HEAD:${p}`],{encoding:'utf8'}).trim();
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
assert(app.includes('importador-excel.js?v=16.33.177'),'app.js no carga el importador Excel con cache-busting 177');
assert(liquidacion.includes('js/app.js?v=16.33.177'),'liquidacion.html no carga app.js 177');
assert(titulos.includes('TDJ UI DEPLOY 16.33.177'),'titulos.html no está alineado a 177');
assert(!titulos.includes('v!=="16.33.163"'),'titulos.html conserva el guardia obsoleto 163');
assert(!titulos.includes('tdj.js?v=16.33.163'),'titulos.html conserva el script TDJ obsoleto 163');

const protegidos={
  'js/tdj-core-16.33.143.js':'d74c0790a90701187d97490f5eaaae0e2b3bf7b1',
  'js/motor-liquidacion.js':'723107d58f1b79a9aeab916edc01df141fbc97d7',
  'js/motor-liquidacion-oficial.js':'d794fd7ae606b402161949955f768d38ffc0fb84',
  'js/prioridad-tdj-v132.js':'8fd18189feea29eb3f3697e37f1dd24e08a78b40'
};
for(const [p,h] of Object.entries(protegidos)){
  assert(blobSha(p)===h,`${p} fue modificado; la lógica matemática protegida no puede cambiar`);
}

console.log('TDJ 177 REGRESSION OK');
console.log('PROTECTED ENGINES OK');
console.log('CACHE-BUSTING 177 OK');
console.log('DIAN EXCEL RECOVERY OVERLAY REMOVED OK');
