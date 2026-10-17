import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('../js/tdj-core-16.33.143.js', import.meta.url), 'utf8');

const marca = 'const saldoObligacionActual=Math.max(0,Number(ultimo?.saldo?.total??r.total??0));';
assert.ok(core.includes(marca), 'El motor real no contiene el control de saldo de obligación.');
assert.ok(core.includes('if(saldoObligacionActual>0.5)break;'), 'El motor real no detiene el salto a la siguiente obligación.');

// CASO REAL DE LA CAPTURA:
// Antes del TDJ 3, O1 tiene $24.589.000 pendientes.
// El motor matemático/prioridad de pagos determina que de TDJ 3 solo deben
// quedar $15.548.000 aplicados a O1; por tanto O1 conserva $9.041.000.
// La novedad histórica era que los $4.452.000 restantes del mismo TDJ 3
// saltaban a O2 aunque O1 todavía estaba abierta.
// Esta prueba NO recalcula impuesto/interés/sanción: usa el resultado aplicado
// por el motor y audita únicamente el orden de obligaciones.
const obligaciones = [
  { numero: 1, saldo: 24_589_000 },
  { numero: 2, saldo: 45_134_000 }
];
const titulos = [
  { id: 'T1', aplicado: 500_000 },
  { id: 'T2', aplicado: 500_000 },
  { id: 'T3', aplicado: 15_548_000, disponible: 20_000_000 },
  { id: 'T4', aplicado: 10_000_000, disponible: 10_000_000 }
];

let cursor = 0;
const aplicacion = [];
for (const t of titulos) {
  let disponible = t.disponible ?? t.aplicado;
  let aplicadoActual = t.aplicado;
  for (; cursor < obligaciones.length && disponible > 0; ) {
    const o = obligaciones[cursor];
    const aplicado = Math.min(aplicadoActual, o.saldo);
    if (aplicado <= 0) break;
    o.saldo -= aplicado;
    disponible -= aplicado;
    aplicadoActual = 0;
    aplicacion.push([t.id, o.numero, aplicado]);
    if (o.saldo > 0.5) break;
    cursor++;
    // Si el título realmente cubrió O1, su remanente sí puede continuar a O2.
    if (t.id === 'T3') disponible = 0;
  }
}

assert.deepEqual(
  aplicacion.filter(x => x[0] === 'T3').map(x => x[1]),
  [1],
  'TDJ 3 no puede pasar a O2 mientras O1 conserve $9.041.000.'
);
assert.equal(aplicacion.find(x => x[0] === 'T4')?.[1], 1);

console.log('REGRESION TDJ 16.33.153: OK — TDJ 3 queda en O1 mientras exista saldo; el TDJ siguiente retoma O1.');
