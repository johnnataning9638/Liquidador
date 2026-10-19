// TDJ v16.33.202 — RESOLUCIÓN ROBUSTA DE OBLIGACIÓN + SILENCIO DE ALERTA FALSA DE ENDOSO.
// CORRECCIÓN AISLADA: evita que __tdjObligacionIndex / obligacionId de una llamada
// anterior queden pegados a un payload reutilizado y hagan que la obligación 2+
// herede la tasa de la obligación 1.
// Prioridad: identidad válida > coincidencia de datos de obligación > beneficio
// visual del TDJ > secuencia síncrona. No modifica fórmulas ni motor histórico.
// v16.33.200: se silencia exclusivamente el mensaje de inconsistencia de endoso
// que aparece con tasas/beneficios TDJ; no se interceptan otras alertas.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjObligacionContexto197Installed)return;
  window.__tdjObligacionContexto197Installed=true;

  const UPPER=v=>String(v??"").trim().toUpperCase();
  const ISO=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m)return "";
    let y=m[3]; if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
    return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  };
  const VAL=el=>String(el?.value??el?.getAttribute?.("value")??"").trim();
  const cards=()=>[...document.querySelectorAll("#listaObligaciones > .obligacion-card")];
  const filas=()=>[...document.querySelectorAll("#tablaTitulos tbody tr")];
  const campo=(c,k)=>VAL(c?.querySelector(`[data-k="${k}"]`));
  const vencimientos=c=>[...(c?.querySelectorAll(".cuotas-mini tbody tr")||[])]
    .map(tr=>ISO(VAL(tr.querySelector(".fecha-campo"))||VAL(tr.querySelector(".fecha-native"))||""))
    .filter(Boolean);

  function indicePorId(id){
    const s=String(id??"").trim();
    if(!s)return -1;
    return cards().findIndex(c=>String(c.dataset.id||"").trim()===s);
  }

  function datosIdentificanObligacion(d){
    return Boolean(String(d?.concepto??"").trim()||String(d?.anio??"").trim()||
      String(d?.periodo??"").trim()||(Array.isArray(d?.vencimientos)&&d.vencimientos.length));
  }

  function scoreDatos(d,c){
    const concepto=UPPER(d?.concepto), anio=String(d?.anio??"").trim(), periodo=String(d?.periodo??"").trim();
    const oConcepto=UPPER(campo(c,"concepto")), oAnio=campo(c,"anio"), oPeriodo=campo(c,"periodo");
    const vf=(Array.isArray(d?.vencimientos)?d.vencimientos:[])
      .map(v=>ISO(v?.fecha||v?.fechaVto||v)).filter(Boolean);
    const ov=vencimientos(c);
    let s=0;
    if(concepto&&concepto===oConcepto)s+=5;
    if(anio&&anio===oAnio)s+=3;
    if(periodo&&periodo===oPeriodo)s+=3;
    if(vf.length&&ov.length)s+=vf.filter(f=>ov.includes(f)).length*4;
    if(vf.length===ov.length&&vf.length)s+=3;
    return s;
  }

  function tipoVisual(tr,i){
    const cells=[...(tr?.querySelectorAll(".tdj-beneficio-visual")||[])];
    return UPPER(cells[i]?.querySelector("select")?.value||"");
  }

  function tipoTDJ(d){
    const pagos=Array.isArray(d?.pagos)?d.pagos:[];
    const p=[...pagos].reverse().find(x=>x?.esTDJ===true||String(x?.tdj||"").trim()!=="");
    return UPPER(p?.tipoTasaObligacion||p?.tipo||"");
  }

  function indicePorTipoVisual(d){
    const tipo=tipoTDJ(d);
    if(!tipo)return -1;
    const matches=[];
    for(let i=0;i<cards().length;i++){
      if(filas().some(tr=>tipoVisual(tr,i)===tipo))matches.push(i);
    }
    return matches.length===1?matches[0]:-1;
  }

  const estadoPorMotor=new WeakMap();
  function estado(Clase){
    let e=estadoPorMotor.get(Clase);
    if(!e){e={cursor:0,reset:false,lastSig:""};estadoPorMotor.set(Clase,e);}
    return e;
  }

  function firma(d){
    const pagos=Array.isArray(d?.pagos)?d.pagos:[];
    return pagos.map(p=>String(p?.tdj||p?.id||p?.tituloId||"")).filter(Boolean).sort().join("|");
  }

  function indiceSecuencial(Clase,d){
    const cs=cards();
    if(!cs.length)return 0;
    const e=estado(Clase);
    const i=Math.min(Math.max(e.cursor,0),cs.length-1);
    e.cursor=(e.cursor+1)%cs.length;
    e.lastSig=firma(d);
    if(!e.reset){
      e.reset=true;
      queueMicrotask(()=>{e.cursor=0;e.reset=false;e.lastSig="";});
    }
    return i;
  }

  function resolver(Clase,d){
    const cs=cards();
    if(!cs.length)return 0;

    // Solo confiamos en una identidad explícita si además coincide con los
    // datos de la obligación. Esto evita arrastrar IDs de un payload reutilizado.
    for(const k of ["obligacionId","__tdjObligacionId","idObligacion","id_obligacion","obligacion_id"]){
      const i=indicePorId(d?.[k]);
      if(i<0)continue;
      if(!datosIdentificanObligacion(d))return i;
      const target=scoreDatos(d,cs[i]);
      if(target<=0)continue;
      let mejores=0,mejorScore=-1;
      cs.forEach(c=>{
        const s=scoreDatos(d,c);
        if(s>mejorScore){mejorScore=s;mejores=1;}
        else if(s===mejorScore)mejores++;
      });
      if(mejorScore===target&&mejores===1)return i;
    }

    if(datosIdentificanObligacion(d)){
      let best=-1,bestScore=-1,tie=false;
      cs.forEach((c,i)=>{
        const s=scoreDatos(d,c);
        if(s>bestScore){best=i;bestScore=s;tie=false;}
        else if(s===bestScore&&s>0){tie=true;}
      });
      if(best>=0&&bestScore>0&&!tie)return best;
    }

    const porTipo=indicePorTipoVisual(d);
    if(porTipo>=0)return porTipo;
    return indiceSecuencial(Clase,d);
  }

  function instalar(Clase){
    const p=Clase?.prototype;
    if(!p||typeof p.calcular!=="function")return;
    if(p.__tdjObligacionContexto197)return;
    const original=p.calcular;
    function calcular197(datos,...rest){
      const originalData=datos&&typeof datos==="object"?datos:{};
      const d={...originalData};
      const i=resolver(Clase,d);
      const card=cards()[i];
      d.__tdjObligacionIndex=i;
      const id=String(card?.dataset?.id||"").trim();
      if(id){
        d.obligacionId=id;
        d.__tdjObligacionId=id;
      }
      return original.call(this,d,...rest);
    }
    calcular197.__tdjObligacionContexto197=true;
    p.calcular=calcular197;
    p.__tdjObligacionContexto197=true;
  }

  instalar(MotorLiquidacion);
  instalar(MotorLiquidacionOficial);

  window.__tdjObligacionContexto197Ready=true;
})();
