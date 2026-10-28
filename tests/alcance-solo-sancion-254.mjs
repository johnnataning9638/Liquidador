import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-solo-sancion-254.json',import.meta.url),'utf8'));
export function revertirCambios254(source,file){
 source=source.replace(/\r\n/g,'\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.ok(source.includes(after),file+': conservar alcance exacto de hotfix 254');
  source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches)){
 const old=execFileSync('git',['show','38acdd71e55f637fad5d9b2a05d2f92326584058:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
 assert.equal(revertirCambios254(fs.readFileSync(file,'utf8'),file),old,file+': solo sanción sin cuotas');
}
console.log('ALCANCE 254 OK: validación y aplicación de sanción independiente; fórmulas y cronología preservadas');
