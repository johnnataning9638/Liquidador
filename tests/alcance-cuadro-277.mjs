import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {revertirCuadro277} from './revertir-cuadro-277.mjs';
const read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
const manifest=JSON.parse(read('runtime-manifest.json'));
assert.equal(manifest.version,'16.33.277');assert.equal(JSON.parse(read('version.json')).version,manifest.version);
for(const f of manifest.files){
 const before=execFileSync('git',['show','9ce40ca:'+f],{encoding:'utf8',maxBuffer:20000000}).replaceAll('\r\n','\n');
 assert.equal(revertirCuadro277(read(f),f),before,f+': cambios reversibles contra 276');
}
for(const f of ['js/app.js','js/tdj-core-16.33.143.js'])assert.doesNotMatch(read(f),/htmlProyeccionesBeneficio|pintarProyeccionesBeneficio|filasProyeccionesBeneficio|proyeccionesBeneficio/,'Sin panel ni sección de exportación adicional');
assert.doesNotMatch(read('js/proyeccion-beneficio-276.js'),/valor:\s*[1-9]|Math\.MAX_SAFE_INTEGER|localStorage|fetch\(/,'Sin dinero inventado ni persistencia');
console.log('ALCANCE 277 OK: cambios autorizados delimitados, fórmula oficial y demás reglas reversibles, sin panel adicional');
