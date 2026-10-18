// TDJ v16.33.182 — CIERRE DE SECUENCIA POR FECHA IGUAL.
// Corrección estrictamente aislada a la secuencia TDJ.
// Regla: la fecha igual solo ordena; no puede reabrir una obligación ya cerrada.
// Si existe un TDJ anterior de la misma fecha y, sin el TDJ actual, los pagos
// normales posteriores cierran la obligación, el TDJ actual queda fuera por
// completo (0 aplicado) y conserva su valor nominal para la siguiente obligación.
// Se preserva la proporcionalidad y el cálculo económico del motor.
// Se usa el motor original durante la prueba para evitar recursión con v132.
import { MotorLiquidacion as MotorLiquidacion182 } from "./motor-liquidacion.js?v=16.33.182";
import { MotorLiquidacionOficial as MotorLiquidacionOficial182 } from "./motor-liquidacion-oficial.js?v=16.33.182";
import { MotorLiquidacion as MotorLiquidacion161 } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial as MotorLiquidacionOficial161 } from "./motor-liquidacion-oficial.js?v=16.33.161";
(function(){
  "use strict";
  if(window.__tdjSecuenciaGuard182Installed)return;
  window.__tdjSecuenciaGuard182Installed=true;

  const iso=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m)return "";
    let y=m[3];
    if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
    return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  };
  const num=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
  const esTDJ=p=>p?.esTDJ===true||String(p?.tdj??"").trim()!=="";

  function detallePago(resultado,pago){
    const id=String(pago?.id??"");
    const fecha=iso(pago?.fecha);
    const valor=num(pago?.valor);
    return (resultado?.detalle||[]).find(x=>String(x?.pago?.id??"")===id)
      ||(resultado?.detalle||[]).find(x=>!esTDJ(x?.pago)&&iso(x?.pago?.fecha)===fecha&&Math.abs(num(x?.pago?.valor)-valor)<0.01)
      ||null;
  }

  function excedente(resultado,pago){
    const d=detallePago(resultado,pago);
    return Math.max(0,num(d?.excedente??d?.aplicado?.excedente));
  }

  function cierrePorPagoNormalPosterior(resultado,posteriores){
    if(!posteriores.length)return false;
    const ordenados=[...posteriores].sort((a,b)=>iso(a?.fecha).localeCompare(iso(b?.fecha)));
    const ultimo=ordenados.at(-1);
    const d=detallePago(resultado,ultimo);
    if(!d)return false;

    const saldoDetalle=Math.max(0,num(d?.saldo?.total));
    const aplicado=num(d?.aplicado?.total);
    const valor=num(ultimo?.valor);
    const pagoCompleto=aplicado+1000>=valor;
    const sinExcedente=posteriores.every(p=>excedente(resultado,p)<=1000);

    // Cierre efectivo: el último pago normal queda completamente aplicado y
    // la obligación queda en cero/tolerancia. No se infiere por sumas nominales.
    return saldoDetalle<=1000&&pagoCompleto&&sinExcedente;
  }

  function conBypass(fn){
    const anterior=Boolean(window.__tdj182BypassMotor);
    window.__tdj182BypassMotor=true;
    try{return fn();}finally{window.__tdj182BypassMotor=anterior;}
  }

  function candidatoMismaFecha(datos,original){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    const tdjs=pagos.filter(esTDJ).filter(p=>iso(p?.fecha)&&num(p?.valor)>0);
    if(tdjs.length<2)return null;

    // Se respeta el orden que recibe el motor. La fecha solo agrupa títulos
    // del mismo día; nunca decide por sí sola que una obligación se reabra.
    for(let i=tdjs.length-1;i>=1;i--){
      const actual=tdjs[i];
      const fecha=iso(actual?.fecha);
      if(!fecha)continue;

      const prevMisma=tdjs.slice(0,i).filter(p=>iso(p?.fecha)===fecha&&num(p?.valor)>0);
      if(!prevMisma.length)continue;

      const posteriores=pagos.filter(p=>!esTDJ(p)&&iso(p?.fecha)>fecha&&num(p?.valor)>0);
      if(!posteriores.length)continue;

      // La prueba conserva exactamente los TDJ anteriores ya representados en
      // datos (por ejemplo, 20M -> 15.548M) y elimina solo el título frontera.
      const sinActual={
        ...datos,
        pagos:pagos.map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})
      };
      const maxFecha=posteriores.map(p=>iso(p?.fecha)).filter(Boolean).sort().at(-1)||fecha;
      let rSin=null;
      try{rSin=conBypass(()=>original.call(this,{...sinActual,fechaCorte:maxFecha}));}catch{continue;}

      const cierre=cierrePorPagoNormalPosterior(rSin,posteriores);
      const saldoFinal=Math.max(0,num(rSin?.total));
      if(cierre||saldoFinal<=1000&&posteriores.every(p=>excedente(rSin,p)<=1000))return actual;
    }
    return null;
  }

  function instalar(Clase){
    if(!Clase?.prototype?.calcular)return;
    const p=Clase.prototype;
    const original=p.calcular;
    if(original.__tdj182)return;

    function calcular(datos,...rest){
      if(window.__tdj182BypassMotor)return original.call(this,datos,...rest);
      const actual=candidatoMismaFecha.call(this,datos,original);
      if(actual){
        // La exclusión es solo de esta fotografía de cálculo. El objeto externo
        // conserva el valor nominal del título para que continúe a la siguiente
        // obligación/endoso. Nunca se altera la fecha real del TDJ.
        const corregidos={
          ...datos,
          pagos:(datos?.pagos||[]).map(p=>String(p?.id??"")===String(actual?.id??"")?{...p,valor:0}:{...p})
        };
        return original.call(this,corregidos,...rest);
      }
      return original.call(this,datos,...rest);
    }
    calcular.__tdj182=true;
    p.calcular=calcular;
  }

  instalar(MotorLiquidacion182);
  instalar(MotorLiquidacionOficial182);
  instalar(MotorLiquidacion161);
  instalar(MotorLiquidacionOficial161);
  window.__tdjSecuenciaGuard182Ready=true;
})();
