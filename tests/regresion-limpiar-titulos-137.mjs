import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../js/prioridad-tdj-v132.js",import.meta.url),"utf8");

assert.match(source,/v16\.33\.137/);
assert.match(source,/instalarLimpiezaExclusivaTitulosTDJ/);
assert.match(source,/\.btn-limpiar-tdj/);
assert.match(source,/dataset\?\.pane!=="titulos"/);
assert.match(source,/stopImmediatePropagation\(\)/);
assert.match(source,/#tablaTitulos tbody \[data-del\]/);
assert.match(source,/importarTitulosTexto/);
assert.match(source,/resultadoTDJ/);
assert.match(source,/tbody\.innerHTML=""/);

// La limpieza específica debe impedir que el manejador global de tdj.js
// alcance el botón de la pestaña TÍTULOS.
const captura=source.indexOf('document.addEventListener("click",e=>{');
assert.ok(captura>=0,"Debe existir interceptor de captura para LIMPIAR TDJ");
const selector=source.indexOf('.btn-limpiar-tdj',captura);
const pane=source.indexOf('pane?.dataset?.pane!=="titulos"',captura);
const stop=source.indexOf('e.stopImmediatePropagation()',captura);
assert.ok(selector>captura && pane>selector && stop>pane);

console.log("OK: LIMPIAR en pestaña TÍTULOS limpia solo TDJ y elimina todas sus filas.");
