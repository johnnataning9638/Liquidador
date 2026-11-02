import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-panel-tasas-271.json',import.meta.url),'utf8'));
export function revertirPanelTasas271(source,file){
 source=source.replaceAll('\r\n','\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': cambio exclusivo del panel TIM 271');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches))assert.equal(revertirPanelTasas271(fs.readFileSync(file,'utf8'),file),execFileSync('git',['show','b5ba6969eafab9174ecd23aac8d7f6946857c685:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': solo panel TIM, cálculos y demás vistas intactos');
console.log('ALCANCE PANEL 271 OK: una celda de presentación corregida, sin cambiar cálculos');
