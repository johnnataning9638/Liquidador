import assert from "node:assert/strict";
import {MotorLiquidacion} from "./js/motor-liquidacion.js";
import {ActualizadorSancion} from "./js/actualizacion-sancion.js";
import uvt from "./datos/uvt.json" with {type:"json"};
import tasas from "./datos/tasas-moratorias.json" with {type:"json"};
import ipc from "./datos/ipc.json" with {type:"json"};
import beneficios from "./datos/beneficios.json" with {type:"json"};
import sanciones from "./datos/sanciones.json" with {type:"json"};
import reglas from "./datos/reglas-obligaciones.json" with {type:"json"};

const motor=new MotorLiquidacion({uvt,tasasMoratorias:tasas,ipc,beneficios,sanciones,reglasObligaciones:reglas});
const money=n=>Number(n||0);

function run(name,fn){
  try{const r=fn(); console.log("PASS",name,JSON.stringify(r)); return r;}
  catch(e){console.error("FAIL",name,e.stack||e); process.exitCode=1;}
}

// 1-4: casos reales de los documentos, usando el mismo motor actual.
run("REAL-901809099-VENTAS-2025-3",()=>{
  const r=motor.calcular({
    concepto:"VENTAS",anio:2025,periodo:3,tieneSancion:"NO",fechaCorte:"2026-05-21",
    vencimientos:[{id:"V1",numero:1,fecha:"2026-01-23",impuesto:12879000,periodo:3}],
    pagos:[{fecha:"2026-05-21",valor:800000,tipo:"TASA DIAN",recibo:"R1"}]
  });
  assert.equal(r.detalle.at(-1).interesGenerado,1090000);
  assert.equal(r.detalle.at(-1).aplicado.impuesto,737000);
  assert.equal(r.detalle.at(-1).aplicado.intereses,63000);
  assert.equal(r.detalle.at(-1).aplicado.total,800000);
  return {interes:r.detalle.at(-1).interesGenerado,aplicado:r.detalle.at(-1).aplicado};
});

run("REAL-901809099-VENTAS-2026-1",()=>{
  const r=motor.calcular({
    concepto:"VENTAS",anio:2026,periodo:1,tieneSancion:"NO",fechaCorte:"2026-07-24",
    vencimientos:[{id:"V1",numero:1,fecha:"2026-05-25",impuesto:3883000,periodo:1}],
    pagos:[{fecha:"2026-07-24",valor:3883700,tipo:"TASA DIAN",recibo:"R2"}]
  });
  assert.equal(r.detalle.at(-1).interesGenerado,171000);
  assert.equal(r.detalle.at(-1).aplicado.impuesto,3719700);
  assert.equal(r.detalle.at(-1).aplicado.intereses,164000);
  assert.equal(r.detalle.at(-1).aplicado.total,3883700);
  assert.equal(r.detalle.at(-1).saldo.impuesto,163300);
  return {interes:r.detalle.at(-1).interesGenerado,aplicado:r.detalle.at(-1).aplicado,saldo:r.detalle.at(-1).saldo};
});

run("REAL-901518746-EXCEDENTE-TDJ",()=>{
  const r=motor.aplicarProporcionalidad(56151000,{impuesto:38865000,intereses:5049000,sancion:0});
  assert.deepEqual(r,{impuesto:38865000,intereses:5049000,sancion:0,total:43914000,excedente:12237000,porcentaje:100,tipoProporcion:"Impuesto mayor"});
  return r;
});

run("REAL-901518746-ENDOSO-213000",()=>{
  const r=motor.aplicarProporcionalidad(12237000,{impuesto:11778000,intereses:246000,sancion:0});
  assert.deepEqual(r,{impuesto:11778000,intereses:246000,sancion:0,total:12024000,excedente:213000,porcentaje:100,tipoProporcion:"Impuesto mayor"});
  return r;
});

// 5-9: casos reales adicionales del primer documento, centrados en excedentes.
for (const [name,pago,tax,interest,expected] of [
  ["RET-2026-6",1897163,163300,7000,{impuesto:163300,intereses:7000,total:170300,excedente:1726863}],
  ["RET-2026-7-A",1726863,883000,1000,{impuesto:883000,intereses:1000,total:884000,excedente:842863}],
  ["RET-2026-7-B",842863,1114000,0,{impuesto:842863,intereses:0,total:842863,excedente:0}],
  ["RET-2026-7-C",7588,271137,0,{impuesto:7588,intereses:0,total:7588,excedente:0}],
  ["RET-2026-8",39403,1822000,0,{impuesto:39403,intereses:0,total:39403,excedente:0}]
]) run(name,()=>{
  const r=motor.aplicarProporcionalidad(pago,{impuesto:tax,intereses:interest,sancion:0});
  for(const [k,v] of Object.entries(expected)) assert.equal(r[k],v);
  assert.ok(r.total<=pago);
  return r;
});

// 10-12: frontera TDJ <=1000 y 1001. El motor completo debe respetar el pago.
for(const [valor,esperado] of [[157,157],[1000,1000],[1001,1001]]) run("TDJ-FRONTERA-"+valor,()=>{
  const r=motor.calcular({
    concepto:"VENTAS",anio:2026,periodo:1,tieneSancion:"NO",fechaCorte:"2026-09-10",
    vencimientos:[{id:"V1",numero:1,fecha:"2026-08-01",impuesto:10000,periodo:1}],
    pagos:[{fecha:"2026-09-10",valor,tipo:"TASA DIAN",tdj:"TDJ-"+valor,esTDJ:true}]
  });
  const a=r.detalle.at(-1).aplicado;
  assert.equal(a.total,esperado);
  assert.ok(a.total<=valor);
  assert.ok(a.excedente>=0);
  return a;
});

// 13: múltiples obligaciones, pago cronológico y nunca sobreaplicar.
run("SINTETICO-2-OBLIGACIONES-3-PAGOS",()=>{
  const r=motor.calcular({
    concepto:"VENTAS",anio:2026,periodo:1,tieneSancion:"NO",fechaCorte:"2026-09-30",
    vencimientos:[
      {id:"V1",numero:1,fecha:"2026-06-01",impuesto:5000000,periodo:1},
      {id:"V2",numero:2,fecha:"2026-07-01",impuesto:3000000,periodo:2}
    ],
    pagos:[
      {fecha:"2026-07-15",valor:1000000,tipo:"TASA DIAN"},
      {fecha:"2026-08-15",valor:2500000,tipo:"TASA DIAN"},
      {fecha:"2026-09-15",valor:7000000,tipo:"TASA DIAN"}
    ]
  });
  for(const d of r.detalle) assert.ok(d.aplicado.total<=d.pago.valor);
  assert.ok(r.excedente>=0);
  return {detalle:r.detalle.map(d=>({pago:d.pago.valor,aplicado:d.aplicado.total,excedente:d.excedente})),saldo:{impuesto:r.impuesto,intereses:r.intereses,sancion:r.sancion},excedente:r.excedente};
});

// 14: actualización anual de sanción con IPC real cargado.
run("SINTETICO-ACTUALIZACION-SANCION",()=>{
  const a=new ActualizadorSancion({ipc});
  const r=a.calcular(1000000,"2024-06-15","2026-09-28");
  assert.ok(r.valor>=1000000);
  assert.ok(r.tramos.length>=1);
  assert.equal(r.tramos[0].anioInflacion,2025);
  return {valor:r.valor,actualizacion:r.actualizacion,tramos:r.tramos.map(x=>({anio:x.anio,ipc:x.ipc,dias:x.dias,actualizacion:x.actualizacion}))};
});

console.log("TEST_SUITE_OK");
