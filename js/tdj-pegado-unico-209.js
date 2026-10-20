// TDJ 209: el cuadro de PEGAR conserva el contenido exacto del portapapeles.
// No modifica los importadores ni las filas ya registradas.
const ultimosPegados=new WeakMap();
export function procesarPegadoTitulosTDJ(evento,ahora=Date.now()){
  const el=evento?.target;
  if(!el||el.id!=="importarTitulosTexto")return false;
  const clip=evento.clipboardData?.getData("text/plain");
  if(typeof clip!=="string")return false;
  evento.preventDefault();
  evento.stopImmediatePropagation?.();
  evento.stopPropagation?.();
  const previo=ultimosPegados.get(el);
  // Algunos entornos emiten dos eventos del MISMO pegado en el mismo instante.
  if(previo&&previo.texto===clip&&ahora-previo.instante<120)return true;
  const ini=Number.isInteger(el.selectionStart)?el.selectionStart:el.value.length;
  const fin=Number.isInteger(el.selectionEnd)?el.selectionEnd:ini;
  const viejo=String(el.value||"");
  el.value=viejo.slice(0,ini)+clip+viejo.slice(fin);
  const cursor=ini+clip.length;
  if(typeof el.setSelectionRange==="function")el.setSelectionRange(cursor,cursor);
  ultimosPegados.set(el,{texto:clip,instante:ahora});
  el.dispatchEvent?.(new Event("input",{bubbles:true,inputType:"insertFromPaste"}));
  return true;
}
export function instalarPegadoUnicoTitulosTDJ(documento=globalThis.document){
  if(!documento||documento.__tdjPegadoUnico209)return;
  documento.__tdjPegadoUnico209=true;
  documento.addEventListener("paste",procesarPegadoTitulosTDJ,true);
}
