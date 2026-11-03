import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {revertirSancionOficial275} from './revertir-sancion-oficial-275.mjs';
const base='dcccc20',read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
const previous=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8',maxBuffer:20000000}).replaceAll('\r\n','\n');
const manifest=JSON.parse(read('runtime-manifest.json'));
assert.equal(manifest.version,'16.33.275');assert.equal(JSON.parse(read('version.json')).version,manifest.version);
for(const file of manifest.files){
 if(file==='version.json')continue;
 assert.equal(revertirSancionOficial275(read(file),file),previous(file),file+': solo cambio 275 delimitado');
}
const file='js/motor-liquidacion-oficial.js';
let actual=read(file),before=previous(file);
const method=s=>s.slice(s.indexOf('  actualizarSancionOficial('),s.indexOf('\n  calcular(datos)'));
actual=actual.replace(method(actual),method(before));
actual=actual.replace('actualizacionSancionPago.tramos=act.tramos.map(t=>({...t,saldoAntes:roundMil(t.saldoInicial||0),saldoDespues:roundMil(t.saldoFinal||0)}));',before.match(/actualizacionSancionPago.tramos=act.tramos.map\(t=>.*?;/)[0]);
assert.equal(actual,before,'Intereses, fecha base, beneficios, mínimos y distribución sin cambios');
console.log('ALCANCE OFICIAL 275 OK: todos los recursos comparados con 274; solo fórmula oficial, metadatos, soporte y versión autorizados');
