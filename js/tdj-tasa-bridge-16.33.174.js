// TDJ v16.33.174 — PUENTE DE TASA POR TÍTULO × OBLIGACIÓN + RESTRICCIONES + SECUENCIA MISMA FECHA.
// CORRECCIÓN AISLADA: replica la secuencia DIAN sin consumir un TDJ posterior
// para cerrar un remanente de hasta $1.000 cuando ya existe excedente real de
// títulos anteriores de la misma fecha. El TDJ posterior queda íntegramente
// disponible para la obligación siguiente.
// CAPA AISLADA: NO MODIFICA EL MOTOR HISTÓRICO NI TDJ-CORE.
import { MotorLiquidacion } from "./motor-liquidacion.js?v=16.33.161";
import { MotorLiquidacionOficial } from "./motor-liquidacion-oficial.js?v=16.33.161";
import { validarSeleccion1419 } from "./decreto-1419.js?v=16.33.161";

(function(){
  "use strict";
  if(window.__tdjTasaBridge174Installed)return;
  window.__tdjTasaBridge174Installed=true;
  const UPPER=v=>String(v??"").trim().toUpperCase();
  const ISO=v=>{const s=String(v??"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!m)return "";let y=m[3];if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;};
  const NUM=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
  const VAL=el=>String(el?.value??el?.getAttribute?.("data-value")??el?.getAttribute?.("value")??"").trim();
  const filas=()=>[...document.querySelectorAll("#tablaTitulos tbody tr")];
  const fila=id=>filas().find(tr=>tr.dataset.tituloId===String(id||""))||null;
  const titulos=()=>filas().map((tr,i)=>({index:i,id:tr.dataset.tituloId||"",tdj:UPPER(tr.querySelector('[data-t="tdj"]')?.value||""),fecha:ISO(VAL(tr.querySelector('.fecha-campo'))||VAL(tr.querySelector('.fecha-native'))||""),valor:NUM(tr.querySelector('[data-t="valor"]')?.value||"")}));
  const cards=()=>[...document.querySelectorAll('#listaObligaciones > .obligacion-card')];
  const campo=(c,k)=>VAL(c?.querySelector(`[data-k="${k}"]`));
  function fechaSancion(c){const ss=['[data-k="fechaSancion"]','[data-k="fechaPresentacion"]','[data-k*="fechaSancion"]','[data-k*="fechaPresentacion"]','[name="fechaSancion"]','[name="fechaPresentacion"]','[id="fechaSancion"]','[id="fechaPresentacion"]'];for(const s of ss){const v=ISO(VAL(c?.querySelector(s)));if(v)return v;}const l=[...(c?.querySelectorAll("label")||[])].find(x=>/FECHA\s*(DE\s*)?SANCI[ÓO]N|FECHA\s*(DE\s*)?PRESENTACI[ÓO]N/i.test(x.textContent||""));return l?ISO(VAL(l.querySelector("input,select,textarea"))):"";}
  const vencimientos=c=>[...(c?.querySelectorAll('.cuotas-mini tbody tr')||[])].map(tr=>ISO(VAL(tr.querySelector('.fecha-campo'))||VAL(tr.querySelector('.fecha-native'))||"")).filter(Boolean);
  function indice(datos){const cs=cards();if(!cs.length)return 0;if(datos?.__tdjObligacionIndex!=null){const i=Number(datos.__tdjObligacionIndex);if(Number.isInteger(i)&&i>=0&&i<cs.length)return i;}if(datos?.id){const i=cs.findIndex(c=>c.dataset.id===String(datos.id));if(i>=0)return i;}const concepto=UPPER(datos?.concepto),anio=String(datos?.anio??""),periodo=String(datos?.periodo??"");let best=0,scoreBest=-1;cs.forEach((c,i)=>{const o={concepto:campo(c,"concepto"),anio:campo(c,"anio"),periodo:campo(c,"periodo"),vencimientos:vencimientos(c)},vf=(Array.isArray(datos?.vencimientos)?datos.vencimientos:[]).map(v=>ISO(v?.fecha||v?.fechaVto||v)).filter(Boolean);let s=0;if(concepto&&concepto===UPPER(o.concepto))s+=5;if(anio&&anio===o.anio)s+=3;if(periodo&&periodo===o.periodo)s+=3;if(vf.length&&o.vencimientos.length)s+=vf.filter(f=>o.vencimientos.includes(f)).length*4;if(vf.length===o.vencimientos.length&&vf.length)s+=3;if(s>scoreBest){scoreBest=s;best=i;}});return best;}
  function tipo(title,i){const tr=fila(title?.id),cell=[...(tr?.querySelectorAll('.tdj-beneficio-visual')||[])][i],sel=cell?.querySelector('select');return UPPER(sel?.value||window.__tdjTasaPorTituloObligacion?.get(`${title?.tdj}|${i}`)||"TASA DIAN")||"TASA DIAN";}
  function tituloPago(p,usados){const ts=titulos(),keys=[p?.tituloId,p?.tdjId,p?.idTitulo,p?.idTDJ,p?.tdj,p?.referenciaTitulo].map(UPPER).filter(Boolean);let t=ts.find(x=>!usados.has(x.id)&&keys.includes(UPPER(x.id)))||ts.find(x=>!usados.has(x.id)&&keys.includes(x.tdj));if(t)return t;const f=ISO(p?.fecha),v=NUM(p?.valor);return ts.find(x=>!usados.has(x.id)&&x.fecha===f&&Math.abs(x.valor-v)<.01)||null;}
  function aplicar(datos,i){const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];if(!pagos.length)return;const usados=new Set();for(const p of pagos){const t=tituloPago(p,usados);if(!t)continue;usados.add(t.id);const x=tipo(t,i);p.tipo=x;p.tipoTasaObligacion=x;p.tdj=t.tdj||p.tdj;p.esTDJ=true;}const r=titulos()[0];if(r)datos.tipoTasa=tipo(r,i);datos.__tdjObligacionIndex=i;}
  function esTDJ(p){return p?.esTDJ===true||String(p?.tdj||"").trim()!=="";}
  function excedenteDePago(resultado,pago){const id=String(pago?.id||"");const fecha=ISO(pago?.fecha||"");const valor=NUM(pago?.valor);const detalle=(resultado?.detalle||[]).find(d=>String(d?.pago?.id||"")===id)||(resultado?.detalle||[]).find(d=>!esTDJ(d?.pago)&&ISO(d?.pago?.fecha||"")===fecha&&Math.abs(NUM(d?.pago?.valor)-valor)<.01);return Math.max(0,NUM(detalle?.excedente??detalle?.aplicado?.excedente));}
  function aplicadoDePago(resultado,pago){const id=String(pago?.id||"");const d=(resultado?.detalle||[]).find(x=>String(x?.pago?.id||"")===id)||(resultado?.detalle||[]).find(x=>String(x?.pago?.tdj||"")===String(pago?.tdj||"")&&ISO(x?.pago?.fecha||"")===ISO(pago?.fecha||""));const a=d?.aplicado;return Math.max(0,NUM(typeof a==='object'&&a!==null?a.total:a));}
  function remanentePrevioMismaFecha(resultado,tdjs,actual){const fecha=ISO(actual?.fecha);if(!fecha)return 0;return tdjs.filter(p=>String(p?.id)!==String(actual?.id)&&ISO(p?.fecha)===fecha).reduce((s,p)=>s+Math.max(0,NUM(p?.valor)-aplicadoDePago(resultado,p)),0);}
  function todosNormalesPosterioresAplicados(resultado,normales){return normales.every(p=>excedenteDePago(resultado,p)<=0.5);}

  function ajustarSecuenciaMismaFecha(motorOriginal,datos,originalCalcular){
    const pagos=Array.isArray(datos?.pagos)?datos.pagos:[];
    const tdjs=pagos.filter(esTDJ).filter(p=>ISO(p?.fecha)&&NUM(p?.valor)>0);
    if(tdjs.length<2)return;
    const actual=tdjs[tdjs.length-1];
    const fechaActual=ISO(actual.fecha);
    if(!fechaActual)return;
    const hayAnteriorMismaFecha=tdjs.slice(0,-1).some(p=>ISO(p?.fecha)===fechaActual);
    if(!hayAnteriorMismaFecha)return;

    const normalesPosteriores=pagos.filter(p=>!esTDJ(p)&&ISO(p?.fecha)>fechaActual&&NUM(p?.valor)>0);
    if(!normalesPosteriores.length)return;

    const valorOriginal=Math.max(0,Math.trunc(NUM(actual.valor)));
    if(valorOriginal<=0)return;
    const todasFechas=pagos.map(p=>ISO(p?.fecha)||"").filter(Boolean);
    const fechaCorteSim=todasFechas.sort().at(-1)||datos?.fechaCorte||fechaActual;
    const simular=(valor)=>{const pagosSim=pagos.map(p=>String(p?.id||"")===String(actual?.id||"")?{...p,valor:Math.max(0,Math.trunc(valor))}:{...p});return originalCalcular.call(motorOriginal,{...datos,pagos:pagosSim,fechaCorte:fechaCorteSim});};

    let resultadoCompleto;try{resultadoCompleto=simular(valorOriginal);}catch{return;}
    if(todosNormalesPosterioresAplicados(resultadoCompleto,normalesPosteriores))return;

    let resultadoCero;try{resultadoCero=simular(0);}catch{return;}

    // CORRECCIÓN 16.33.174: si el título anterior de la misma fecha ya dejó
    // excedente real y ese excedente permite que los pagos posteriores queden
    // íntegramente aplicados, el título actual NO puede consumir hasta $1.000
    // por el único efecto de redondeo. Debe conservarse completo para la
    // siguiente obligación. La regla especial de TDJ <= $1.000 sigue intacta
    // cuando existe deuda real y no existe excedente previo disponible.
    const remanentePrevio=remanentePrevioMismaFecha(resultadoCero,tdjs,actual);
    if(todosNormalesPosterioresAplicados(resultadoCero,normalesPosteriores) && remanentePrevio>0){
      actual.valor=0;
      return;
    }

    // Si incluso sin el TDJ actual los pagos posteriores no pueden cubrirse,
    // no existe una reducción válida que este título pueda realizar.
    if(!todosNormalesPosterioresAplicados(resultadoCero,normalesPosteriores))return;

    let lo=0,hi=valorOriginal,mejor=0;
    for(let k=0;k<40&&lo<=hi;k++){
      const mid=Math.floor((lo+hi)/2);let r;
      try{r=simular(mid);}catch{hi=mid-1;continue;}
      if(todosNormalesPosterioresAplicados(r,normalesPosteriores)){mejor=mid;lo=mid+1;}else hi=mid-1;
    }
    actual.valor=Math.max(0,Math.trunc(mejor));
  }

  function errores0240(tipo,fp,fs){const t=UPPER(tipo),f=ISO(fp),s=ISO(fs),v=[["ART. 20 DECRETO 1474 DE 2025","2025-12-30","2026-03-31",false],["ART. 21 DECRETO 1474 DE 2025","2025-12-30","2026-04-30",true],["ART. 3 DECRETO 0240 DE 2026","2026-03-12","2026-04-30",false],["ART. 4 DECRETO 0240 DE 2026","2026-03-12","2026-04-30",true]].find(x=>t.includes(x[0]));if(!v)return [];const e=[];if(!f)e.push(`El TDJ seleccionado con ${v[0]} debe tener fecha.`);else if(f<v[1]||f>v[2])e.push(`La fecha del TDJ (${f}) está fuera de la vigencia de ${v[0]}. Vigencia permitida: ${v[1]} a ${v[2]}.`);if(v[3]){if(!s)e.push(`Para ${v[0]} debe registrar la fecha de sanción/presentación.`);else if(s<v[1]||s>v[2])e.push(`La fecha de sanción/presentación (${s}) está fuera de la vigencia de ${v[0]}. Vigencia permitida: ${v[1]} a ${v[2]}.`);}return e;}
  function validar(t,i){const c=cards()[i];if(!c)return [];const fp=ISO(VAL(fila(t.id)?.querySelector('.fecha-campo'))||VAL(fila(t.id)?.querySelector('.fecha-native'))||"");const tipoActual=tipo(t,i);return [...validarSeleccion1419({tipo:tipoActual,fechasVencimiento:vencimientos(c),fechaPresentacion:fechaSancion(c),fechaPago:fp,fechaTitulo:fp,esTitulo:true}),...errores0240(tipoActual,fp,fechaSancion(c))];}
  function validarAntes(i){const e=[];for(const t of titulos()){const x=tipo(t,i);if(x!=="TASA DIAN")e.push(...validar(t,i).map(m=>`TDJ ${t.tdj||t.index+1}: ${m}`));}if(e.length)throw new Error("BENEFICIO NO VÁLIDO:\n\n"+e.join("\n"));}
  function instalarRestricciones(){document.addEventListener("focusin",e=>{const s=e.target?.closest?.('#tablaTitulos select.tdj-beneficio-select');if(s&&!s.dataset.tdjPrev)s.dataset.tdjPrev=s.value||"TASA DIAN";},true);document.addEventListener("change",e=>{const s=e.target?.closest?.('#tablaTitulos select.tdj-beneficio-select');if(!s)return;const tr=s.closest('tr'),t={id:tr?.dataset?.tituloId||"",tdj:tr?.querySelector('[data-t="tdj"]')?.value||""},cells=[...tr.querySelectorAll('.tdj-beneficio-visual')],i=cells.indexOf(s.closest('.tdj-beneficio-visual')),prev=s.dataset.tdjPrev||"TASA DIAN";if(i<0)return;const errores=validar(t,i);if(errores.length){s.value=prev;s.dataset.tdjPrev=prev;alert("NO ES POSIBLE APLICAR EL BENEFICIO SELECCIONADO:\n\n"+errores.join("\n\n"));return;}s.dataset.tdjPrev=s.value||"TASA DIAN";window.dispatchEvent(new CustomEvent("tdj-tasa-selection-changed",{detail:{titleId:t.id,index:i,tipo:s.value}}));},true);}
  function patch(Clase){if(!Clase?.prototype?.calcular)return;const p=Clase.prototype,o=p.calcular;if(o.__tdj174)return;function calc(datos,...rest){const i=indice(datos);validarAntes(i);aplicar(datos,i);ajustarSecuenciaMismaFecha(this,datos,o);return o.call(this,datos,...rest);}calc.__tdj174=true;p.calcular=calc;}
  patch(MotorLiquidacion);patch(MotorLiquidacionOficial);instalarRestricciones();window.__tdjTasaBridge174Ready=true;
})();
