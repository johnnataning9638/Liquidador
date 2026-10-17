// TDJ v16.33.169 — PUENTE DE TASA POR TÍTULO × OBLIGACIÓN + RESTRICCIONES.
// CAPA AISLADA: NO MODIFICA EL MOTOR HISTÓRICO.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.169";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.169";
import { validarSeleccion1419 } from "./decreto-1419.js?v=16.33.169";

(function(){
  "use strict";
  if(window.__tdjTasaBridge169Installed)return;
  window.__tdjTasaBridge169Installed=true;

  const UPPER=v=>String(v??"").trim().toUpperCase();
  const ISO=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m)return "";
    let y=m[3];if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
    return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  };
  const NUM=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};

  function filasTitulos(){return [...document.querySelectorAll("#tablaTitulos tbody tr")];}
  function filaPorId(id){return filasTitulos().find(tr=>tr.dataset.tituloId===String(id||""))||null;}
  function titulosDOM(){return filasTitulos().map((tr,i)=>({index:i,id:tr.dataset.tituloId||"",tdj:UPPER(tr.querySelector('[data-t="tdj"]')?.value||""),fecha:ISO(tr.querySelector('.fecha-campo')?.value||tr.querySelector('.fecha-native')?.value||""),valor:NUM(tr.querySelector('[data-t="valor"]')?.value||"")}));}
  function cardsObligaciones(){return [...document.querySelectorAll('#listaObligaciones > .obligacion-card')];}
  function campo(card,k){return String(card?.querySelector(`[data-k="${k}"]`)?.value||"").trim();}
  function fechasVencimiento(card){return [...(card?.querySelectorAll('.cuotas-mini tbody tr')||[])].map(tr=>ISO(tr.querySelector('.fecha-campo')?.value||tr.querySelector('.fecha-native')?.value||"")).filter(Boolean);}
  function datosObligacionUI(card,index){return {id:card?.dataset?.id||"",numero:index+1,concepto:campo(card,"concepto"),anio:campo(card,"anio"),periodo:campo(card,"periodo"),fechaSancion:ISO(campo(card,"fechaSancion")),vencimientos:fechasVencimiento(card),tieneSancion:UPPER(campo(card,"tieneSancion")),valorSancion:NUM(campo(card,"valorSancion"))};}

  function obligationIndex(datos){
    const cards=cardsObligaciones();if(!cards.length)return 0;
    if(datos?.__tdjObligacionIndex!=null&&Number.isInteger(Number(datos.__tdjObligacionIndex))){const i=Number(datos.__tdjObligacionIndex);if(i>=0&&i<cards.length)return i;}
    if(datos?.id){const i=cards.findIndex(c=>c.dataset.id===String(datos.id));if(i>=0)return i;}
    const concept=UPPER(datos?.concepto),anio=String(datos?.anio??""),periodo=String(datos?.periodo??"");
    let best=0,bestScore=-1;
    cards.forEach((card,i)=>{
      const u=datosObligacionUI(card,i),vto=Array.isArray(datos?.vencimientos)?datos.vencimientos:[];let score=0;
      if(concept&&concept===UPPER(u.concepto))score+=5;
      if(anio&&anio===u.anio)score+=3;
      if(periodo&&periodo===u.periodo)score+=3;
      const vf=vto.map(v=>ISO(v?.fecha||v?.fechaVto||v)).filter(Boolean);
      if(vf.length&&u.vencimientos.length){score+=vf.filter(f=>u.vencimientos.includes(f)).length*4;if(vf.length===u.vencimientos.length)score+=3;}
      if(score>bestScore){bestScore=score;best=i;}
    });
    return best;
  }

  function selectedType(title,index){
    const tr=filaPorId(title?.id),cells=[...(tr?.querySelectorAll('.tdj-beneficio-visual')||[])],select=cells[index]?.querySelector('select');
    return UPPER(select?.value||window.__tdjTasaPorTituloObligacion?.get(`${title?.tdj}|${index}`)||"TASA DIAN")||"TASA DIAN";
  }

  function localizarTituloPago(pago,usados){
    const lista=titulosDOM();
    const claves=[pago?.tituloId,pago?.tdjId,pago?.idTitulo,pago?.idTDJ,pago?.tdj,pago?.referenciaTitulo].map(v=>UPPER(v)).filter(Boolean);
    let t=lista.find(x=>!usados.has(x.id)&&claves.includes(UPPER(x.id)))||lista.find(x=>!usados.has(x.id)&&claves.includes(x.tdj));
    if(t)return t;
    const fp=ISO(pago?.fecha),vp=NUM(pago?.valor);
    return lista.find(x=>!usados.has(x.id)&&x.fecha===fp&&Math.abs(x.valor-vp)<0.01)||null;
  }

  function aplicarTasasPorTitulo(datos,indexObligacion){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];if(!pagos.length)return;
    const usados=new Set();
    for(const p of pagos){
      const t=localizarTituloPago(p,usados);if(!t)continue;usados.add(t.id);
      const tipo=selectedType(t,indexObligacion);p.tipo=tipo;p.tipoTasaObligacion=tipo;p.tdj=t.tdj||p.tdj;p.esTDJ=true;
    }
    const referencia=titulosDOM()[0];if(referencia)datos.tipoTasa=selectedType(referencia,indexObligacion);
    datos.__tdjObligacionIndex=indexObligacion;
  }

  function errores0240y1474(tipo,fechaPago,fechaSancion){
    const t=UPPER(tipo),fp=ISO(fechaPago),fs=ISO(fechaSancion),e=[];
    const ventanas=[
      ["ART. 20 DECRETO 1474 DE 2025","2025-12-30","2026-03-31",false,"ART. 20 DEL DECRETO 1474 DE 2025"],
      ["ART. 21 DECRETO 1474 DE 2025","2025-12-30","2026-04-30",true,"ART. 21 DEL DECRETO 1474 DE 2025"],
      ["ART. 3 DECRETO 0240 DE 2026","2026-03-12","2026-04-30",false,"ART. 3 DEL DECRETO 0240 DE 2026"],
      ["ART. 4 DECRETO 0240 DE 2026","2026-03-12","2026-04-30",true,"ART. 4 DEL DECRETO 0240 DE 2026"]
    ];
    const v=ventanas.find(x=>t.includes(x[0]));if(!v)return e;
    if(!fp)e.push(`El TDJ seleccionado con ${v[4]} debe tener fecha.`);else if(fp<v[1]||fp>v[2])e.push(`La fecha del TDJ (${fp}) está fuera de la vigencia de ${v[4]}. Vigencia permitida: ${v[1]} a ${v[2]}.`);
    if(v[3]){if(!fs)e.push(`Para ${v[4]} debe registrar la fecha de sanción/presentación.`);else if(fs<v[1]||fs>v[2])e.push(`La fecha de sanción/presentación (${fs}) está fuera de la vigencia de ${v[4]}. Vigencia permitida: ${v[1]} a ${v[2]}.`);}
    return e;
  }

  function validarTipo(title,index){
    const cards=cardsObligaciones(),card=cards[index];if(!card)return [];
    const o=datosObligacionUI(card,index),tr=filaPorId(title.id),tipo=selectedType(title,index),fp=ISO(tr?.querySelector('.fecha-campo')?.value||tr?.querySelector('.fecha-native')?.value||"");
    return [...validarSeleccion1419({tipo,fechasVencimiento:o.vencimientos,fechaPresentacion:o.fechaSancion,fechaPago:fp,fechaTitulo:fp,esTitulo:true}),...errores0240y1474(tipo,fp,o.fechaSancion)];
  }

  function mensajeRestriccion(title,index,tipoAnterior){
    const errores=validarTipo(title,index);if(!errores.length)return true;
    const tr=filaPorId(title.id),select=[...(tr?.querySelectorAll('.tdj-beneficio-visual')||[])][index]?.querySelector('select');
    if(select){select.value=tipoAnterior||"TASA DIAN";select.dataset.tdjPrev=tipoAnterior||"TASA DIAN";}
    alert("NO ES POSIBLE APLICAR EL BENEFICIO SELECCIONADO:\n\n"+errores.join("\n"));
    return false;
  }

  function instalarValidacionSelect(){
    document.addEventListener("focusin",e=>{const select=e.target?.closest?.('#tablaTitulos select.tdj-beneficio-select');if(select&&!select.dataset.tdjPrev)select.dataset.tdjPrev=select.value||"TASA DIAN";},true);
    document.addEventListener("change",e=>{
      const select=e.target?.closest?.('#tablaTitulos select.tdj-beneficio-select');if(!select)return;
      const tr=select.closest('tr'),title={id:tr?.dataset?.tituloId||"",tdj:tr?.querySelector('[data-t="tdj"]')?.value||""},cells=[...tr.querySelectorAll('.tdj-beneficio-visual')],index=cells.indexOf(select.closest('.tdj-beneficio-visual'));if(index<0)return;
      const anterior=select.dataset.tdjPrev||"TASA DIAN";
      if(!mensajeRestriccion(title,index,anterior))return;
      select.dataset.tdjPrev=select.value||"TASA DIAN";
    },true);
  }

  function validarAntesDeCalcular(index){
    const errores=[];
    for(const t of titulosDOM()){
      const tipo=selectedType(t,index);if(tipo==="TASA DIAN")continue;
      errores.push(...validarTipo(t,index).map(x=>`TDJ ${t.tdj||t.index+1}: ${x}`));
    }
    if(errores.length)throw new Error("BENEFICIO NO VÁLIDO:\n\n"+errores.join("\n"));
  }

  function patch(Clase){
    if(!Clase?.prototype?.calcular)return;
    const proto=Clase.prototype,original=proto.calcular;if(original.__tdj169)return;
    function calcularTDJ169(datos,...rest){const idx=obligationIndex(datos);validarAntesDeCalcular(idx);aplicarTasasPorTitulo(datos,idx);return original.call(this,datos,...rest);}
    calcularTDJ169.__tdj169=true;proto.calcular=calcularTDJ169;
  }

  patch(MotorLiquidacion);patch(MotorLiquidacionOficial);instalarValidacionSelect();window.__tdjTasaBridge169Ready=true;
})();
