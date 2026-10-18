import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(`REGRESIÓN TDJ 177/178: ${msg}`)};
const tdj=read('js/tdj.js'),guard178=read('js/tdj-secuencia-guard-16.33.178.js'),importer=read('js/importador-excel.js'),app=read('js/app.js'),liquidacion=read('liquidacion.html'),titulos=read('titulos.html'),prioridad=read('js/prioridad-tdj.js'),v132=read('js/prioridad-tdj-v132.js'),excel=read('js/export-dian-tdj-control-16.33.178.js');
assert(tdj.includes('tdj-secuencia-guard-16.33.178.js?v=16.33.178'),'tdj.js no carga guardia 178');
assert(tdj.includes('tdj-core-16.33.143.js?v=16.33.178'),'tdj.js no conserva core protegido 16.33.143');
assert(guard178.includes('valor:0')&&guard178.includes('posteriores.every')&&guard178.includes('saldo<=1000'),'guardia 178 incompleta');
assert(prioridad.includes('CORRECCIÓN 16.33.177')&&prioridad.includes('prevMisma.length'),'la prioridad base no contiene la reconciliación histórica');
assert(v132.includes('CORRECCIÓN 16.33.178')&&v132.includes('tdjInnecesarioPorPagoPosterior')&&v132.includes('ajustarBase'),'la capa v132 realmente importada por el core no contiene la reconciliación activa');
assert(!importer.includes('export-tdj-recovery-16.33.174.js'),'overlay de recuperación 174 sigue activo en importador');
assert(importer.includes('export-dian-tdj-control-16.33.178.js'),'control Excel 178 no está cargado');
assert(excel.includes('TÍTULOS / TDJ — CONTROL FINAL 178')&&excel.includes('TÍTULOS TDJ'),'control Excel 178 no conserva bloque canónico');
assert(app.includes('importador-excel.js?v=16.33.177'),'app.js mantiene el contrato de carga del importador');
assert(liquidacion.includes('js/app.js?v=16.33.177'),'liquidacion.html mantiene el contrato estable de app.js');
assert(titulos.includes('js/tdj.js?v=16.33.177'),'titulos.html mantiene el entrypoint TDJ estable; el contenido interno activa 178');
const base='ae89374bde63b97f519d11af16ebd105596f5bf2';
for(const p of ['js/tdj-core-16.33.143.js','js/motor-liquidacion.js','js/motor-liquidacion-oficial.js']){try{execFileSync('git',['diff','--quiet',`${base}...HEAD`,'--',p],{stdio:'ignore'});}catch{throw new Error(`${p} fue modificado desde 16.33.176; no se permite alterar el motor matemático.`)}}
console.log('TDJ 177/178 REGRESSION OK');console.log('MATHEMATICAL ENGINES PROTECTED OK');console.log('SEQUENCE V132 178 ACTIVE OK');console.log('EXCEL CANONICAL CONTROL 178 OK');
