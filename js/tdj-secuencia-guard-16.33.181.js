// TDJ v16.33.181 — GUARDIA DE SECUENCIA / PRIMERA OBLIGACIÓN.
// Corrección aislada: replica en TDJ la regla observada en el liquidador DIAN
// correcto: un TDJ posterior de la misma fecha que resulte completamente
// innecesario para cerrar la obligación NO debe imputar ni siquiera $1.000.
// El valor nominal permanece íntegro para la siguiente obligación / endoso.
// No modifica fórmulas tributarias ni la proporcionalidad económica.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.181";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.181";
(function(){
  "use strict";
  if(window.__tdjSecuenciaGuard181Installed)return;
  window.__tdjSecuenciaGuard181Installed=true;
  const iso=v=>{const s=String(v??"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!m)return "";let y=m[3];if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;};
  const num=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";
  function excedente(resultado,pago){const id=String(pago?.id??""),fecha=iso(pago?.fecha),valor=num(pago?.valor),d=(resultado?.detalle||[]).find(x=>String(x?.pago?.id??"")===id)||(resultado?.detalle||[]).find(x=>!esTDJ(x?.pago)&&iso(x?.pago?.fecha)===fecha&&Math.abs(num(x?.pago?.valor)-valor)<.01);return Math.max(0,num(d?.excedente??d?.aplicado?.excedente));}
  function candidatoInnecesario(datos,original){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    const tdjs=pagos.filter(esTDJ).filter(p=>iso(p?.fecha)&&num(p?.valor)>0);
    if(tdjs.length<2)return null;
    // Se analiza desde el último TDJ de la fecha hacia atrás. En el caso de
    // referencia, esto identifica el TDJ de $10.000.000, mientras que el de
    // $20.000.000 no cumple la condición al retirarlo.
    for(let i=tdjs.length-1;i>=1;i--){
      const actual=tdjs[i],fecha=iso(actual?.fecha);
      if(!fecha)continue;
      const prevMisma=tdjs.slice(0,i).filter(p=>iso(p?.fecha)===fecha&&num(p?.valor)>0);
      if(!prevMisma.length)continue;
      const posteriores=pagos.filter(p=>!esTDJ(p)&&iso(p?.fecha)>fecha&&num(p?.valor)>0);
      if(!posteriores.length)continue;
      const sinActual={...datos,pagos:pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})};
      let rSin;
      try{
        const maxFecha=posteriores.map(p=>iso(p?.fecha)).filter(Boolean).sort().at(-1)||fecha;
        rSin=original.call(this,{...sinActual,fechaCorte:maxFecha});
      }catch{continue;}
      const saldoSin=Math.max(0,num(rSin?.total));
      const normalesCompletamenteAplicados=posteriores.every(p=>excedente(rSin,p)<=0.5);
      if(normalesCompletamenteAplicados&&saldoSin<=1000)return actual;
    }
    return null;
  }
  function instalar(Clase){
    if(!Clase?.prototype?.calcular)return;
    const p=Clase.prototype,original=p.calcular;
    if(original.__tdj181)return;
    function calcular(datos,...rest){
      const actual=candidatoInnecesario(datos,original);
      if(actual){
        // Regla crítica: el título innecesario no participa en esta obligación.
        // Se recalcula la obligación sin tocar su valor nominal en la fuente de
        // datos exterior; así el valor completo queda disponible para la
        // siguiente obligación y nunca se genera la aplicación artificial de
        // $1.000 sobre intereses.
        const corregidos={...datos,pagos:(datos?.pagos||[]).map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})};
        return original.call(this,corregidos,...rest);
      }
      return original.call(this,datos,...rest);
    }
    calcular.__tdj181=true;p.calcular=calcular;
  }
  instalar(MotorLiquidacion);instalar(MotorLiquidacionOficial);window.__tdjSecuenciaGuard181Ready=true;
})();
