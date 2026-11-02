import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {revertirImportacion273} from './revertir-importacion-273.mjs';
const base='49004d29ed19de99bc4832d55c34c5556725b585',read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
const patches=JSON.parse(read('tests/fixtures/cambios-importacion-273.json'));
for(const file of Object.keys(patches))assert.equal(revertirImportacion273(read(file),file),execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': adiciones delimitadas y reversibles');
const manifest=JSON.parse(read('runtime-manifest.json'));
for(const file of Object.keys(manifest.protected)){
 if(['js/app.js','js/tdj-core-16.33.143.js'].includes(file))continue;
 assert.equal(read(file),execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': motores y reglas intactos');
}
const provenance=JSON.parse(read('vendor/pdfjs/procedencia.json'));
for(const [file,sha] of Object.entries(provenance.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('vendor/pdfjs/'+file)).digest('hex'),sha);
console.log('ALCANCE 273 OK: motores y adaptadores reversibles; PDF.js verificado; retirada web comprobada por 274');
