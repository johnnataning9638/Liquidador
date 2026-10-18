import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../js/tdj-secuencia-guard-16.33.175.js',import.meta.url),'utf8');
const importer=fs.readFileSync(new URL('../js/importador-excel.js',import.meta.url),'utf8');
const tdj=fs.readFileSync(new URL('../js/tdj.js',import.meta.url),'utf8');

// Contrato DIAN observado en el PDF correcto:
// si al ejecutar el motor con el TDJ actual = 0 la obligación queda saldada,
// ese título no se consume en la obligación corriente.
assert.match(guard,/const sinActual=/);
assert.match(guard,/valor:0/);
assert.match(guard,/const saldo=num\(r\?\.total\)/);
assert.match(guard,/saldo<=0\.5/);
assert.match(guard,/const corregidos=/);

// Protección contra la regresión que dejó DIAN en "CARGANDO PARÁMETROS":
// importador-excel no puede contener top-level await ni una importación estática
// del parche de recuperación.
assert.doesNotMatch(importer,/await\s+import\(/);
assert.doesNotMatch(importer,/^\s*import\s+["']\.\/export-dian-guard-/m);
assert.match(importer,/import\(\"\.\/export-tdj-recovery-16\.33\.174\.js\?v=16\.33\.174\"\)/);

// La guardia debe cargarse desde TDJ sin modificar el core protegido.
assert.match(tdj,/tdj-secuencia-guard-16\.33\.175\.js\?v=16\.33\.175/);
assert.match(tdj,/tdj-core-16\.33\.143\.js/);

console.log('REGRESION TDJ 16.33.175 / CARGA DIAN: OK');
