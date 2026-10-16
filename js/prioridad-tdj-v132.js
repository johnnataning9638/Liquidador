// CAPA DE IDEMPOTENCIA TDJ — v16.33.134
//
// La lógica de prioridad económica permanece en prioridad-tdj.js v16.33.133.
// Esta capa reinicia exclusivamente el estado de secuencia al iniciar una
// liquidación completa. Así, pulsar CALCULAR LIQUIDACIÓN repetidamente con
// los mismos datos produce exactamente el mismo resultado.
//
// CORRECCIÓN INDEPENDIENTE RIAN — SALDO TOTAL FINAL:
// La presentación de SALDO TOTAL FINAL debe excluir INTERESES y mostrar
// únicamente IMPUESTO + SANCIÓN pendientes, igual que el criterio ya aplicado
// en TDJ. Esta corrección actúa solo sobre presentación; no modifica el motor,
// proporcionalidad, intereses, sanciones, endoso ni saldos internos.
import {dinero} from "./utilidades.js?v=16.33.134";
import {
  ajustarTDJParaPagosPosteriores as ajustarBase,
  ordenarMovimientosCronologicos,
  reiniciarSecuenciaTDJ
} from "./prioridad-tdj.js?v=16.33.133";

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

    // El soporte PDF del Liquidador normal construye el resumen en una ventana
    // nueva. Se ajusta exclusivamente la celda "SALDO TOTAL FINAL" antes de
    // escribir el HTML, sin tocar las demás cifras del soporte.
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
          }catch(e){console.warn("Presentación SALDO TOTAL FINAL RIAN:",e);}
          return writeOriginal(html);
        };
      }catch(e){console.warn("No se pudo preparar el soporte PDF RIAN:",e);}
      return child;
    };
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
}

instalarPresentacionSaldoFinalRian();

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!opciones?.soloTDJId) reiniciarSecuenciaTDJ();
  return ajustarBase(motor,datos,opciones);
}

export {ordenarMovimientosCronologicos};
export {reiniciarSecuenciaTDJ};
