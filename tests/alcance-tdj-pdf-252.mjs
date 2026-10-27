import fs from 'node:fs';
import {revertirCambios253} from './alcance-sancion-corte-253.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-tdj-pdf-252.json',import.meta.url),'utf8'));
export function revertirCambiosTDJ252(source,file='js/tdj-core-16.33.143.js'){
 source=revertirCambios253(source,file);
 for(const [before,after] of patches[file]||[])source=source.replace(after,before);
 return source;
}
for(const file of Object.keys(patches)){
 const previous=execFileSync('git',['show','3294b4932773fb78033add8c666b542fd2efb0df:'+file],{encoding:'utf8'});
 assert.equal(revertirCambiosTDJ252(fs.readFileSync(file,'utf8'),file),previous.replace(/\r\n/g,'\n'),file+': solo cambios delimitados de corte y PDF');
}
for(const file of ['js/app.js','js/motor-liquidacion.js','js/motor-liquidacion-base.js','js/motor-liquidacion-oficial.js','js/prioridad-tdj-v132.js'])assert.equal(revertirCambios253(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','3294b4932773fb78033add8c666b542fd2efb0df:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+': conservar base antes de cambios 253');
console.log('ALCANCE TDJ 252 OK: motores y DIAN intactos; cambios exclusivos de corte/importación/PDF');
