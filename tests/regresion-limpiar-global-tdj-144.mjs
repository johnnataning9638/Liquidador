import fs from "node:fs";
import assert from "node:assert/strict";

const loader=fs.readFileSync("js/tdj.js","utf8");
const core=fs.readFileSync("js/tdj-core-16.33.143.js","utf8");
const html=fs.readFileSync("titulos.html","utf8");

assert.ok(loader.includes("#btnLimpiarTitulosGlobal"), "Falta captura global");
assert.ok(loader.includes("Se borrarán datos, pagos, títulos y resultados."), "Falta confirmación global");
assert.ok(loader.includes("./tdj-core-16.33.143.js"), "El motor original no quedó aislado");
assert.ok(!loader.includes("¿Desea limpiar únicamente los títulos / TDJ registrados?"), "El loader contiene el mensaje antiguo");
assert.ok(!core.includes("¿Desea limpiar únicamente los títulos / TDJ registrados?"), "El motor fuente no contiene el mensaje antiguo");
assert.ok(!html.includes("¿Desea limpiar únicamente los títulos / TDJ registrados?"), "El HTML fuente no contiene el mensaje antiguo");
console.log("OK: regresión LIMPIAR GLOBAL TDJ v16.33.144");
