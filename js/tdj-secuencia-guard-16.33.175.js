// TDJ 16.33.175 — GUARDIA DE SECUENCIA.
// Corrección estrictamente posterior al puente 16.33.174.
// No modifica motores ni fórmulas. Replica la premisa observable del
// Liquidador DIAN: si la obligación queda totalmente cubierta sin el TDJ
// actual, ese título no se consume en la obligación actual.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjSecuenciaGuard175Installed)return;
  window.__tdjSecuenciaGuard175Installed=true;

  const iso=v=>{const s=String(v??"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!m)return "";let y=m[3];if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;};
  const num=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";

  function guard(Clase){
    if(!Clase?.prototype?.calcular)return;
    const p=Clase.prototype,original=p.calcular;
    if(original.__tdj175)return;

    function calcular(datos,...rest){
      const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
      const tdjs=pagos.filter(esTDJ).filter(p=>iso(p?.fecha)&&num(p?.valor)>0);
      if(tdjs.length<2)return original.call(this,datos,...rest);

      // Solo se examina el último título de la misma fecha. Esto coincide con
      // el punto donde 16.33.174 estaba produciendo el residuo artificial.
      const actual=tdjs[tdjs.length-1];
      const fecha=iso(actual?.fecha);
      const prevMisma=tdjs.slice(0,-1).filter(p=>iso(p?.fecha)===fecha);
      if(!fecha||!prevMisma.length)return original.call(this,datos,...rest);

      // El guard no interviene si no existen movimientos posteriores al TDJ.
      const posteriores=pagos.filter(p=>!esTDJ(p)&&iso(p?.fecha)>fecha&&num(p?.valor)>0);
      if(!posteriores.length)return original.call(this,datos,...rest);

      // Simulación económica EXACTA del motor existente, cambiando únicamente
      // el valor del TDJ actual a cero. Si así la obligación ya queda saldada,
      // el título actual no debe ser aplicado en ella.
      const sinActual={...datos,pagos:pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})};
      let r;
      try{r=original.call(this,sinActual,...rest);}catch{return original.call(this,datos,...rest);}

      const saldo=num(r?.total);
      if(saldo<=0.5){
        const corregidos=pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p});
        return original.call(this,{...datos,pagos:corregidos},...rest);
      }

      return original.call(this,datos,...rest);
    }
    calcular.__tdj175=true;
    p.calcular=calcular;
  }

  guard(MotorLiquidacion);
  guard(MotorLiquidacionOficial);
  window.__tdjSecuenciaGuard175Ready=true;
})();
