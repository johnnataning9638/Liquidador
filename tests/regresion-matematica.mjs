import assert from "node:assert/strict";
import { MotorLiquidacion } from "../js/motor-liquidacion.js";
import { importarDatosInteligente } from "../js/importador.js";

const rates = [
  { desde: "2026-01-01", hasta: "2026-12-31", metodologia: "INTERES_SIMPLE_DIARIO", tasas: { "TASA DIAN": 0.365 } }
];

const rule = {
  concepto: "PRUEBA REGRESION",
  familia: "TEST",
  vencimientos: "MANUAL",
  periodicidad: "ANUAL"
};

function motor() {
  return new MotorLiquidacion({
    tasasMoratorias: rates,
    intereses: rates,
    reglasObligaciones: [rule],
    uvt: []
  });
}

function obligation({ count = 1, paymentDate = "2026-01-01", paymentValue = 1000000, tdj = false, sanction = 30000 } = {}) {
  const vencimientos = Array.from({ length: count }, (_, i) => ({
    id: `VTO-${i + 1}`,
    numero: i + 1,
    fecha: `2026-01-${String(i + 1).padStart(2, "0")}`,
    impuesto: 100000
  }));
  return {
    concepto: "PRUEBA REGRESION",
    anio: 2026,
    tipoLiquidacion: "PRIVADA",
    tieneSancion: "SI",
    valorSancion: sanction,
    fechaSancion: "2026-01-01",
    vencimientos,
    pagos: [{
      id: "P-1",
      fecha: paymentDate,
      valor: paymentValue,
      tipo: "TASA DIAN",
      ...(tdj ? { tdj: "TDJ-PRUEBA", esTDJ: true } : {})
    }]
  };
}

let passed = 0;
function ok(name, condition) {
  assert.equal(Boolean(condition), true, name);
  passed++;
  console.log("PASS:", name);
}

// TRADICIONAL 1–3 cuotas: el único corte de sanción es fecha de sanción.
// Un pago anterior a la fecha de sanción NO recibe sanción, aunque ya haya vencido.
for (const count of [1, 2, 3]) {
  const r = motor().calcular(obligation({ count, paymentDate: "2025-12-31", paymentValue: 100000 }));
  ok(`${count} cuota(s): pago anterior a fecha de sanción sin sanción`, r.detalle[0].aplicado.sancion === 0);
}

// TRADICIONAL 1–3 cuotas: pago posterior a la fecha de sanción sí puede imputar sanción.
for (const count of [1, 2, 3]) {
  const r = motor().calcular(obligation({ count, paymentDate: "2026-01-02", paymentValue: 100000 }));
  ok(`${count} cuota(s): pago posterior a fecha de sanción puede imputar sanción`, r.detalle[0].aplicado.sancion > 0);
}

// TRADICIONAL: el vencimiento NO puede habilitar sanción por sí solo.
for (const count of [1, 2, 3]) {
  const r = motor().calcular(obligation({ count, paymentDate: "2025-12-31", paymentValue: 100000 }));
  ok(`${count} cuota(s): pago posterior al vencimiento pero anterior a sanción sigue sin sanción`, r.detalle[0].aplicado.sancion === 0);
}

// SIMPLE 4–6 cuotas: se conserva la participación de sanción aun en el primer anticipo.
for (const count of [4, 5, 6]) {
  const r = motor().calcular(obligation({ count, paymentDate: "2026-01-02", paymentValue: 100000 }));
  ok(`SIMPLE ${count} cuotas: sanción permanece habilitada después del vencimiento`, r.detalle[0].aplicado.sancion > 0);
}

// SIMPLE 4–6 cuotas: pago ANTES DEL PRIMER VENCIMIENTO y antes de la fecha de sanción.
// Esta es la regresión que reproduce el caso que estaba fallando: el vencimiento
// no puede ser un requisito para imputar la sanción en anticipos SIMPLE.
for (const count of [4, 5, 6]) {
  const r = motor().calcular({
    ...obligation({ count, paymentDate: "2025-12-31", paymentValue: 100000 }),
    fechaSancion: "2026-01-03"
  });
  ok(`SIMPLE ${count} cuotas: sanción también se aplica antes del primer vencimiento`, r.detalle[0].aplicado.sancion > 0);
}

// Caso integral: 6 anticipos pagados antes de la fecha de sanción.
// La sanción declarada ($2.294.000) debe quedar distribuida en los anticipos
// y nunca trasladarse artificialmente a un pago posterior.
const simple6Pagos = motor().calcular({
  concepto: "PRUEBA REGRESION",
  anio: 2026,
  tipoLiquidacion: "PRIVADA",
  tieneSancion: "SI",
  valorSancion: 2294000,
  fechaSancion: "2026-04-03",
  vencimientos: Array.from({ length: 6 }, (_, i) => ({
    id: `S-${i + 1}`,
    numero: i + 1,
    fecha: `2026-0${i < 3 ? 1 : 2}-${String((i % 3) + 1).padStart(2, "0")}`,
    impuesto: 600000
  })),
  pagos: Array.from({ length: 6 }, (_, i) => ({
    id: `P-${i + 1}`,
    fecha: `2026-0${i < 3 ? 1 : 2}-${String((i % 3) + 1).padStart(2, "0")}`,
    valor: 500000,
    tipo: "TASA DIAN"
  }))
});
const sancionSimple6Aplicada=simple6Pagos.detalle.reduce((a,d)=>a+Number(d?.aplicado?.sancion||0),0);
ok("SIMPLE 6 anticipos: la sanción total de $2.294.000 se imputa en los pagos anteriores", sancionSimple6Aplicada === 2294000);
ok("SIMPLE 6 anticipos: todos los pagos participan en la distribución de sanción", simple6Pagos.detalle.every(d=>Number(d?.aplicado?.sancion||0)>0));

// SIMPLE 4–6 cuotas: los anticipos conservan la metodología SIMPLE y no
// quedan bloqueados por la fecha de sanción/presentación usada para TRADICIONAL.
for (const count of [4, 5, 6]) {
  const r = motor().calcular({
    ...obligation({ count, paymentDate: "2026-01-02", paymentValue: 100000 }),
    fechaSancion: "2026-01-03"
  });
  ok(`SIMPLE ${count} cuotas: conserva sanción antes de fecha de sanción`, r.detalle[0].aplicado.sancion > 0);
}

// Proporcionalidad: el pago de $1.001 nunca puede convertirse en $2.000 por redondeo.
for (const deuda of [
  { impuesto: 100000, intereses: 200, sancion: 30000 },
  { impuesto: 100000, intereses: 5000, sancion: 30000 },
  { impuesto: 100000, intereses: 10000, sancion: 50000 }
]) {
  const r = motor().aplicarProporcionalidad(1001, deuda);
  ok("Pago $1.001: total aplicado no supera el pago", r.total <= 1001);
  ok("Pago $1.001: componentes suman exactamente el aplicado", r.impuesto + r.intereses + r.sancion === r.total);
}

// TDJ <= $1.000: prioridad absoluta a intereses, sin redondearlo artificialmente a $1.000.
const tdj157 = motor().calcular(obligation({
  count: 1,
  paymentDate: "2026-01-06",
  paymentValue: 157,
  tdj: true,
  sanction: 30000
}));
ok("TDJ $157: se aplica $157 a intereses", tdj157.detalle[0].aplicado.intereses === 157);
ok("TDJ $157: no se transforma en $1.000", tdj157.detalle[0].aplicado.total === 157);

// TDJ $1.000: también conserva el valor exacto cuando hay interés suficiente.
const tdj1000 = motor().calcular(obligation({
  count: 1,
  paymentDate: "2026-01-06",
  paymentValue: 1000,
  tdj: true,
  sanction: 30000
}));
ok("TDJ $1.000: aplica exactamente $1.000", tdj1000.detalle[0].aplicado.total === 1000);
ok("TDJ $1.000: prioridad a intereses", tdj1000.detalle[0].aplicado.intereses === 1000);

// Fechas: vencimientos se procesan cronológicamente aunque entren desordenados.
const desordenada = motor().calcular({
  ...obligation({ count: 3, paymentDate: "2026-01-04", paymentValue: 100000 }),
  vencimientos: [
    { id: "VTO-3", numero: 3, fecha: "2026-01-03", impuesto: 100000 },
    { id: "VTO-1", numero: 1, fecha: "2026-01-01", impuesto: 100000 },
    { id: "VTO-2", numero: 2, fecha: "2026-01-02", impuesto: 100000 }
  ]
});
ok("Vencimientos: procesamiento cronológico", desordenada.vencimientos.map(v => v.fecha).join(",") === "2026-01-01,2026-01-02,2026-01-03");

// Importador: reconoce fechas abreviadas y valores COP sin perder el valor.
const imp = importarDatosInteligente(`NIT: 900123456
RAZON SOCIAL: PRUEBA S.A.S.
AÑO GRAVABLE: 2026
CONCEPTO: PRUEBA REGRESION
FECHA VENCIMIENTO 1: 01 01 26
IMPUESTO 1: 100000
DOCUMENTO | FECHA PAGO | VALOR PAGADO
123456789 | 03/01/2026 | 1.001`);
ok("Importador: reconoce vencimiento con año abreviado", imp.vencimientos.some(v => v.fecha === "2026-01-01"));
ok("Importador: reconoce valor $1.001", imp.pagos.some(p => Number(p.valor) === 1001));

console.log(`REGRESION MATEMATICA OK — ${passed} ASERCIONES`);
