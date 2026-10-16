import assert from "node:assert/strict";
import {saldoFinalSinIntereses} from "../js/prioridad-tdj-v132.js";

assert.equal(saldoFinalSinIntereses(500000,50000),550000);
assert.equal(saldoFinalSinIntereses(500000,0),500000);
assert.equal(saldoFinalSinIntereses(0,50000),50000);
assert.equal(saldoFinalSinIntereses(500000,100000),600000);
assert.equal(saldoFinalSinIntereses(-10,0),0);
assert.equal(saldoFinalSinIntereses(500000,NaN),500000);

// El interés queda deliberadamente fuera: 500.000 impuesto + 50.000 sanción,
// aunque el escenario pudiera tener 100.000 de intereses calculados.
const impuestoPendiente=500000;
const interesesPendientes=100000;
const sancionPendiente=50000;
assert.equal(saldoFinalSinIntereses(impuestoPendiente,sancionPendiente),550000);
assert.notEqual(saldoFinalSinIntereses(impuestoPendiente,sancionPendiente),impuestoPendiente+interesesPendientes+sancionPendiente);

console.log("OK: SALDO TOTAL FINAL RIAN = IMPUESTO + SANCIÓN; INTERESES EXCLUIDOS.");
