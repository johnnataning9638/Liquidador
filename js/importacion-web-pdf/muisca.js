// Función autocontenida: el complemento la ejecuta en la pestaña DIAN autorizada.
// Solo lee campos y tablas del DOM. No accede a cookies, contraseñas ni solicitudes internas.
export function capturarMuisca(){
 try{
 if(location.origin!=='https://muisca.dian.gov.co'||location.pathname!=='/WebRecaudacion/DefConsultaObligacion.faces')throw Error('Abra el detalle de una obligación en la consulta financiera DIAN.');
 const prefijo='vistaConsultaObligacion:frmConsultaObligacion:';
 const nit=document.getElementById(prefijo+'txtNit')?.value?.trim()||'',razonSocial=document.getElementById(prefijo+'txtRazonSocial')?.value?.trim()||'';
 const form=document.getElementById('vistaConsultaObligacion:frmConsultaObligacion');if(!form)throw Error('No se encontró la consulta de obligación.');
 const texto=form.innerText||'',normal=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const valor=re=>normal.match(re)?.[1]?.trim()||'';
 const numeroObligacion=valor(/No\.?\s*Obligacion\s*:\s*(\d+)/i),anio=valor(/Ano\s*Gravable\s*:\s*(\d{4})/i),periodo=valor(/Periodo\s*:\s*(\d{1,2})/i);
 const fechaDeclarar=valor(/Vencimiento\s*para\s*Declarar\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);
 const concepto=valor(/Tipo\s*Obligacion\s*:\s*([^\n\r]+)/i);
 if(!numeroObligacion||!anio||!periodo||!concepto)throw Error('La página no muestra el detalle de una obligación. Ábralo antes de importar.');
 const tabla=document.getElementById(prefijo+'tblDocumentosFuente');if(!tabla)throw Error('Abra Documentos Fuente antes de importar.');
 const filas=[...tabla.rows].map(tr=>[...tr.cells].map(c=>c.innerText.trim()));
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
 const header=filas.findIndex(r=>r.some(c=>norm(c)==='VALOR PAGADO'));
 if(header<0)throw Error('No se identificó la tabla de documentos fuente.');
 const h=filas[header].map(norm),idx=re=>h.findIndex(x=>re.test(x));
 const doc=idx(/DOCUMENTO FUENTE/),fecha=idx(/FECHA PRESENTACION/),tipo=idx(/NOMBRE FORMATO/),importe=idx(/VALOR PAGADO/);
 if([doc,fecha,tipo,importe].some(i=>i<0))throw Error('Faltan columnas de pagos en la página DIAN.');
 const pagos=[];
 for(const fila of filas.slice(header+1)){
  if(!norm(fila[tipo]||'').includes('RECIBO OFICIAL DE PAGO'))continue;
  if(!fila[importe])throw Error('Hay un recibo sin valor pagado visible. Revíselo antes de importar.');
  pagos.push({recibo:(fila[doc]||'').replace(/\s/g,''),fecha:fila[fecha],valor:fila[importe]});
 }
 const entorno=tabla.parentElement;
 const paginacionPendiente=[...(entorno?.querySelectorAll('a,button,input[type=button],input[type=image]')||[])].some(el=>{
  const etiqueta=norm([el.innerText,el.title,el.getAttribute('aria-label'),el.getAttribute('alt'),el.value].filter(Boolean).join(' '));
  return el.getClientRects().length&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&!/DESHABILIT|DISABLED/.test(el.className||'')&&/\b(SIGUIENTE|NEXT)\b/.test(etiqueta);
 });
 return {fuente:'WEB_MUISCA',nit,razonSocial,numeroObligacion,anio,periodo,concepto,fechaDeclarar,pagos,paginacionPendiente};
 }catch(e){return {errorLectura:e.message||'No se pudo interpretar la obligación abierta.'};}
}
