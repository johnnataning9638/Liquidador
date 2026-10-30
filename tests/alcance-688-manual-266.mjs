import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-688-manual-266.json',import.meta.url),'utf8'));
export function revertirCambios266(source,file){
 source=source.replaceAll('\r\n','\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': beneficio manual delimitado');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirCambios266(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','f5edb63:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': solo 50% IBC manual y versión');
console.log('ALCANCE 266 OK: cambios reversibles contra 265; otras reglas conservadas');
