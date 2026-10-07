import assert from "node:assert/strict";
import {MotorLiquidacion} from "../js/motor-liquidacion.js";
const rates=[{desde:"2026-01-01",hasta:"2026-12-31",metodologia:"INTERES_SIMPLE_DIARIO",tasas:{"TASA DIAN":0.365}}];
const cfg={tasasMoratorias:rates,intereses:rates,reglasObligaciones:[{concepto:"PRUEBA FECHA CORTE",familia:"TEST",vencimientos:"MANUAL",periodicidad:"ANUAL"}],uvt:[]};
const base={concepto:"PRUEBA FECHA CORTE",anio:2026,tipoLiquidacion:"PRIVADA",tieneSancion:"NO",valorSancion:0,fechaSancion:"",vencimientos:[{id:"V1",numero:1,fecha:"2026-01-01",impuesto:100000}]};
const a=new MotorLiquidacion(cfg).calcular({...base,pagos:[],fechaCorte:"2026-02-01"}); assert.equal(a.fechaCorte,"2026-02-01"); assert.ok(a.intereses>0);
const b=new MotorLiquidacion(cfg).calcular({...base,pagos:[{id:"P1",fecha:"2026-01-15",valor:20000,tipo:"TASA DIAN"}],fechaCorte:"2026-02-01"}); assert.equal(b.fechaCorte,"2026-02-01"); assert.equal(b.detalle.filter(x=>x.esFechaCorte).length,1); assert.equal(Number(b.detalle.at(-1).pago.valor),0); console.log("PASS: fecha de corte sin pago ficticio y posterior a pagos reales");
