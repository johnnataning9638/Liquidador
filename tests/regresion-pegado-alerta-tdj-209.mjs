import assert from 'node:assert/strict';
import fs from 'node:fs';
import {procesarPegadoTitulosTDJ,instalarPegadoUnicoTitulosTDJ} from '../js/tdj-pegado-unico-209.js';
const cinco=[
 '469030003407621\t18/07/2026\t20000000',
 '469030003407622\t09/08/2026\t14794449',
 '469030003407623\t11/08/2026\t1000',
 '469030003407624\t17/09/2026\t3000',
 '469030003407625\t19/11/2026\t5000'
].join('\n');
const el={id:'importarTitulosTexto',value:'',selectionStart:0,selectionEnd:0,
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},
 dispatchEvent(e){this.ultimoEvento=e;return true;}};
function event(text=cinco,target=el){return {target,clipboardData:{getData:m=>m==='text/plain'?text:''},
  preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},stopPropagation(){}};}
const e1=event();assert.equal(procesarPegadoTitulosTDJ(e1,1000),true);
assert.ok(e1.prevented&&e1.stopped,'No debe ejecutarse también el pegado nativo');
assert.equal(el.value,cinco,'Cinco filas pegadas deben ser cinco filas visibles');
assert.equal(el.value.split('\n').length,5);
const duplicated=event();procesarPegadoTitulosTDJ(duplicated,1050);
assert.equal(el.value,cinco,'El evento duplicado inmediato no debe duplicar las filas');
el.value='UNO\nFIN';el.selectionStart=4;el.selectionEnd=4;
const e2=event('DOS\n');procesarPegadoTitulosTDJ(e2,2000);
assert.equal(el.value,'UNO\nDOS\nFIN','Debe conservarse la selección y respetar el contenido pegado');
const e3=event('DOS\n');procesarPegadoTitulosTDJ(e3,2400);
assert.equal(el.value,'UNO\nDOS\nDOS\nFIN','Dos pegados voluntarios separados deben funcionar');
const otro={id:'importarObligacionTexto',value:'',selectionStart:0,selectionEnd:0};
const evOtro=event('ABC',otro);assert.equal(procesarPegadoTitulosTDJ(evOtro,3000),false);
assert.equal(evOtro.prevented,undefined,'No afectar importadores de pagos y obligaciones');
let handlers=[];const doc={addEventListener(...args){handlers.push(args);}};
instalarPegadoUnicoTitulosTDJ(doc);instalarPegadoUnicoTitulosTDJ(doc);
assert.equal(handlers.length,1,'Un solo listener incluso si se inicializa dos veces');
assert.deepEqual(handlers[0].slice(0,1),['paste']);
assert.equal(handlers[0][2],true,'Usar captura para impedir duplicación por listeners posteriores');
const vis=fs.readFileSync('js/tdj-visual-beneficios.js','utf8');
const dian=fs.readFileSync('js/app.js','utf8');
const textos=[
 'BENEFICIO NO APLICABLE AL TÍTULO JUDICIAL',
 'no cumple los períodos permitidos para los artículos 9 y 10 del Decreto 1419 de 2026.',
 'Fechas permitidas: hasta el 09/08/2026, o del 17/09/2026 al 19/11/2026 (inclusive).',
 'Se ha seleccionado automáticamente TASA DIAN. Compruebe el porcentaje oficial correspondiente a la fecha.'
];
for(const t of textos){assert.ok(vis.includes(t),'Texto TDJ: '+t);assert.ok(dian.includes(t),'Texto DIAN: '+t);}
assert.match(vis,/if\(rechazado\)avisoBeneficioInvalidoTDJ\(titleId,fecha\)/);
assert.match(vis,/if\(rechazado\)avisoBeneficioInvalidoTDJ\(id,fecha\)/);
assert.match(vis,/fechaElegible1419TDJ\(fecha\)/);
assert.match(fs.readFileSync('js/tdj.js','utf8'),/instalarPegadoUnicoTitulosTDJ\(\)/);
console.log('PASS TDJ 209: pegado 5=5, 1 evento duplicado neutralizado, captura, pegados legítimos, mensaje equivalente DIAN.');
