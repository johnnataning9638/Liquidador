import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fechaElegible1419TDJ} from '../js/tdj-tasas-203.js';
import {TIPO_1419,validarSeleccion1419} from '../js/decreto-1419.js';
const bridge=fs.readFileSync('js/tdj-tasa-bridge-16.33.174.js','utf8');
assert.match(bridge,/fechaElegible1419TDJ\(fp\)/);
assert.match(bridge,/const requisitos=errores\.filter/);
assert.match(bridge,/esTipoDecreto1419\(tipoActual\)/);
const cases=[['2026-08-09',true],['2026-08-10',false],['2026-09-16',false],['2026-09-17',true],['2026-09-23',true],['2026-11-19',true],['2026-11-20',false]];
for(const [fecha,permitido] of cases){
  assert.equal(fechaElegible1419TDJ(fecha),permitido,fecha);
  for(const tipo of [TIPO_1419.ART9,TIPO_1419.ART10_OMISO,TIPO_1419.ART10_CORRECCION]){
    const errores=validarSeleccion1419({tipo,fechasVencimiento:['2026-02-17'],fechaPresentacion:'2026-10-01',fechaTitulo:fecha,esTitulo:true});
    const requisitos=errores.filter(e=>!/(título debe|artículo 9 admite títulos|registre la fecha de constitución del título)/i.test(e));
    if(!fechaElegible1419TDJ(fecha))requisitos.push('TDJ fuera de ventana');
    assert.equal(requisitos.includes('TDJ fuera de ventana'),!permitido,fecha+' '+tipo);
    assert.ok(!requisitos.some(e=>e.includes('artículo 9 admite títulos')),fecha);
  }
}
console.log('PASS TDJ 212: doble ventana Art9/Art10, límites y 23/09/2026.');
