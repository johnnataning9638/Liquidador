// TDJ v16.33.194 — CONTEXTO EXPLÍCITO DE BENEFICIO POR OBLIGACIÓN.
// CORRECCIÓN AISLADA: evita que obligaciones con el mismo concepto/año/período
// sean confundidas al propagar el tipo de tasa/beneficio hacia el motor TDJ.
// NO modifica el motor matemático histórico ni la aplicación de títulos.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjBeneficioContexto194Installed)return;
  window.__tdjBeneficioContexto194Installed=true;

  function patch(Clase){
    const proto=Clase?.prototype;
    if(!proto||typeof proto.calcular!=="function"||proto.__tdjBeneficioContexto194)return;
    const original=proto.calcular;
    function calcular(datos,...rest){
      const d=datos&&typeof datos==="object"?{...datos}:{};
      const vtos=d.vencimientos;
      let indice=null;

      // La capa visual 16.33.167 ya conserva una relación estable
      // VENCIMIENTOS -> ÍNDICE DE OBLIGACIÓN durante la secuencia de cálculo.
      // La reutilizamos para no crear una segunda lógica de ordenamiento.
      try{
        const mapa=window.__tdjMotorRateMap;
        if(mapa&&vtos&&typeof mapa.get==="function"){
          const n=mapa.get(vtos);
          if(Number.isInteger(Number(n)))indice=Number(n);
        }
      }catch(_){ }

      // Si otra capa ya suministró el índice explícito, tiene prioridad.
      const indiceExplicito=d.__tdjObligacionIndex;
      if(indiceExplicito!==null&&indiceExplicito!==undefined&&indiceExplicito!==""&&Number.isInteger(Number(indiceExplicito))){
        indice=Number(indiceExplicito);
      }

      if(indice!=null&&indice>=0){
        d.__tdjObligacionIndex=indice;
      }

      return original.call(this,d,...rest);
    }
    calcular.__tdjBeneficioContexto194=true;
    proto.calcular=calcular;
    proto.__tdjBeneficioContexto194=true;
  }

  // El módulo 16.33.174 consultará este índice antes de intentar identificar
  // la obligación por concepto/año/período. Así, OBLIGACIÓN 2 puede ser
  // RETENCIÓN 2026 P1 igual que OBLIGACIÓN 1 sin heredar su beneficio.
  patch(MotorLiquidacion);
  patch(MotorLiquidacionOficial);
  window.__tdjBeneficioContexto194Ready=true;
})();
