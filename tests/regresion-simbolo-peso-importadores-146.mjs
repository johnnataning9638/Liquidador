import fs from "node:fs";
import assert from "node:assert/strict";
import { numeroDesdeTexto, truncarValorEntero } from "../js/utilidades.js";
import { extraerRegistrosTDJTexto } from "../js/tdj-importador.js";

const util=fs.readFileSync("js/utilidades.js","utf8");
assert.match(util,/v16\.33\.146/);
assert.ok(util.includes("(?:\\$\\s*)?"),"La normalización debe reconocer $ con o sin espacio");
assert.ok(util.includes("\\$\\s*(?=[+-]?\\d)"),"El símbolo $ debe reconocerse también sin decimales");

const casos=[
  ["$1234567.89",1234567],
  ["$ 1234567.89",1234567],
  ["$1234567,89",1234567],
  ["$ 1234567,89",1234567],
  ["$1.234.567,89",1234567],
  ["$ 1.234.567,89",1234567],
  ["$1,234,567.89",1234567],
  ["$ 1,234,567.89",1234567],
  ["$1234567",1234567],
  ["$ 1234567",1234567]
];

for(const [entrada,esperado] of casos){
  assert.equal(truncarValorEntero(numeroDesdeTexto(entrada)),esperado,`numeroDesdeTexto ${entrada}`);
}

const truncarPegado=s=>{
  let x=String(s);
  x=x.replace(/(?:\$\s*)?([+-]?\d{1,3}(?:,\d{3})+)\.(\d{1,2})(?!\d)/g,(_,entero)=>entero.replace(/,/g,""));
  x=x.replace(/(?:\$\s*)?([+-]?\d{1,3}(?:\.\d{3})+),(\d{1,2})(?!\d)/g,(_,entero)=>entero.replace(/\./g,""));
  x=x.replace(/(?:\$\s*)?([+-]?\d+)\.(\d{1,2})(?!\d)/g,"$1");
  x=x.replace(/(?:\$\s*)?([+-]?\d+),(\d{1,2})(?!\d)/g,"$1");
  x=x.replace(/\$\s*(?=[+-]?\d)/g,"");
  return x;
};
for(const [entrada,esperado] of casos){
  const salida=Number(truncarPegado(entrada));
  assert.equal(salida,esperado,`pegado ${entrada}`);
}

const tdj=extraerRegistrosTDJTexto([
  "DOCUMENTO FUENTE\tFECHA\tVALOR",
  "4911098513361\t01/04/2026\t$ 1.234.567,89"
].join("\n"));
assert.equal(tdj.length,1);
assert.equal(tdj[0].tdj,"4911098513361");
assert.equal(tdj[0].fecha,"2026-04-01");
assert.equal(tdj[0].valor,1234567);

console.log("OK: regresión símbolo peso importadores v16.33.146");
