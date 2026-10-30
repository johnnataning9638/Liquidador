import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-favorabilidad-267.json',import.meta.url),'utf8'));
export function revertirCambios267(source,file){
 source=source.replaceAll('\r\n','\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': favorabilidad delimitada');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirCambios267(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','7a1bf11:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': solo aplicación automática por vencimiento y pago');
console.log('ALCANCE 267 OK: cambios reversibles contra 266; TIM, IBC original y otras reglas conservadas');
