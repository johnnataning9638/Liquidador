import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("js/app.js","utf8");
const tdj=fs.readFileSync("js/tdj.js","utf8");
const html=fs.readFileSync("liquidacion.html","utf8");
const titulos=fs.readFileSync("titulos.html","utf8");

assert.match(app,/const capital= t\.base!=null\?Number\(t\.base\):\(t\.capitalBase!=null\?Number\(t\.capitalBase\):Number\(vto\?\.saldo\?\?vto\?\.impuesto\?\?0\)\);/);
assert.match(app,/const desde=t\.desde\|\|t\.fechaVencimiento\|\|primer\.desde\|\|vto\?\.fecha\|\|"";/);
assert.match(app,/const dias=t\.dias!=null\?Number\(t\.dias\):normales\.reduce/);
assert.match(app,/const tasa=t\.tasa!=null\?Number\(t\.tasa\):\(primer\.tasa==null\?null:Number\(primer\.tasa\)\);/);
assert.match(tdj,/function configurarTabCuota\(tr,tbody\)/);
assert.match(tdj,/const siguiente=filas\[actual\+1\]\?\.querySelector\('\.fecha-campo'\);/);
assert.match(tdj,/tr\.querySelector\('\[data-v="periodo"\]'\).*tabindex="-1"/s);
assert.match(tdj,/e\.preventDefault\(\);\s*if\(impuesto\)\{impuesto\.focus/);
assert.match(html,/js\/app\.js\?v=16\.33\.113/);
assert.match(titulos,/js\/tdj\.js\?v=16\.33\.113/);
console.log("REGRESION UI PDF OFICIAL + TAB TDJ OK — 8 ASERCIONES — VERSION 16.33.113");

// REGRESIÓN: si el tramo no trae capital base, el PDF oficial debe usar el impuesto total.
assert.match(app,/Number\(r\.impuesto\|\|0\)/);
console.log("REGRESIÓN CAPITAL BASE PDF OFICIAL OK");
