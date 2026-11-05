import {revertirCambiosHasta278} from './revertir-importacion-279-a-282.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-logo-278.json',import.meta.url),'utf8'));
export function revertirLogo278(source,file){
 source=revertirCambiosHasta278(source,file);
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  const count=source.split(after).length-1;
  if(count){assert.equal(count,1,file+': cambio visual 278 único');source=source.replace(after,()=>before);}
 }
 return source;
}
