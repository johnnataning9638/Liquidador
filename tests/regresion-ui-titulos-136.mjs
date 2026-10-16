import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile('js/tdj.js','utf8');
assert.match(source,/obligaciones=\[nuevaObligacion\(1\)\];titulos=\[\];renderObligaciones\(\);renderPagos\(\);renderTitulos\(\);/);
assert.match(source,/titulos=nuevosTitulos\.length\?nuevosTitulos:\[\];/);
assert.match(source,/function extraerTitulosTDJRobustoExcel\(rows\)/);
assert.match(source,/const titulosFuente=titulosRobustos\.length>titulosCanonicos\.length\?titulosRobustos:titulosCanonicos/);
assert.match(source,/out\.some\(x=>x\.tdj===numeroTituloImportacion\(t\)/);
assert.doesNotMatch(source,/if\(!titulos\.length\)titulos=\[nuevoTitulo\(1\)\];/);
assert.match(source,/version:\"16\.33\.136-TDJ\"/);
console.log('OK: TDJ inicia sin filas y Excel activa recuperación ante TDJ repetido con fecha distinta.');
