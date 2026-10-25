// Control obligatorio: saldo inicial menos pago y proporción de cuatro cuotas.
import assert from "node:assert/strict";
import { MotorLiquidacion } from "../js/motor-liquidacion.js";

const tasas = [{ desde:"2026-01-01", hasta:"2026-12-31", metodologia:"INTERES_SIMPLE_DIARIO", tasas:{"TASA DIAN":0.365} }];
const motor = new MotorLiquidacion({
  tasasMoratorias:tasas, intereses:tasas,
  reglasObligaciones:[{concepto:"PRUEBA REGRESION",familia:"TEST",vencimientos:"MANUAL",periodicidad:"ANUAL"}],
  uvt:[]
});
const datos = {
  concepto:"PRUEBA REGRESION", anio:2026, tipoLiquidacion:"PRIVADA",
  tieneSancion:"SI", valorSancion:30000, fechaSancion:"2026-01-01",
  vencimientos:[1,2,3,4].map(i=>({id:`VTO-${i}`,numero:i,fecha:`2026-01-0${i}`,impuesto:100000})),
  pagos:[{id:"P-1",fecha:"2026-01-01",valor:10000,tipo:"TASA DIAN"}]
};
const resultado = motor.calcular(datos);
const esperado = 430000-10000;
console.log(JSON.stringify({esperado,obtenido:resultado.total,detalle:resultado.detalle?.[0]?.aplicado},null,2));
assert.equal(resultado.total,esperado,"Conservación monetaria: saldo inicial menos pagos debe coincidir con saldo final (sin intereses)");

assert.deepEqual([resultado.detalle[0].aplicado.impuesto,resultado.detalle[0].aplicado.sancion],[9000,1000]);
assert.deepEqual([resultado.impuesto,resultado.sancion],[391000,29000]);
