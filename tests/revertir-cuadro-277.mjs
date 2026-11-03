import {revertirLogo278} from './revertir-logo-278.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-cuadro-277.json',import.meta.url),'utf8'));
export function revertirCuadro277(source,file){
 source=revertirLogo278(source,file);
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  const count=source.split(after).length-1;
  if(count){assert.equal(count,1,file+': cambio 277 único');source=source.replace(after,()=>before);}
 }
 return source;
}
