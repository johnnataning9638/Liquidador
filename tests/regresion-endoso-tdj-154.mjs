import fs from "node:fs";
import assert from "node:assert/strict";
const s=fs.readFileSync("js/tdj-core-16.33.143.js","utf8");
assert.match(s,/obligacionCubiertaPorPagosProtegidos/);
assert.match(s,/motorActual\.calcular\(datosAjustados\)/);
assert.match(s,/16\.33\.154/);
console.log("REGRESION TDJ ENDOSO 154 OK");
