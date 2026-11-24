import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const previous='7cdeafe0c02d137c03df3a226cc3bb4f0ce3aca8';
const note='La presente herramienta constituye un instrumento de apoyo para la liquidación de obligaciones tributarias y no sustituye los aplicativos oficiales de la Entidad.';
const responsibility='Su uso, así como la validación de los resultados obtenidos, es responsabilidad del funcionario que la utiliza.';
for (const file of ['index.html','liquidacion.html','titulos.html']) {
  const body=fs.readFileSync(file,'utf8');
  const block=body.match(/<aside class="nota-responsabilidad[^"]*" aria-labelledby="nota-responsabilidad-titulo">[\s\S]*?<\/aside>/g);
  assert.equal(block?.length,1,file+': una nota');
  assert.ok(block[0].includes(note)&&block[0].includes(responsibility),file+': texto íntegro');
  const position=body.indexOf(block[0]);
  if(file==='index.html') assert.ok(position>body.indexOf('ABRIR LIQUIDACIÓN MÚLTIPLE')&&position<body.indexOf('</main>'));
  else assert.ok(position>body.indexOf('</header>')&&position<body.indexOf('<nav class="tabs-nav"')&&position<body.indexOf('<section class="tab-pane'));
  const baseline=execFileSync('git',['show',previous+':'+file],{encoding:'utf8'});
  const restored=body.replace(/<style id="estilos-nota-responsabilidad">[\s\S]*?<\/style>\n/,'').replace(block[0]+'\n','').replaceAll('16.33.299','16.33.298');
  assert.equal(restored,baseline,file+': sin otras modificaciones');
}
const version=JSON.parse(fs.readFileSync('version.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('runtime-manifest.json','utf8'));
assert.equal(version.version,'16.33.299');
assert.equal(manifest.version,version.version);
const previousManifest=JSON.parse(execFileSync('git',['show',previous+':runtime-manifest.json'],{encoding:'utf8'}));
assert.deepEqual(manifest.files,previousManifest.files,'Mismos recursos publicados');
const exempt=new Set(['index.html','liquidacion.html','titulos.html','js/tdj.js','version.json','runtime-manifest.json']);
for(const file of manifest.files.filter(f=>!exempt.has(f))){
  const previousBlob=execFileSync('git',['rev-parse',previous+':'+file],{encoding:'utf8'}).trim();
  const currentBlob=execFileSync('git',['hash-object',file],{encoding:'utf8'}).trim();
  assert.equal(currentBlob,previousBlob,file+': idéntico byte a byte a producción');
}
const baselineTDJ=execFileSync('git',['show',previous+':js/tdj.js'],{encoding:'utf8'});
assert.equal(fs.readFileSync('js/tdj.js','utf8').replaceAll('16.33.299','16.33.298'),baselineTDJ,'TDJ: solo versión');
const changed=execFileSync('git',['diff','--name-only',previous,'HEAD','--','js/','datos/'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(changed,['js/tdj.js'],'Ningún motor, dato ni parámetro cambia');
console.log('Nota de responsabilidad: ubicación, texto, versión y conservación de cálculos OK');
