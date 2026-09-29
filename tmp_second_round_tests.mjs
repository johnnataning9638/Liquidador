import fs from "node:fs";
import { MotorLiquidacion } from "./js/motor-liquidacion.js";
import { MotorLiquidacionOficial } from "./js/motor-liquidacion-oficial.js";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const cfg = {
  uvt: readJson("datos/uvt.json"),
  intereses: readJson("datos/tasas-moratorias.json"),
  tasasMoratorias: readJson("datos/tasas-moratorias.json"),
  ipc: readJson("datos/ipc.json"),
  beneficios: readJson("datos/beneficios.json"),
  sanciones: readJson("datos/sanciones.json"),
  reglasObligaciones: readJson("datos/reglas-obligaciones.json")
};
const motor = new MotorLiquidacion(cfg);
const oficial = new MotorLiquidacionOficial(cfg);

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}
function eq(actual, expected, msg) {
  assert(actual === expected, msg + " | esperado=" + expected + " observado=" + actual);
}
function run(datos, m=motor) { return m.calcular(datos); }
function base({tipoLiquidacion="PRIVADA",fechaPago="2026-09-10",valor=1000,esTDJ=false,tdj=""}={}) {
  return {
    concepto:"VENTAS", anio:2025, periodo:3, tipoLiquidacion,
    tieneSancion:"SI", valorSancion:5000, fechaSancion:"2025-01-01",
    fechaCorte:fechaPago,
    vencimientos:[{id:"V1",fecha:"2025-01-01",impuesto:10000}],
    pagos:[{id:"P1",fecha:fechaPago,valor,tipo:"TASA DIAN",tdj,esTDJ}]
  };
}

// 1. Pago normal de $1.000: NO entra en la regla especial TDJ.
const normal = run(base({valor:1000,esTDJ:false,tdj:""}));
assert(normal.detalle?.[0]?.aplicado?.tipoProporcion !== "TDJ <= $1.000 — INTERESES", "el pago normal no usa la regla TDJ");

// 2. TDJ $1.000 con interés disponible: los $1.000 se imputan a intereses.
const tdj1000 = run(base({valor:1000,esTDJ:true,tdj:"TDJ-1000",fechaPago:"2026-09-10"}));
eq(tdj1000.detalle[0].aplicado.intereses, 1000, "TDJ $1.000 prioriza intereses");
eq(tdj1000.detalle[0].aplicado.impuesto, 0, "TDJ $1.000 no toca impuesto cuando hay interés");
eq(tdj1000.detalle[0].aplicado.sancion, 0, "TDJ $1.000 no toca sanción cuando hay interés");
eq(tdj1000.detalle[0].aplicado.total, 1000, "TDJ $1.000 cierra exactamente");

for (const valor of [1,157,999]) {
  const r = run(base({valor,esTDJ:true,tdj:"TDJ-"+valor,fechaPago:"2026-09-10"}));
  eq(r.detalle[0].aplicado.intereses, valor, "TDJ <= $1.000 se conserva íntegro en intereses: "+valor);
  eq(r.detalle[0].aplicado.total, valor, "TDJ <= $1.000 no aplica más de lo pagado: "+valor);
}

// 3. Sin interés exigible: TDJ $1.000 pasa a impuesto.
const sinInteres = run(base({valor:1000,esTDJ:true,tdj:"TDJ-SIN-INTERES",fechaPago:"2025-01-01"}));
console.log("DEBUG SIN INTERES", JSON.stringify(sinInteres.detalle?.[0]?.aplicado), JSON.stringify(sinInteres.detalle?.[0]?.deudaAntes), JSON.stringify(sinInteres.detalle?.[0]?.pago));
eq(sinInteres.detalle[0].aplicado.intereses, 0, "sin interés no se inventa interés");
eq(sinInteres.detalle[0].aplicado.impuesto, 1000, "sin interés, TDJ <= $1.000 pasa a impuesto");
eq(sinInteres.detalle[0].aplicado.total, 1000, "sin interés el TDJ se aplica por el valor exacto");

// 4. TDJ $1.001: vuelve a proporcionalidad ordinaria.
const tdj1001 = run(base({valor:1001,esTDJ:true,tdj:"TDJ-1001",fechaPago:"2026-09-10"}));
assert(!String(tdj1001.detalle[0].aplicado.tipoProporcion).startsWith("TDJ <= $1.000"), "TDJ $1.001 no usa regla especial");
eq(tdj1001.detalle[0].aplicado.total, 1001, "TDJ $1.001 nunca supera el pago");

// 5. Dos TDJ pequeños consecutivos: cada uno se trata como título independiente.
const dos = {
  ...base({valor:600,esTDJ:true,tdj:"TDJ-A",fechaPago:"2026-09-10"}),
  pagos:[
    {id:"P1",fecha:"2026-09-10",valor:600,tipo:"TASA DIAN",tdj:"TDJ-A",esTDJ:true},
    {id:"P2",fecha:"2026-09-11",valor:400,tipo:"TASA DIAN",tdj:"TDJ-B",esTDJ:true}
  ],
  fechaCorte:"2026-09-11"
};
const dosR=run(dos);
eq(dosR.detalle.length,2,"dos TDJ generan dos aplicaciones");
eq(dosR.detalle[0].aplicado.total,600,"primer TDJ exacto");
eq(dosR.detalle[1].aplicado.total,400,"segundo TDJ exacto");

// 6. Motor oficial: conserva la misma regla especial para TDJ.
const off = run(base({tipoLiquidacion:"OFICIAL",valor:1000,esTDJ:true,tdj:"TDJ-OFF",fechaPago:"2026-09-10"}), oficial);
eq(off.detalle[0].aplicado.intereses,1000,"oficial: TDJ $1.000 prioriza intereses");
eq(off.detalle[0].aplicado.total,1000,"oficial: cierre exacto");

// 7. Invariante: ningún TDJ <= $1.000 aplica más de lo pagado.
for (const valor of [1,157,999,1000]) {
  const r = run(base({valor,esTDJ:true,tdj:"T-"+valor,fechaPago:"2026-09-10"}));
  assert(r.detalle[0].aplicado.total <= valor, "TDJ no puede aplicar más que el valor: "+valor);
}

console.log("SECOND_ROUND_OK");
