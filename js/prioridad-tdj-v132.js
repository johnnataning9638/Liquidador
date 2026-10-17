// CAPA DE SECUENCIA / IDEMPOTENCIA TDJ — v16.33.156
//
// La lógica económica permanece en prioridad-tdj.js.
// Esta capa controla únicamente la secuencia entre títulos y conserva las
// correcciones de presentación existentes.
//
// REGLA FUNCIONAL v16.33.156:
// PRIMERO SE AGOTA LA NECESIDAD DE LA OBLIGACIÓN ACTUAL; SOLO CUANDO ESTA
// QUEDA CUBIERTA, EL TÍTULO PUEDE CONTINUAR CON LA SIGUIENTE OBLIGACIÓN.
import {dinero} from "./utilidades.js?v=16.33.156";
import {
  ajustarTDJParaPagosPosteriores as ajustarBase,
  ordenarMovimientosCronologicos,
  reiniciarSecuenciaTDJ
} from "./prioridad-tdj.js?v=16.33.156";

export function saldoFinalSinIntereses(impuesto=0,sancion=0){
  const i=Number(impuesto||0),s=Number(sancion||0);
  return Math.max(0,(Number.isFinite(i)?i:0)+(Number.isFinite(s)?s:0));
}

function leerSaldoFinalRian(){
  if(typeof document==="undefined")return null;
  const impuesto=Number(document.getElementById("rSaldoImpuesto")?.textContent?.replace(/[^0-9-]/g,"")||0);
  const sancion=Number(document.getElementById("rSaldoSancion")?.textContent?.replace(/[^0-9-]/g,"")||0);
  const tieneImpuesto=document.getElementById("rSaldoImpuesto");
  const tieneSancion=document.getElementById("rSaldoSancion");
  if(!tieneImpuesto&&!tieneSancion)return null;
  return saldoFinalSinIntereses(impuesto,sancion);
}

function actualizarSaldoFinalRian(){
  if(typeof document==="undefined")return;
  const saldo=leerSaldoFinalRian();
  if(saldo==null)return;
  const texto=dinero(saldo);
  ["rSaldoTotal","rSaldoTotalFooter"].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el.textContent!==texto)el.textContent=texto;
  });
}

function instalarPresentacionSaldoFinalRian(){
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__saldoFinalRian134)return;

  window.__saldoFinalRian134=true;
  const iniciar=()=>{
    actualizarSaldoFinalRian();
    const targets=[document.getElementById("rSaldoImpuesto"),document.getElementById("rSaldoSancion"),document.getElementById("rSaldoTotal")].filter(Boolean);
    if(typeof MutationObserver!=="undefined"&&targets.length){
      const observer=new MutationObserver(()=>actualizarSaldoFinalRian());
      targets.forEach(el=>observer.observe(el,{childList:true,characterData:true,subtree:true}));
    }
    const openOriginal=window.open;
    if(typeof openOriginal!=="function")return;
    window.open=function(...args){
      const child=openOriginal.apply(this,args);
      try{
        if(!child?.document)return child;
        const writeOriginal=child.document.write.bind(child.document);
        child.document.write=function(html){
          try{
            const saldo=leerSaldoFinalRian();
            if(saldo!=null){
              const texto=dinero(saldo);
              html=String(html).replace(/(<b>SALDO TOTAL FINAL<\/b><strong>)[\s\S]*?(<\/strong>)/,`$1${texto}$2`);
            }
          }catch(e){console.warn("Presentación SALDO TOTAL FINAL:",e);}
          return writeOriginal(html);
        };
      }catch(e){console.warn("No se pudo preparar el soporte PDF:",e);}
      return child;
    };
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
}

function instalarLimpiezaExclusivaTitulosTDJ(){
  if(typeof document==="undefined"||typeof window==="undefined")return;
  if(window.__tdjLimpiarTitulos137)return;
  window.__tdjLimpiarTitulos137=true;
  document.addEventListener("click",e=>{
    const boton=e.target?.closest?.(".btn-limpiar-tdj");
    if(!boton)return;
    const pane=boton.closest(".tab-pane");
    if(pane?.dataset?.pane!=="titulos")return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(!window.confirm("¿Desea limpiar únicamente los títulos / TDJ registrados?"))return;
    let guard=0;
    while(guard++<10000){
      const del=document.querySelector("#tablaTitulos tbody [data-del]");
      if(!del)break;
      del.click();
    }
    const importar=document.getElementById("importarTitulosTexto");
    if(importar)importar.value="";
    const resultadoImportacion=document.getElementById("resultadoImportacionTitulos");
    if(resultadoImportacion)resultadoImportacion.textContent="";
    const resultado=document.getElementById("resultadoTDJ");
    if(resultado)resultado.hidden=true;
    const tbody=document.querySelector("#tablaTitulos tbody");
    if(tbody)tbody.innerHTML="";
  },true);
}

function tituloActual(datos,idActual){
  return (datos?.pagos||[]).find(p=>String(p?.id||"")===String(idActual||""))||null;
}

function obligacionYaCubiertaAntesDelTitulo(motor,datos,idActual){
  if(!motor||typeof motor.calcular!=="function")return false;
  const actual=tituloActual(datos,idActual);
  if(!actual||!String(actual.fecha||""))return false;
  const fechaActual=String(actual.fecha).slice(0,10);
  const previos=(datos?.pagos||[]).filter(p=>String(p?.id||"")!==String(idActual||""))
    .filter(p=>p?.fecha&&String(p.fecha).slice(0,10)<=fechaActual)
    .filter(p=>Number(p?.valor||0)>0);
  if(!previos.length)return false;
  try{
    const r=motor.calcular({...datos,pagos:previos});
    return Number(r?.total||0)<=0.5;
  }catch(e){
    console.warn("Secuencia TDJ v16.33.156:",e);
    return false;
  }
}

instalarPresentacionSaldoFinalRian();
instalarLimpiezaExclusivaTitulosTDJ();

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!opciones?.soloTDJId) reiniciarSecuenciaTDJ();

  const idActual=opciones?.soloTDJId||"";
  if(idActual && obligacionYaCubiertaAntesDelTitulo(motor,datos,idActual)){
    // IMPORTANTE: se anula únicamente la representación del título dentro de
    // esta obligación, pero la secuencia base también recibe esta fotografía.
    // Así puede reconocer el cierre y avanzar el cursor antes de que la capa
    // superior intente la misma disponibilidad contra la siguiente obligación.
    const pagos=(datos?.pagos||[]).map(p=>
      String(p?.id||"")===String(idActual)
        ? {...p,valor:0}
        : {...p}
    );
    return ajustarBase(motor,{...datos,pagos},opciones);
  }

  return ajustarBase(motor,datos,opciones);
}

export {ordenarMovimientosCronologicos};
export {reiniciarSecuenciaTDJ};
