import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-retiro-campos-264.json',import.meta.url),'utf8'));
export function revertirCambios264(source,file){
 source=source.replaceAll('\r\n','\n');
 // 265 solo incorpora datos IBC; neutralizar la identificación de versión.
 if(['index.html','liquidacion.html','titulos.html','js/tdj.js'].includes(file))source=source.replaceAll('16.33.265','16.33.264');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': retirada delimitada');
  source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirCambios264(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','36a90a5:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': cambios exclusivos de controles retirados y versión');
console.log('ALCANCE 264 OK: retirada reversible contra 263, sin cambios ajenos');
