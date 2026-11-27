import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Los controles históricos reconstruyen revisiones anteriores. Solo se
// permite revertir el contenido íntegro de la revisión publicada/aprobada
// identificada por Git; nunca se reemplaza una revisión desconocida.
const ref285='9b122a0ec236598e864d0f5d007d7c63cab242f7';
const ref299='f87b5df5b2c0814f228474c0fa0376f014139b50';
const base300='00ec5b92eb77a2356c588024bd898353d92c11ae';
// Solo restaurar archivos exactos de la versión 300; cualquier alteración
// adicional queda visible para los controles históricos.
const hashes300={
 'index.html':'f1951953c11afe9e2e7329973218f581fdc8612b7c24ffef8db11acf4b425f62',
 'liquidacion.html':'3b8b5c8722d7cbb4b7bcd745df0bda4800f68819e2dc12321aeedfc03350691d',
 'titulos.html':'fff0d0758d8a7472f7cd9612458defd98daa50dfe03c1febd6061ce7c3f66c0b',
 'js/tdj.js':'57b9428ba540e3e73de2a9dfa6ccdd589e704cca2aeeac5c2b44811b84cea7f0',
 'js/importacion-web-pdf/modelo.js':'eb6831995e25206ef8c04a1b6e8bd0e0a9e5c2a11627f3d2cdf2984337994624',
 'js/importacion-web-pdf/pdf.js':'3e8a5b372291eb6956bdb2f298d42f26292520f8d184da1dd696ef98a32b60e6',
 'js/importacion-web-pdf/ui.js':'7fc8bda6846b6aaf169d6cc9ca9cd5c098f4f95d747ecd10cbfc8460d60401c6',
 'runtime-manifest.json':'b13b7f52693e928a5ece62b95f4c30df3e748947027035d353633eccbf4e1611',
 'version.json':'55340aa49972941b68e35335ca3930cbaa987a5e656cc6292ccbca6a4a7caf3f'
};
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
  if(hashes300[file]===createHash('sha256').update(source).digest('hex'))source=read(base300,file);
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
