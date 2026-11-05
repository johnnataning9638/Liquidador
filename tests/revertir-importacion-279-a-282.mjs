import fs from 'node:fs';
import assert from 'node:assert/strict';
const cambios=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-importacion-279-a-282.json',import.meta.url),'utf8'));
export function revertirCambiosHasta278(source,file){
  source=source.replaceAll('\r\n','\n');
  for(const [antes,despues] of cambios[file]||[]){
    const count=source.split(despues).length-1;
    if(count){assert.equal(count,1,file+': cambios 279 a 282 delimitados');source=source.replace(despues,()=>antes);}
  }
  return source;
}
