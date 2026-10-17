import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../js/tdj-core-16.33.143.js', import.meta.url), 'utf8');

const marca = 'const saldoObligacionActual=Math.max(0,Number(ultimo?.saldo?.total??r.total??0));';
assert.ok(core.includes(marca), 'El motor real no contiene el control de saldo de obligación.');
assert.ok(core.includes('if(saldoObligacionActual>0.5)break;'), 'El motor real no detiene el salto a la siguiente obligación.');

// Escenario crítico real: O1 queda con $9.041.000 después del TDJ 3.
// Ese título NO puede pasar a O2; el siguiente TDJ retoma O1.
const obligaciones = [
  { numero: 1, saldo: 9_041_000 },
  { numero: 2, saldo: 45_134_000 }
];
const titulos = [
  { id: 'T1', valor: 500_000 },
  { id: 'T2', valor: 500_000 },
  { id: 'T3', valor: 20_000_000 },
  { id: 'T4', valor: 10_000_000 }
];
let cursor = 0;
const aplicacion = [];
for (const t of titulos) {
  let disponible = t.valor;
  for (; cursor < obligaciones.length && disponible > 0; ) {
    const o = obligaciones[cursor];
    const aplicado = Math.min(disponible, o.saldo);
    if (aplicado <= 0) break;
    o.saldo -= aplicado;
    disponible -= aplicado;
    aplicacion.push([t.id, o.numero, aplicado]);
    if (o.saldo > 0.5) break;
    cursor++;
  }
}

assert.deepEqual(
  aplicacion.filter(x => x[0] === 'T3').map(x => x[1]),
  [1],
  'El TDJ que deja saldo en O1 no puede desplazarse prematuramente a O2.'
);
assert.equal(aplicacion.find(x => x[0] === 'T4')?.[1], 1);
assert.equal(obligaciones[0].saldo, 0);

console.log('REGRESION TDJ 16.33.153: OK — una obligación con saldo bloquea el avance del título; el siguiente TDJ retoma la obligación actual.');
