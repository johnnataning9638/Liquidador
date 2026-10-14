import assert from 'node:assert/strict';
import { MotorLiquidacion } from '../js/motor-liquidacion.js?v=16.33.127';

const makeMotor = () => new MotorLiquidacion({
  uvt: [{ anio: 2026, valor: 52374, sancionMinima: 524000 }],
  intereses: [], ipc: [], tasasMoratorias: [], beneficios: [], sanciones: [],
  reglasObligaciones: [{ concepto: 'RENTA', familia: 'RENTA', vencimientos: 'NO_AUTOGENERAR' }]
});

const base = (sancion, pagos) => ({
  concepto: 'RENTA', anio: 2026, tipoLiquidacion: 'PRIVADA', tieneSancion: 'SI', valorSancion: sancion,
  fechaSancion: '2026-01-01', vencimientos: [{ id: 'VTO-1', numero: 1, fecha: '2026-01-01', impuesto: 1000000 }], pagos
});

// 1) Saldo pendiente real por debajo de la mínima: NO 15 %, NO reconstrucción de mínima.
{
  const r = makeMotor().calcular(base(284000, [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: '469030003386678' }]));
  assert.equal(r.sancion, 284000);
}

// 2) Saldo exactamente en la mínima: NO se aplica beneficio y permanece en la mínima.
{
  const r = makeMotor().calcular(base(524000, [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: 'T-MIN' }]));
  assert.equal(r.sancion, 524000);
}

// 3) Saldo superior a la mínima: 15 % del saldo actualizado, no 85 %.
{
  const r = makeMotor().calcular(base(5000000, [{ fecha: '2026-07-22', valor: 1000, tipo: 'ART. 9 DECRETO 1419', esTDJ: true, tdj: 'T-15' }]));
  assert.equal(r.sancion, 750000);
}

// 4) Múltiples pagos/títulos: el segundo pago NO recrea la mínima.
{
  const r = makeMotor().calcular(base(5000000, [
    { fecha: '2026-07-22', valor: 600000, tipo: 'ART. 9 DECRETO 1419' },
    { fecha: '2026-08-01', valor: 100000, tipo: 'ART. 9 DECRETO 1419' }
  ]));
  assert.ok(r.sancion < 524000, `El segundo pago no debe reconstruir la mínima; saldo=${r.sancion}`);
}

console.log('ART. 9 D1419 regression tests: OK');
