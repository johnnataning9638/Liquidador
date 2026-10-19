// TDJ v16.33.196 — CONTEXTO DE OBLIGACIÓN ANTES DEL PUENTE DE TASA.
// CORRECCIÓN AISLADA: el bridge 16.33.174 necesita conocer la obligación
// ANTES de resolver la tasa. La versión 16.33.195 fijaba identidad dentro del
// motor, pero el bridge se ejecutaba antes y podía caer en concepto/año/período.
// Esta capa se instala después de las capas históricas y antes de cada llamada
// al bridge, sin modificar fórmulas, distribución, sanciones, excedentes,
// endoso, importadores, PDF/Excel ni el motor matemático.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjObligacionContexto196Installed)return;
  window.__tdjObligacionContexto196Installed=true;

  const UPPER=v=>String(v??"").trim().toUpperCase();
  const cards=()=>[...document.querySelectorAll('#listaObligaciones > .obligacion-card')];
  const filas=()=>[...document.querySelectorAll('#tablaTitulos tbody tr')];
  const indicePorId=id=>{
    const s=String(id??"").trim();
    if(!s)return -1;
    return cards().findIndex(c=>String(c.dataset.id||"").trim()===s);
  };
  const indiceExplicito=d=>{
    for(const k of ["obligacionId","__tdjObligacionId","idObligacion","id_obligacion","obligacion_id"]){
      const i=indicePorId(d?.[k]);
      if(i>=0)return i;
    }
    const n=Number(d?.__tdjObligacionIndex);
    return Number.isInteger(n)&&n>=0&&n<cards().length?n:-1;
  };

  function tipoSeleccionadoFila(tr,indice){
    const cells=[...(tr?.querySelectorAll('.tdj-beneficio-visual')||[])];
    const sel=cells[indice]?.querySelector('select');
    return UPPER(sel?.value||"");
  }

  // Cuando el cálculo ya contiene un TDJ, el propio pago creado por
  // aplicarTitulos conserva la selección de la obligación en tipoTasaObligacion
  // y tipo. Eso es una identidad funcional mucho más fuerte que
  // concepto/año/período y funciona incluso cuando las obligaciones son
  // idénticas en esos tres campos.
  function indicePorTipoTDJ(d){
    const pagos=Array.isArray(d?.pagos)?d.pagos:[];
    const candidatos=pagos.filter(p=>p?.esTDJ===true||String(p?.tdj||"").trim()!=="");
    if(!candidatos.length)return -1;
    const p=candidatos.at(-1);
    const tipo=UPPER(p?.tipoTasaObligacion||p?.tipo||"");
    if(!tipo)return -1;
    const cs=cards();
    const matches=[];
    for(let i=0;i<cs.length;i++){
      for(const tr of filas()){
        const t=tipoSeleccionadoFila(tr,i);
        if(t&&t===tipo){matches.push(i);break;}
      }
    }
    // Si varias obligaciones usan exactamente el mismo tratamiento, cualquiera
    // de ellas produce la misma selección de tasa/beneficio; no forzamos una
    // distinción artificial. Para tratamientos diferentes, el match es único.
    return matches.length?matches[0]:-1;
  }

  const estadoPorMotor=new WeakMap();
  function estado(Clase){
    let e=estadoPorMotor.get(Clase);
    if(!e){e={cursor:0,reset:false};estadoPorMotor.set(Clase,e);}
    return e;
  }
  function indiceBaseSecuencial(Clase){
    const cs=cards();
    if(!cs.length)return 0;
    const e=estado(Clase);
    const i=Math.min(Math.max(e.cursor,0),cs.length-1);
    e.cursor=(e.cursor+1)%cs.length;
    if(!e.reset){
      e.reset=true;
      setTimeout(()=>{e.cursor=0;e.reset=false;},0);
    }
    return i;
  }

  function resolver(Clase,d){
    const exp=indiceExplicito(d);
    if(exp>=0)return exp;
    const porTipo=indicePorTipoTDJ(d);
    if(porTipo>=0)return porTipo;
    // Las primeras llamadas del cálculo corresponden a la liquidación base
    // de OBLIGACIÓN 1, 2, 3...; el cursor se reinicia al terminar el evento.
    return indiceBaseSecuencial(Clase);
  }

  function patch(Clase){
    const p=Clase?.prototype;
    if(!p||typeof p.calcular!=="function")return;
    if(p.__tdjObligacionContexto196)return;
    const original=p.calcular;
    function calcular196(datos,...rest){
      const d=datos&&typeof datos==="object"?datos:{};
      const i=resolver(Clase,d);
      d.__tdjObligacionIndex=i;
      const card=cards()[i];
      const id=String(card?.dataset?.id||"").trim();
      if(id){
        d.obligacionId=id;
        d.__tdjObligacionId=id;
      }
      return original.call(this,d,...rest);
    }
    calcular196.__tdjObligacionContexto196=true;
    p.calcular=calcular196;
    p.__tdjObligacionContexto196=true;
  }

  patch(MotorLiquidacion);
  patch(MotorLiquidacionOficial);
  window.__tdjObligacionContexto196Ready=true;
})();
