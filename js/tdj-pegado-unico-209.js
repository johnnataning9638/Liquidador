// v16.33.219: aislamiento absoluto del pegado en el área de importación TDJ.
// El texto del portapapeles se refleja UNA sola vez, sin transformaciones
// ni multiplicación por la cantidad de obligaciones existentes.
export function procesarPegadoTitulosTDJ(evento){
  const el=evento?.target;
  if(!el||el.id!=="importarTitulosTexto")return false;
  const clip=evento.clipboardData?.getData("text/plain");
  if(typeof clip!=="string")return false;
  evento.preventDefault();
  evento.stopImmediatePropagation();
  evento.stopPropagation();
  // La importación es incremental; el cuadro de texto es exclusivamente
  // una vista previa del último bloque pegado, NO un acumulador de pegados.
  el.value=clip;
  const fin=clip.length;
  if(typeof el.setSelectionRange==="function")el.setSelectionRange(fin,fin);
  return true;
}
export function instalarPegadoUnicoTitulosTDJ(documento=globalThis.document){
  if(!documento||documento.defaultView?.__tdjPegadoUnico219)return;
  const ventana=documento.defaultView;
  if(!ventana)return;
  ventana.__tdjPegadoUnico219=true;
  // Capturar ANTES del documento, área u otros handlers registrados
  // por obligación. Impide transformaciones de valores y repeticiones.
  ventana.addEventListener("paste",procesarPegadoTitulosTDJ,true);
}
