import fs from 'node:fs';
import {revertirCambios253} from './alcance-sancion-corte-253.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const baseline='870c83165f540e70caf1d8a6d6483f6aed16ec9c';
const previous=file=>execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const read=file=>revertirCambios253(fs.readFileSync(file,'utf8'),file);
const file='js/motor-liquidacion.js';
let expected=previous(file);
const start=expected.indexOf('function redistribuirSancionSimple('),end=expected.indexOf('const esArt9=',start);
assert.ok(start>=0&&end>start);
expected=expected.slice(0,start)+expected.slice(end);
expected=expected.replace('try{return redistribuirSancionSimple(super.calcular(datos),datos);}','// Conservar la proporción y los saldos calculados por el motor base.\n    try{return super.calcular(datos);}');
assert.equal(read(file),expected,'Única baja matemática autorizada: redistribución posterior que anulaba proporción');
const base='js/motor-liquidacion-base.js';
expected=previous(base)
 .replace('const vtosConSaldoRestante=vencimientosExigibles.filter(v=>{','// SIMPLE: la sanción proporcional también se registra en anticipos\n      // sin vencimientos exigibles; usar la misma base que calculó la proporción.\n      const vtosConSaldoRestante=baseProporcional.filter(v=>{')
 .replace('(Number(saldoSancion||0)>0 ? vencimientosExigibles[0] : null);','(Number(saldoSancion||0)>0 ? baseProporcional[0] : null);');
assert.equal(read(base),expected,'Único ajuste base: registrar sanción en la misma base proporcional SIMPLE');
assert.equal(read('js/motor-liquidacion-oficial.js'),previous('js/motor-liquidacion-oficial.js'),'Motor oficial intacto');
console.log('ALCANCE 248 OK: dos cambios autorizados y delimitados; fórmula proporcional, beneficios, intereses y oficial intactos');
