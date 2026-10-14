import assert from 'node:assert/strict';
import { MotorLiquidacion } from './motor-liquidacion.js?v=16.33.127';

const makeMotor = (ipc = []) => new MotorLiquidacion({
  uvt: [{ anio: 2026, valor: 52374, sancionMinima: 524000 }, { anio: 2024, valor: 47065, sancionMinima: 470000 }],
  intereses: [], ipc, tasasMoratorias: [], beneficios: [], sanciones: [],
  reglasObligaciones: [{ concepto: 'RENTA', familia: 'RENTA', vencimientos: 'NO_AUTOGENERAR' }]
});

const base = (sancion, fechaSancion, pagos) => ({
  concepto: 'RENTA', anio: 2026, tipoLiquidacion: 'PRIVADA', tieneSancion: 'SI', valorSancion: sancion,
  fechaSancion, vencimientos: [{ id: 'VTO-1', numero: 1, fecha: '2026-01-01', impuesto: 1000000 }], pagos
});

{
  const r = makeMotor().calcular(base(284000, '2026-01-01', [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: '469030003386678' }]));
  assert.equal(r.sancion, 284000);
}
{
  const r = makeMotor([{ anio: 2025, inflacion: 0.20 }]).calcular(base(400000, '2024-01-01', [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: 'T2' }]));
  assert.equal(r.sancion, 489000);
}
{
  const r = makeMotor([{ anio: 2025, inflacion: 0.20 }]).calcular(base(5000000, '2024-01-01', [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: 'T3' }]));
  assert.equal(r.sancion, 916000);
}
{
  const r = makeMotor().calcular(base(5000000, '2026-01-01', [
    { fecha: '2026-07-22', valor: 600000, tipo: 'ART. 9 DECRETO 1419' },
    { fecha: '2026-08-01', valor: 100000, tipo: 'ART. 9 DECRETO 1419' }
  ]));
  assert.ok(r.sancion < 524000);
}
console.log('ART. 9 D1419 regression tests: OK');
