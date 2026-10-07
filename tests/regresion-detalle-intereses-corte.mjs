import fs from "node:fs";
import assert from "node:assert/strict";
const app=fs.readFileSync("js/app.js","utf8");
const tdj=fs.readFileSync("js/tdj.js","utf8");
for(const [name,src] of [["app.js",app],["tdj.js",tdj]]){
  assert.match(src,/detalleCorte=Array\.isArray\(r\?\.interesesPorCuota\)\?r\.interesesPorCuota:\[\]/,`${name}: fallback de corte ausente`);
  assert.match(src,/esCorteInformativo=Number\(p\.valor\|\|0\)===0/,`${name}: detección de corte ausente`);
  assert.match(src,/capitalBase\|\|t\?\.base\|\|vtoRef\?\.saldo\|\|vtoRef\?\.impuesto/,`${name}: capital base de corte ausente`);
}
console.log("REGRESIÓN DETALLE INTERESES FECHA DE CORTE: OK");
