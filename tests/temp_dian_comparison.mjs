import assert from 'node:assert/strict';
import {validarSeleccion1419,TIPO_1419} from '../js/decreto-1419.js';
const e1=validarSeleccion1419({tipo:TIPO_1419.ART10_OMISO,fechasVencimiento:['2026-08-10'],fechaPresentacion:'2026-09-16',fechaPago:'2026-09-20',esTitulo:false});
assert.ok(e1.some(x=>x.includes('entre el 17/09/2026 y el 19/11/2026')));
const e2=validarSeleccion1419({tipo:TIPO_1419.ART10_CORRECCION,fechasVencimiento:['2026-08-10'],fechaPresentacion:'2026-08-20',fechaPago:'2026-09-20',esTitulo:false});
assert.ok(e2.some(x=>x.includes('entre el 17/09/2026 y el 19/11/2026')));
const e3=validarSeleccion1419({tipo:TIPO_1419.ART9,fechasVencimiento:['2026-08-10'],fechaPago:'2026-09-20',esTitulo:false});
assert.equal(e3.length,0);
console.log('DIAN_DATE_ALIGNMENT_OK');