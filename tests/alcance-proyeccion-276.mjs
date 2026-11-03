import {revertirCuadro277} from './revertir-cuadro-277.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {revertirProyeccion276} from './revertir-proyeccion-276.mjs';
const read=f=>revertirCuadro277(fs.readFileSync(f,'utf8'),f),base='8fead04';
const before=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8',maxBuffer:20000000}).replaceAll('\r\n','\n');
const manifest=JSON.parse(read('runtime-manifest.json'));
assert.equal(manifest.version,'16.33.276');assert.equal(JSON.parse(read('version.json')).version,manifest.version);
for(const file of manifest.files){
 if(file==='js/proyeccion-beneficio-276.js')continue;
 assert.equal(revertirProyeccion276(read(file),file),before(file),file+': cambio delimitado reversible contra 275');
}
const helper=read('js/proyeccion-beneficio-276.js');assert.doesNotMatch(helper,/valor:\s*[1-9]|Math\.MAX_SAFE_INTEGER|localStorage|fetch\(/,'Proyección sin dinero inventado ni persistencia');
assert.match(helper,/valor:0/);assert.match(helper,/return \{\.\.\.resultado,proyeccionesBeneficio\}/,'Saldo contable separado de consultas');
console.log('ALCANCE 276 OK: todos los recursos preservados salvo consultas aisladas, soportes y versión; sin pago ficticio ni persistencia');
