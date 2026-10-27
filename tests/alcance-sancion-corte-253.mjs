import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-sancion-corte-253.json',import.meta.url),'utf8'));
export function revertirCambios253(source,file){
 source=source.replace(/\r\n/g,'\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.ok(source.includes(after),file+': cambio delimitado debe existir');
  source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches)){
 const prev=execFileSync('git',['show','eaa424c:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
 assert.equal(revertirCambios253(fs.readFileSync(file,'utf8'),file),prev,file+': solo sanción/corte autorizado');
}
console.log('ALCANCE 253 OK: sin cambios en fórmulas de proporcionalidad, beneficios, tasas o actualización de sanción');
