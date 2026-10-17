import assert from 'node:assert/strict';
import { ajustarTDJParaPagosPosteriores, reiniciarSecuenciaTDJ } from '../js/prioridad-tdj-v132.js';

function motorStub(totalInicial) {
  return {
    calcular(datos) {
      const tdjs = (datos.pagos || []).filter(p => String(p.tdj || '').trim());
      const normales = (datos.pagos || []).filter(p => !String(p.tdj || '').trim());
      const sumaTDJ = tdjs.reduce((s, p) => s + Math.max(0, Number(p.valor || 0)), 0);
      const sumaNormales = normales.reduce((s, p) => s + Math.max(0, Number(p.valor || 0)), 0);
      const total = Math.max(0, totalInicial - sumaTDJ - sumaNormales);
      return { total, detalle: normales.map(p => ({ pago: p, excedente: 0, aplicado: { total: Number(p.valor || 0) } })) };
    }
  };
}

const obligacion1 = { anio: 2025, concepto: 'VENTAS', periodo: '3', vencimientos: [{ fecha: '2026-01-14', impuesto: 10000000 }] };
const obligacion2 = { ...obligacion1, numero: 2, periodo: '4' };

// Escenario crítico: O1 se cierra; C2 debe salir de O1 y poder entrar a O2;
// un título posterior nunca puede regresar a O1.
reiniciarSecuenciaTDJ();
const c1 = { id: 'T152-1', tdj: 'TDJ-1', fecha: '2026-07-24', valor: 10000000 };
const c2 = { id: 'T152-2', tdj: 'TDJ-2', fecha: '2026-07-24', valor: 3000000 };
const c3 = { id: 'T152-3', tdj: 'TDJ-3', fecha: '2026-07-25', valor: 5000000 };

const r1 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion1, pagos: [c1] }, { soloTDJId: c1.id });
assert.equal(r1.pagos.find(p => p.id === c1.id).valor, 10000000);

const r2o1 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion1, pagos: [c1, c2] }, { soloTDJId: c2.id });
assert.equal(r2o1.pagos.find(p => p.id === c2.id).valor, 0, 'C2 debe quedar en cero solo para O1');

const r2o2 = ajustarTDJParaPagosPosteriores(motorStub(20000000), { ...obligacion2, pagos: [c2] }, { soloTDJId: c2.id });
assert.equal(r2o2.pagos.find(p => p.id === c2.id).valor, 3000000, 'C2 debe continuar a O2');

const r3o1 = ajustarTDJParaPagosPosteriores(motorStub(10000000), { ...obligacion1, pagos: [c1, c2, c3] }, { soloTDJId: c3.id });
assert.equal(r3o1.pagos.find(p => p.id === c3.id).valor, 0, 'C3 no puede regresar a O1 una vez cerrada');

console.log('REGRESION TDJ 16.33.152: OK — cierre definitivo de O1 y continuidad hacia O2 sin retroceso.');
