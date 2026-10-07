import fs from "node:fs";
import assert from "node:assert/strict";
const app=fs.readFileSync("js/app.js","utf8");
const tdj=fs.readFileSync("js/tdj.js","utf8");
for(const [name,src] of [["app.js",app],["tdj.js",tdj]]){
  assert.match(src,/detalleCorte=Array\.isArray\(r\?\.interesesPorCuota\)\?r\.interesesPorCuota:\[\]/,`${name}: fallback de corte ausente`);
  assert.match(src,/esCorteInformativo=Number\(p\.valor\|\|0\)===0/,`${name}: detección de corte ausente`);
  assert.match(src,/capitalBase\|\|t\?\.base\|\|vtoRef\?\.saldo\|\|vtoRef\?\.impuesto/,`${name}: capital base de corte ausente`);
}

const esCorteInformativo=p=>Number(p?.valor||0)===0&&Boolean(p?.fecha)&&!String(p?.recibo||"").trim()&&!String(p?.tdj||"").trim();
const detalleCorte=[{cuota:1,capitalBase:5420000,fechaVencimiento:"2025-02-25",fechaPago:"2026-10-06",dias:589,tasa:0.2659,interes:2326000}];
const pagoCorte={valor:0,fecha:"2026-10-06",recibo:"",tdj:""};
assert.equal(esCorteInformativo(pagoCorte),true,"fecha de corte debe identificarse aunque el pago sea $0");
assert.equal(esCorteInformativo({valor:0,fecha:"",recibo:"",tdj:""}),false,"sin fecha no puede tratarse como corte");
assert.equal(detalleCorte[0].capitalBase,5420000,"el detalle conserva capital base");
assert.equal(detalleCorte.reduce((s,x)=>s+x.interes,0),2326000,"el detalle conserva el interés calculado");
console.log("REGRESIÓN DETALLE INTERESES FECHA DE CORTE: OK");
