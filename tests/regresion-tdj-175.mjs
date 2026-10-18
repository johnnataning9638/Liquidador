import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../js/tdj-secuencia-guard-16.33.175.js',import.meta.url),'utf8');
const importer=fs.readFileSync(new URL('../js/importador-excel.js',import.meta.url),'utf8');
const tdj=fs.readFileSync(new URL('../js/tdj.js',import.meta.url),'utf8');

// Contrato histórico de la guardia 175: el parche original debía poder
// simular el motor sin consumir el TDJ actual.
assert.match(guard,/const sinActual=/);
assert.match(guard,/valor:0/);
assert.match(guard,/const saldo=num\(r\?\.total\)/);
assert.match(guard,/saldo<=0\.5/);
assert.match(guard,/const corregidos=/);

// Protección contra la regresión que dejó DIAN en "CARGANDO PARÁMETROS":
// importador-excel no puede contener top-level await ni overlays de exportación.
assert.doesNotMatch(importer,/await\s+import\(/);
assert.doesNotMatch(importer,/export-tdj-recovery-16\.33\.174/);
assert.doesNotMatch(importer,/export-dian-guard/);

// La guardia vigente fue evolucionada a 177 y se carga estáticamente.
assert.match(tdj,/import\s+"\.\/tdj-secuencia-guard-16\.33\.177\.js\?v=16\.33\.177"/);
assert.doesNotMatch(tdj,/import\("\.\/tdj-secuencia-guard-16\.33\.175\.js/);
assert.match(tdj,/tdj-core-16\.33\.143\.js/);

console.log('REGRESION TDJ 16.33.175 / CARGA DIAN: OK — compatibilidad con guardia 177');
