// TDJ v16.33.195 — IDENTIDAD ESTABLE OBLIGACIÓN × TDJ.
// CORRECCIÓN AISLADA: cuando existen obligaciones con el mismo concepto/año/período,
// no permite que el puente 16.33.174 las confunda y herede la tasa de la primera.
// No modifica fórmulas, distribución, intereses, sanciones, excedentes ni endoso.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjObligacionIdentity195Installed)return;
  window.__tdjObligacionIdentity195Installed=true;

  const UPPER=v=>String(v??"").trim().toUpperCase();
  const cards=()=>[...document.querySelectorAll('#listaObligaciones > .obligacion-card')];
  const cardIndexById=id=>{
    const s=String(id??"").trim();
    if(!s)return -1;
    return cards().findIndex(c=>String(c.dataset.id||"")===s);
  };
  const normId=v=>UPPER(v).replace(/\s+/g,"");

  function publicarIdentidades(){
    const mapa={};
    cards().forEach((c,i)=>{
      const id=String(c.dataset.id||"").trim();
      if(id)mapa[id]=i;
    });
    window.__tdjObligacionIdentityMap=mapa;
    window.__tdjObligacionIdentityVersion="16.33.195";
  }

  function explicitIndex(datos){
    if(datos?.obligacionId!=null){
      const i=cardIndexById(datos.obligacionId);
      if(i>=0)return i;
    }
    if(datos?.__tdjObligacionId!=null){
      const i=cardIndexById(datos.__tdjObligacionId);
      if(i>=0)return i;
    }
    if(datos?.__tdjObligacionIndex!=null){
      const i=Number(datos.__tdjObligacionIndex);
      if(Number.isInteger(i)&&i>=0&&i<cards().length)return i;
    }
    for(const k of ["idObligacion","id_obligacion","obligacion_id"]){
      const i=cardIndexById(datos?.[k]);
      if(i>=0)return i;
    }
    if(datos?.id){
      const i=cardIndexById(datos.id);
      if(i>=0)return i;
    }
    return -1;
  }

  function paymentSignature(datos){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    return pagos.map(p=>normId(p?.id||p?.tituloId||p?.tdjId||p?.tdj||p?.referenciaTitulo)).filter(Boolean).sort().join("|");
  }

  const estadoPorMotor=new WeakMap();
  function estadoMotor(Clase){
    let e=estadoPorMotor.get(Clase);
    if(!e){e={cursor:0,resetScheduled:false,lastSig:""};estadoPorMotor.set(Clase,e);}
    return e;
  }
  function secuencialIndex(Clase,datos){
    const cs=cards();
    if(!cs.length)return 0;
    const e=estadoMotor(Clase);
    const i=Math.min(Math.max(e.cursor,0),cs.length-1);
    e.cursor=(e.cursor+1)%cs.length;
    if(!e.resetScheduled){
      e.resetScheduled=true;
      queueMicrotask(()=>{e.cursor=0;e.resetScheduled=false;e.lastSig="";});
    }
    e.lastSig=paymentSignature(datos);
    return i;
  }

  function resolverIndice(Clase,datos){
    publicarIdentidades();
    const exp=explicitIndex(datos);
    if(exp>=0)return exp;
    return secuencialIndex(Clase,datos);
  }

  function patch(Clase){
    const p=Clase?.prototype;
    if(!p||typeof p.calcular!=="function")return;
    if(p.__tdjObligacionIdentity195)return;
    const original=p.calcular;
    function calcular195(datos,...rest){
      const d=datos&&typeof datos==="object"?datos:{};
      const i=resolverIndice(Clase,d);
      // Siempre fijamos el índice resuelto en esta llamada. Esto evita que un
      // objeto de payload reutilizado conserve accidentalmente la obligación
      // anterior antes de entrar al puente 16.33.174.
      d.__tdjObligacionIndex=i;
      const card=cards()[i];
      const id=String(card?.dataset?.id||"").trim();
      if(id){
        if(d.obligacionId==null)d.obligacionId=id;
        d.__tdjObligacionId=id;
      }
      return original.call(this,d,...rest);
    }
    calcular195.__tdjObligacionIdentity195=true;
    p.calcular=calcular195;
    p.__tdjObligacionIdentity195=true;
  }

  function instalarObservadores(){
    const run=()=>{publicarIdentidades();};
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});
    else run();
    new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true});
  }

  patch(MotorLiquidacion);
  patch(MotorLiquidacionOficial);
  instalarObservadores();
  window.__tdjObligacionIdentity195Ready=true;
})();
