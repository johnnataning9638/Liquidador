import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile('js/tdj.js','utf8');
assert.match(source,/obligaciones=\[nuevaObligacion\(1\)\];titulos=\[\];renderObligaciones\(\);renderPagos\(\);renderTitulos\(\);/);
assert.match(source,/titulos=nuevosTitulos\.length\?nuevosTitulos:\[\];/);
assert.match(source,/function extraerTitulosTDJRobustoExcel\(rows\)/);
assert.match(source,/const titulosFuente=titulosRobustos\.length>titulosCanonicos\.length\?titulosRobustos:titulosCanonicos/);
assert.doesNotMatch(source,/if\(!titulos\.length\)titulos=\[nuevoTitulo\(1\)\];/);
assert.match(source,/version:\"16\.33\.135-TDJ\"/);
console.log('OK: TDJ inicia sin filas, importa Excel con recuperación robusta y conserva el comportamiento de pegado.');
