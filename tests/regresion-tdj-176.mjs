import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../js/tdj-secuencia-guard-16.33.176.js',import.meta.url),'utf8');
const tdj=fs.readFileSync(new URL('../js/tdj.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../js/tdj-core-16.33.143.js',import.meta.url),'utf8');

// El guard debe simular el mismo motor con el TDJ actual en cero y, cuando
// los pagos posteriores ya cubren la obligación, volver a ejecutar el motor
// sin consumir ese TDJ.
assert.match(guard,/const sinActual=/);
assert.match(guard,/valor:0/);
assert.match(guard,/normalesCompletamenteAplicados/);
assert.match(guard,/saldo<=1000/);
assert.match(guard,/const corregidos=/);
assert.match(guard,/valor:0/);

// La secuencia debe cargarse estáticamente para que la primera liquidación no
// pueda ejecutarse antes de instalar el guard.
assert.match(tdj,/import\s+"\.\/tdj-tasa-bridge-16\.33\.174\.js\?v=16\.33\.174"/);
assert.match(tdj,/import\s+"\.\/tdj-secuencia-guard-16\.33\.176\.js\?v=16\.33\.176"/);
assert.doesNotMatch(tdj,/import\("\.\/tdj-secuencia-guard-16\.33\.175\.js/);
assert.match(tdj,/tdj-core-16\.33\.143\.js/);

// Protección: los motores históricos continúan siendo la fuente de cálculo.
assert.match(tdj,/tdj-core-16\.33\.143\.js\?v=16\.33\.176/);
assert.ok(core.length>200000,'El core protegido debe permanecer presente y no sustituirse por una versión reducida.');

console.log('REGRESION TDJ 16.33.176 / SECUENCIA + CARGA ESTÁTICA: OK');
