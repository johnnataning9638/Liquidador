import fs from "node:fs";
import assert from "node:assert/strict";
import { extraerRegistrosTDJTexto } from "../js/tdj-importador.js";
import { numeroDesdeTexto, truncarValorEntero } from "../js/utilidades.js";

const util=fs.readFileSync("js/utilidades.js","utf8");
assert.match(util,/v16\.33\.(?:145|146) — COMPATIBILIDAD AISLADA DE IMPORTADORES/);
assert.match(util,/pegarDatos/);
assert.match(util,/importarPagosTexto/);
assert.match(util,/importarTitulosTexto/);

const casos=[
  ["1234567.89",1234567],
  ["1234567,89",1234567],
  ["1.234.567,89",1234567],
  ["1,234,567.89",1234567],
  ["1234567",1234567],
  ["0.99",0]
];

for(const [entrada,esperado] of casos){
  assert.equal(truncarValorEntero(numeroDesdeTexto(entrada)),esperado,`DIAN ${entrada}`);
}

const truncarImportado=s=>{
  let x=String(s);
  x=x.replace(/(?:\$\s*)?([+-]?\d{1,3}(?:,\d{3})+)\.(\d{1,2})(?!\d)/g,(_,entero)=>entero.replace(/,/g,""));
  x=x.replace(/(?:\$\s*)?([+-]?\d{1,3}(?:\.\d{3})+),(\d{1,2})(?!\d)/g,(_,entero)=>entero.replace(/\./g,""));
  x=x.replace(/(?:\$\s*)?([+-]?\d+)\.(\d{1,2})(?!\d)/g,"$1");
  x=x.replace(/(?:\$\s*)?([+-]?\d+),(\d{1,2})(?!\d)/g,"$1");
  return x;
};
for(const [entrada,esperado] of casos){
  const salida=Number(truncarImportado(entrada));
  assert.equal(salida,esperado,`pegado ${entrada}`);
}

const tdj=extraerRegistrosTDJTexto([
  "DOCUMENTO FUENTE\tFECHA\tVALOR",
  "4911098513361\t01/04/2026\t1234567.89"
].join("\n"));
assert.equal(tdj.length,1);
assert.equal(tdj[0].tdj,"4911098513361");
assert.equal(tdj[0].fecha,"2026-04-01");
assert.equal(tdj[0].valor,1234567);

const tdjComma=extraerRegistrosTDJTexto([
  "DOCUMENTO FUENTE\tFECHA\tVALOR",
  "4911098513362\t02/04/2026\t1.234.567,89"
].join("\n"));
assert.equal(tdjComma.length,1);
assert.equal(tdjComma[0].valor,1234567);

console.log("OK: regresión de importadores decimales v16.33.145/146");
