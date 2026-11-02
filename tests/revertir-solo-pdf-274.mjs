import fs from 'node:fs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-solo-pdf-274.json',import.meta.url),'utf8'));
export function revertirSoloPDF274(source,file){
 source=source.replaceAll('\r\n','\n');
 for(const [before,after] of patches[file]||[]){assert.equal(source.split(after).length-1,1,file+': versión 274 delimitada');source=source.replace(after,()=>before);}
 return source;
}
