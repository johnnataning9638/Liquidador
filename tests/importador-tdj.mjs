import assert from "node:assert/strict";
import {reconstruirTitulosTDJDesdeFilas} from "../js/importador-tdj.js";

// Fixture equivalente a la estructura real del Excel compartido por el usuario.
const filas=[
  ["Nº","TDJ Nº","RECIBO Nº","FECHA PAGO / CORTE","VALOR PAGO","TIPO"],
  [1,"","4911089297230","2026-03-05",4137000,"TASA DIAN"],
  [6,"111","","2026-04-01",20000000,"TASA DIAN"],
  [7,"222","","2026-05-01",10000000,"TASA DIAN"],
  [],
  ["TÍTULOS / TDJ — TÍTULOS REGISTRADOS"],
  ["Nº","TDJ","FECHA","VALOR","TIPO","TASA","OBSERVACIÓN"],
  [1,"111","2026-04-01",20000000,"TASA DIAN","",""] ,
  [2,"222","2026-05-01",10000000,"TASA DIAN","",""] ,
  [],
  ["TÍTULOS TDJ","Nº","TDJ","FECHA","VALOR","TIPO","OBSERVACIÓN"],
  ["",1,"111","2026-04-01",20000000,"TASA DIAN",""] ,
  ["",2,"222","2026-05-01",10000000,"TASA DIAN",""] ,
  ["FIN RECUPERACIÓN COMPLETA"]
];

const result=reconstruirTitulosTDJDesdeFilas(filas);
assert.deepEqual(result.map(x=>({tdj:x.tdj,fecha:x.fecha,valor:x.valor})),[
  {tdj:"111",fecha:"2026-04-01",valor:20000000},
  {tdj:"222",fecha:"2026-05-01",valor:10000000}
]);

const soloUnTitulo=reconstruirTitulosTDJDesdeFilas([
  ["Nº","TDJ Nº","RECIBO Nº","FECHA PAGO / CORTE","VALOR PAGO","TIPO"],
  [1,"111","","2026-04-01",20000000,"TASA DIAN"]
]);
assert.deepEqual(soloUnTitulo.map(x=>({tdj:x.tdj,fecha:x.fecha,valor:x.valor})),[
  {tdj:"111",fecha:"2026-04-01",valor:20000000}
]);

const incompleto=reconstruirTitulosTDJDesdeFilas([
  ["Nº","TDJ Nº","RECIBO Nº","FECHA PAGO / CORTE","VALOR PAGO","TIPO"],
  [1,"","4911089297230","2026-03-05",4137000,"TASA DIAN"]
]);
assert.deepEqual(incompleto,[]);

console.log("PASS: importador TDJ reconstruido — 2 títulos, 1 título y registro incompleto");
