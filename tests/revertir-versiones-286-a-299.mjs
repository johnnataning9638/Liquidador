import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Los controles históricos reconstruyen revisiones anteriores. Solo se
// permite revertir el contenido íntegro de la revisión publicada/aprobada
// identificada por Git; nunca se reemplaza una revisión desconocida.
const ref285='9b122a0ec236598e864d0f5d007d7c63cab242f7';
const ref299='f87b5df5b2c0814f228474c0fa0376f014139b50';
const paths=new Set(['index.html','liquidacion.html','titulos.html',
  'js/app.js','js/tdj-core-16.33.143.js','js/tdj.js',
  'js/importacion-web-pdf/modelo.js','js/importacion-web-pdf/pdf.js',
  'js/importacion-web-pdf/ui.js',
  'js/motor-liquidacion-base.js','runtime-manifest.json','version.json']);
const cache=new Map();
function read(ref,file){
  const key=ref+':'+file;
  if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],
    {encoding:'utf8',maxBuffer:20000000}).replaceAll('\r\n','\n'));
  return cache.get(key);
}
export function revertirVersiones286a299(source,file){
  if(!paths.has(file))return source;
  let approved=read(ref299,file);
  if(file==='runtime-manifest.json'){
    approved=approved
      .replace('6e19e51ff178a2410cd24863b61888600fd1cc48fb1ba13af3f4592da0c53249','51b48daa7017fa717a9b8cb4ea6ec8fb9ff2044a1f97348c330ed0da95f8034d')
      .replace('7aa7dd88cc8faef042556e3560fe596eb8ff2ef239bb3d0ef78fc914c2353e20','702fa6d6881d48515b6b0949b2a469b574ab5d7103a491b71946f9897b71f710');
  }
  // Los controles invocan sucesivamente varias reversiones; una entrada
  // histórica ya procesada debe conservarse para las comprobaciones originales.
  if(source!==approved)return source;
  assert.ok(approved.length>0);
  return read(ref285,file);
}
