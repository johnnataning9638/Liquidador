import assert from 'node:assert/strict';
import fs from 'node:fs';
import {referenciaTimTDJ} from '../js/tdj-tasa-vista-207.js';
const filas=[
 {desde:'2026-07-01',hasta:'2026-07-31',tasas:{'TASA DIAN':0.2679}},
 {desde:'2026-09-01',hasta:'2026-09-30',tasas:{'TASA DIAN':0.2724}}
];
assert.deepEqual(referenciaTimTDJ('2026-11-20',filas),{tasa:0.2724,periodo:'2026-09'});
assert.deepEqual(referenciaTimTDJ('2026-10-05',filas),{tasa:0.2724,periodo:'2026-09'});
assert.equal(referenciaTimTDJ('2026-07-01',filas),null);
const visual=fs.readFileSync('js/tdj-visual-beneficios.js','utf8');
assert.match(visual,/ÚLTIMA TIM:/);
assert.match(visual,/REFERENCIA/);
assert.match(visual,/NO la tasa oficial del título/);
assert.match(visual,/referenciaTimTDJ\(fecha,tasasMoratorias\)/);
const app=fs.readFileSync('js/app.js','utf8');
assert.match(app,/function mostrarAvisoFechaTituloDian\(/);
assert.match(app,/BENEFICIO NO APLICABLE AL TÍTULO JUDICIAL/);
assert.match(app,/if\(validarTipo\)mostrarAvisoFechaTituloDian\(p,tipoNuevo\)/);
assert.match(app,/el\.value=p\.tipo/);
console.log('PASS TDJ/DIAN 207: tasa histórica solo orientativa, sin inventar TIM futura; aviso al cambiar beneficio.');
