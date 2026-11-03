import fs from 'node:fs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-proyeccion-276.json',import.meta.url),'utf8'));
export function revertirProyeccion276(source,file){
 source=source.replaceAll('\r\n','\n');
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  const count=source.split(after).length-1;
  if(count){assert.equal(count,1,file+': cambio 276 único');source=source.replace(after,()=>before);}
 }
 return source;
}
