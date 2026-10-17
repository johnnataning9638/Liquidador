import assert from 'node:assert/strict';
import {
  ajustarTDJParaPagosPosteriores,
  reiniciarSecuenciaTDJ
} from '../js/prioridad-tdj.js';

function motorStub(totalInicial, pagoPosteriorValor = 0) {
  return {
    calcular(datos) {
      const titulos = (datos.pagos || []).filter(p => String(p.tdj || '').trim());
      const normales = (datos.pagos || []).filter(p => !String(p.tdj || '').trim());
      const sumaTitulos = titulos.reduce((s, p) => s + Math.max(0, Number(p.valor || 0)), 0);
      const deuda = Math.max(0, totalInicial - sumaTitulos);
      const pago = normales[0];
      const pagoAplicado = pago ? Math.min(deuda, Math.max(0, Number(pago.valor || 0))) : 0;
      const excedentePago = pago ? Math.max(0, Number(pago.valor || 0) - pagoAplicado) : 0;
      const total = Math.max(0, deuda - pagoAplicado);
      return {
        total,
        detalle: pago ? [{ pago, excedente: excedentePago, aplicado: { total: pagoAplicado } }] : [],
        ultimo: {
          aplicado: { total: titulos.length ? Math.min(totalInicial, sumaTitulos) : pagoAplicado },
          saldo: { total }
        }
      };
    }
  };
}

const obligacion = {
  anio: 2025,
  concepto: 'VENTAS',
  periodo: '3',
  vencimientos: [{ fecha: '2026-01-14', impuesto: 9041000 }]
};

// 1. Regla crítica: si el título actual de 10.000.000 tiene un pago posterior
// de 8.193.000, no puede cerrar la obligación. Debe reservar 8.193.000 para el
// pago posterior; por tanto, como máximo puede aplicar 848.000.
reiniciarSecuenciaTDJ();
const tPosterior = {
  id: 'T-PAGO-1', tdj: 'TDJ-POST', fecha: '2026-07-24', valor: 10000000
};
const pPosterior = {
  id: 'P-POST-1', fecha: '2026-10-01', valor: 8193000, tipo: 'TASA DIAN'
};
const rPosterior = ajustarTDJParaPagosPosteriores(
  motorStub(9041000),
  { ...obligacion, pagos: [tPosterior, pPosterior] },
  { soloTDJId: tPosterior.id }
);
assert.equal(rPosterior.pagos.find(p => p.id === tPosterior.id).valor, 848000);

// 2. Regla crítica de misma fecha: una obligación que ya quedó cerrada por un
// título anterior no puede volver a recibir el siguiente título. El siguiente
// título debe conservar su valor para que la capa superior lo lleve a la
// siguiente obligación.
reiniciarSecuenciaTDJ();
const t1 = { id: 'T-SAME-1', tdj: 'TDJ-1', fecha: '2026-07-24', valor: 10000000 };
const t2 = { id: 'T-SAME-2', tdj: 'TDJ-2', fecha: '2026-07-24', valor: 3000000 };
const r1 = ajustarTDJParaPagosPosteriores(
  motorStub(10000000),
  { ...obligacion, pagos: [t1] },
  { soloTDJId: t1.id }
);
assert.equal(r1.pagos.find(p => p.id === t1.id).valor, 10000000);
const r2 = ajustarTDJParaPagosPosteriores(
  motorStub(10000000),
  { ...obligacion, pagos: [t2] },
  { soloTDJId: t2.id }
);
assert.equal(r2.pagos.find(p => p.id === t2.id).valor, 0);

// 3. Si el primer título no cubre la obligación, el segundo título de la misma
// fecha NO se anula: debe continuar atendiendo la necesidad pendiente.
reiniciarSecuenciaTDJ();
const ta = { id: 'T-PARC-1', tdj: 'TDJ-A', fecha: '2026-07-24', valor: 4000000 };
const tb = { id: 'T-PARC-2', tdj: 'TDJ-B', fecha: '2026-07-24', valor: 3000000 };
const ra = ajustarTDJParaPagosPosteriores(
  motorStub(10000000),
  { ...obligacion, pagos: [ta] },
  { soloTDJId: ta.id }
);
assert.equal(ra.pagos.find(p => p.id === ta.id).valor, 4000000);
const rb = ajustarTDJParaPagosPosteriores(
  motorStub(10000000),
  { ...obligacion, pagos: [tb] },
  { soloTDJId: tb.id }
);
assert.equal(rb.pagos.find(p => p.id === tb.id).valor, 3000000);

console.log('REGRESION TDJ 16.33.149: OK');
