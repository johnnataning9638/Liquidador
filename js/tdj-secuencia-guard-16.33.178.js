// TDJ v16.33.178 — GUARDIA DE SECUENCIA Y RECONCILIACIÓN.
// Corrección aislada: conserva la regla de prioridad de pagos normales
// posteriores sobre el último TDJ de la misma fecha. No modifica motores,
// fórmulas tributarias ni distribución económica.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjSecuenciaGuard178Installed)return;
  window.__tdjSecuenciaGuard178Installed=true;

  const iso=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m)return "";
    let y=m[3]; if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
    return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  };
  const num=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";
  function excedente(resultado,pago){
    const id=String(pago?.id??"");
    const fecha=iso(pago?.fecha), valor=num(pago?.valor);
    const d=(resultado?.detalle||[]).find(x=>String(x?.pago?.id??"")===id)
      ||(resultado?.detalle||[]).find(x=>!esTDJ(x?.pago)&&iso(x?.pago?.fecha)===fecha&&Math.abs(num(x?.pago?.valor)-valor)<.01);
    return Math.max(0,num(d?.excedente??d?.aplicado?.excedente));
  }
  function instalar(Clase){
    if(!Clase?.prototype?.calcular)return;
    const p=Clase.prototype,original=p.calcular;
    if(original.__tdj178)return;
    function calcular(datos,...rest){
      const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
      const tdjs=pagos.filter(esTDJ).filter(p=>iso(p?.fecha)&&num(p?.valor)>0);
      if(tdjs.length<2)return original.call(this,datos,...rest);
      const actual=tdjs[tdjs.length-1],fecha=iso(actual.fecha);
      if(!fecha)return original.call(this,datos,...rest);
      const prevMisma=tdjs.slice(0,-1).filter(p=>iso(p?.fecha)===fecha);
      if(!prevMisma.length)return original.call(this,datos,...rest);
      const posteriores=pagos.filter(p=>!esTDJ(p)&&iso(p?.fecha)>fecha&&num(p?.valor)>0);
      if(!posteriores.length)return original.call(this,datos,...rest);
      const valorOriginal=Math.max(0,Math.trunc(num(actual.valor)));
      if(valorOriginal<=0)return original.call(this,datos,...rest);
      const sinActual={...datos,pagos:pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})};
      let r;
      try{r=original.call(this,sinActual,...rest);}catch{return original.call(this,datos,...rest);}
      const saldo=Math.max(0,num(r?.total));
      const normalesCompletamenteAplicados=posteriores.every(p=>excedente(r,p)<=0.5);
      if(normalesCompletamenteAplicados && saldo<=1000){
        const corregidos=pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p});
        return original.call(this,{...datos,pagos:corregidos},...rest);
      }
      return original.call(this,datos,...rest);
    }
    calcular.__tdj178=true;
    p.calcular=calcular;
  }
  instalar(MotorLiquidacion);
  instalar(MotorLiquidacionOficial);
  window.__tdjSecuenciaGuard178Ready=true;
})();
