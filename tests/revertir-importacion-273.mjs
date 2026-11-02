import {revertirSoloPDF274} from './revertir-solo-pdf-274.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-importacion-273.json',import.meta.url),'utf8'));
export function revertirImportacion273(source,file){
 source=revertirSoloPDF274(source,file);
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.equal(source.split(after).length-1,1,file+': integración de importación 273 delimitada');source=source.replace(after,()=>before);
 }
 return source;
}
