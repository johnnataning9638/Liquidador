import fs from "node:fs";
import assert from "node:assert/strict";

const tdj = fs.readFileSync("js/tdj.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

assert.match(tdj, /function nuevaObligacion\(numero\)[\s\S]*tipoTasa:"TASA DIAN"/);
assert.match(tdj, /function opcionTipoObligacionTDJ\(tipo="TASA DIAN"\)/);
assert.doesNotMatch(tdj, /validarDatos[\s\S]{0,12000}(?:importado|importacion|importación).*throw new Error/i);
assert.doesNotMatch(app, /(?:validar|calcular)[\s\S]{0,12000}(?:importado|importacion|importación).*throw new Error/i);

const oldRefs = [...(tdj + app).matchAll(/16\.33\.(11[0-7])/g)];
assert.equal(oldRefs.length, 0, "No deben quedar versiones activas 16.33.110–16.33.117 en app.js/tdj.js");

console.log("REGRESIÓN IMPORTACIÓN OPCIONAL: OK");
console.log("CAPTURA MANUAL: OK");
console.log("IMPORTACIÓN: OPCIONAL");
