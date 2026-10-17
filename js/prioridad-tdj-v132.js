// CAPA DE SECUENCIA / IDEMPOTENCIA TDJ — v16.33.148
//
// La lógica económica permanece en prioridad-tdj.js v16.33.148.
// Esta capa reinicia exclusivamente el estado de secuencia al iniciar una
// liquidación completa y conserva las correcciones de presentación existentes.
//
// CORRECCIÓN TDJ v16.33.148:
// Un título que encuentra una obligación ya cerrada se anula SOLO para esa
// obligación, permitiendo que la capa superior conserve el valor disponible
// y continúe inmediatamente con la siguiente obligación.
import {dinero} from "./utilidades.js?v=16.33.148";
import {
  ajustarTDJParaPagosPosteriores as ajustarBase,
  ordenarMovimientosCronologicos,
  reiniciarSecuenciaTDJ
} from "./prioridad-tdj.js?v=16.33.148";

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

instalarPresentacionSaldoFinalRian();
instalarLimpiezaExclusivaTitulosTDJ();

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!opciones?.soloTDJId) reiniciarSecuenciaTDJ();
  return ajustarBase(motor,datos,opciones);
}

export {ordenarMovimientosCronologicos};
export {reiniciarSecuenciaTDJ};
