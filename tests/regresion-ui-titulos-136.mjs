import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile('js/tdj.js','utf8');
const core=await readFile('js/tdj-core-16.33.143.js','utf8');
const combined=`${source}\n${core}`;
assert.match(combined,/obligaciones=\[nuevaObligacion\(1\)\];titulos=\[\];renderObligaciones\(\);renderPagos\(\);renderTitulos\(\);/);
assert.match(combined,/titulos=nuevosTitulos\.length\?nuevosTitulos:\[\];/);
assert.match(combined,/function extraerTitulosTDJRobustoExcel\(rows\)/);
assert.match(combined,/const titulosFuente=titulosRobustos\.length>titulosCanonicos\.length\?titulosRobustos:titulosCanonicos/);
assert.match(combined,/out\.some\(x=>x\.tdj===numeroTituloImportacion\(t\)/);
assert.doesNotMatch(combined,/if\(!titulos\.length\)titulos=\[nuevoTitulo\(1\)\];/);
assert.match(combined,/version:\"16\.33\.136-TDJ\"/);
console.log('OK: TDJ inicia sin filas y Excel activa recuperación ante TDJ repetido con fecha distinta.');
