import fs from 'node:fs';
import assert from 'node:assert/strict';
import {revertirProyeccion276} from './revertir-proyeccion-276.mjs';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-sancion-oficial-275.json',import.meta.url),'utf8'));
export function revertirSancionOficial275(source,file){
 source=revertirProyeccion276(source,file);
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  const count=source.split(after).length-1;
  if(count){assert.equal(count,1,file+': cambio oficial 275 único');source=source.replace(after,()=>before);}
  else assert.equal(source.split(before).length-1,1,file+': conservar referencia anterior 275');
 }
 return source;
}
