import fs from 'node:fs';
import {revertirCambios264} from './alcance-retiro-campos-264.mjs';
import assert from 'node:assert/strict';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-uvt-263.json',import.meta.url),'utf8'));
export function revertirCambios263(source,file){
 source=revertirCambios264(source,file);
 for(const [before,after]of [...(patches[file]||[])].reverse()){
  assert.ok(source.includes(after),file+': integración UVT delimitada');source=source.replace(after,before);
 }
 return source;
}
