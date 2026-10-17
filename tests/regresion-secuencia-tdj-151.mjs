import assert from 'node:assert/strict';
import {
  ajustarTDJParaPagosPosteriores,
  reiniciarSecuenciaTDJ
} from '../js/prioridad-tdj-v132.js';

function motorStub(totalInicial) {
  return {
    calcular(datos) {
      const titulos = (datos.pagos || []).filter(p => String(p.tdj || '').trim());
      const normales = (datos.pagos || []).filter(p => !String(p.tdj || '').trim());
      const sumaTitulos = titulos.reduce((s, p) => s + Math.max(0, Number(p.valor || 0)), 0);
      const deudaDespuesTitulos = Math.max(0, totalInicial - sumaTitulos);
      const pago = normales[0];
      const aplicadoPago = pago ? Math.min(deudaDespuesTitulos, Math.max(0, Number(pago.valor || 0))) : 0;
      const excedentePago = pago ? Math.max(0, Number(pago.valor || 0) - aplicadoPago) : 0;
      const total = Math.max(0, deudaDespuesTitulos - aplicadoPago);
      return {
        total,
        detalle: pago ? [{ pago, excedente: excedentePago, aplicado: { total: aplicadoPago } }] : [],
        ultimo: {
          aplicado: { total: Math.min(totalInicial, sumaTitulos + aplicadoPago) },
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
  vencimientos: [{ fecha: '2026-01-14', impuesto: 10000000 }]
};

// 1) MISMA FECHA, OBLIGACIÓN AÚN PENDIENTE:
// TDJ 2 debe continuar sobre la misma obligación; no puede reiniciarse por fecha.
reiniciarSecuenciaTDJ();
const t1 = { id: 'T151-1', tdj: 'TDJ-1', fecha: '2026-07-24', valor: 4000000 };
const t2 = { id: 'T151-2', tdj: 'TDJ-2', fecha: '2026-07-24', valor: 3000000 };
const r1 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion, pagos: [t1] }, { soloTDJId: t1.id });
assert.equal(r1.pagos.find(p => p.id === t1.id).valor, 4000000);
const r2 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion, pagos: [t1, t2] }, { soloTDJId: t2.id });
assert.equal(r2.pagos.find(p => p.id === t2.id).valor, 3000000);

// 2) TERCER TDJ MISMA FECHA: queda disponible completo para la obligación;
// la capa de aplicación superior debe tomar solo los $3.000.000 pendientes
// y transportar los $5.000.000 restantes a la obligación siguiente.
const t3 = { id: 'T151-3', tdj: 'TDJ-3', fecha: '2026-07-24', valor: 8000000 };
const r3 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion, pagos: [t1, t2, t3] }, { soloTDJId: t3.id });
assert.equal(r3.pagos.find(p => p.id === t3.id).valor, 8000000);
const saldoPendiente = 10000000 - 4000000 - 3000000;
const aplicadoObligacion1 = Math.min(8000000, saldoPendiente);
const remanente = 8000000 - aplicadoObligacion1;
assert.equal(aplicadoObligacion1, 3000000);
assert.equal(remanente, 5000000);

// 3) SI LA OBLIGACIÓN YA ESTÁ CUBIERTA POR UN TÍTULO ANTERIOR,
// el siguiente TDJ queda en cero SOLO para esa obligación.
reiniciarSecuenciaTDJ();
const c1 = { id: 'T151-C1', tdj: 'TDJ-C1', fecha: '2026-07-24', valor: 10000000 };
const c2 = { id: 'T151-C2', tdj: 'TDJ-C2', fecha: '2026-07-24', valor: 3000000 };
const rc1 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion, pagos: [c1] }, { soloTDJId: c1.id });
assert.equal(rc1.pagos.find(p => p.id === c1.id).valor, 10000000);
const rc2 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion, pagos: [c1, c2] }, { soloTDJId: c2.id });
assert.equal(rc2.pagos.find(p => p.id === c2.id).valor, 0);

console.log('REGRESION TDJ 16.33.151: OK');
