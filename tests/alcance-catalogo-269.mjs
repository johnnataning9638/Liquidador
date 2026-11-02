import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {revertirPanelTasas271} from './alcance-panel-tasas-271.mjs';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-catalogo-269.json',import.meta.url),'utf8'));
export function revertirCambios269(source,file){
 source=revertirPanelTasas271(source,file);
 // 270 únicamente actualiza la identificación de versión de estas vistas.
 if(['index.html','liquidacion.html','titulos.html','js/tdj.js'].includes(file))source=source.replace(/16\.33\.(270|271)/g,'16.33.269');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': catálogo 269 delimitado');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirCambios269(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','b2032278f1617cf9b6f1fcc445abefc764b13829:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': solo consulta y versión autorizadas');
console.log('ALCANCE CATÁLOGO 269 OK: consulta reversible; cálculos y reglas previas conservados');
