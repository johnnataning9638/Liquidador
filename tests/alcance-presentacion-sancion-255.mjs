import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-presentacion-sancion-255.json',import.meta.url),'utf8'));
export function revertirCambios255(source,file){
 source=source.replace(/\r\n/g,'\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.ok(source.includes(after),file+': soporte de solo sanción delimitado');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirCambios255(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','d0f6d51:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+': solo presentación TDJ');
for(const file of ['js/app.js','js/motor-liquidacion.js','js/motor-liquidacion-base.js','js/motor-liquidacion-oficial.js'])assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','d0f6d51:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+': DIAN y motores intactos');
console.log('ALCANCE 255 OK: únicamente presentación TDJ; DIAN y motores idénticos a 254');
