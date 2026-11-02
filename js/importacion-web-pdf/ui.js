import {leerPDF} from './pdf.js';
import {leerWeb} from './web.js';

// Archivo transitorio compartido entre pestañas. Nunca se escribe en almacenamiento.
let adjunto=null, revision=0,ocupado=false;
const esTDJ=location.pathname.endsWith('/titulos.html');
const campos=[...(esTDJ?document.querySelectorAll('#importarObligacionTexto,#importarPagosTexto,#importarTitulosTexto'):document.querySelectorAll('#pegarDatosObligacion,#pegarDatos'))];
const bridge=()=>{
 const script=document.querySelector(esTDJ?'script[src^="js/tdj.js?"]':'script[src^="js/app.js?"]');
 const version=script&&new URL(script.src).searchParams.get('v');
 if(!version)throw Error('No se identificó la versión del liquidador. Recargue la página.');
 // Compartir la misma instancia del módulo actual, también en versiones futuras.
 return import(new URL(`../${esTDJ?'tdj-core-16.33.143.js':'app.js'}?v=${encodeURIComponent(version)}`,import.meta.url).href);
};
function estado(texto,error=false){
 document.querySelectorAll('.wpdf-estado').forEach(el=>{el.textContent=texto;el.classList.toggle('wpdf-error',error);});
}
function soltar(){
 revision++;
 if(adjunto){const {campo}=adjunto;campo.value='';campo.readOnly=false;campo.removeAttribute('data-pdf-adjunto');}
 adjunto=null;
 document.querySelectorAll('.wpdf-quitar').forEach(b=>b.hidden=true);
}
function adjuntar(file,campo){
 if(!file||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf')){estado('Arrastre un Generador de Cuotas en PDF.',true);return;}
 if(file.size>20*1024*1024){estado('El PDF debe pesar como máximo 20 MB.',true);return;}
 soltar();adjunto={file,campo};campo.value='PDF adjunto: '+file.name+'\nPulse Importar web - PDF para leerlo.';campo.readOnly=true;campo.dataset.pdfAdjunto='true';
 document.querySelectorAll('.wpdf-quitar').forEach(b=>b.hidden=false);
 estado('PDF pendiente. Todavía no se han cambiado los datos.');
}
async function importar(){
 if(ocupado)return;
 const turno=revision,archivo=adjunto?.file;
 ocupado=true;document.querySelectorAll('.wpdf-trigger').forEach(b=>b.disabled=true);
 estado(archivo?'Leyendo PDF en este equipo…':'Leyendo la obligación abierta en DIAN…');
 try{
  const fuente=archivo?await leerPDF(archivo):await leerWeb();
  if(turno!==revision)return;
  const api=await bridge();if(turno!==revision)return;
  const pane=document.querySelector('.tab-pane.active')?.dataset.pane;
  const selector=pane==='pagos'?'destinoImportacionPagos':pane==='datos'?'destinoImportacionObligacion':null;
  let destino=selector?document.getElementById(selector)?.value||'':'';
  if(esTDJ&&!selector){
   const elegidos=[...new Set(['destinoImportacionObligacion','destinoImportacionPagos'].map(id=>document.getElementById(id)?.value).filter(Boolean))];
   if(elegidos.length>1)throw Error('Hay destinos distintos en Datos y Pagos. Seleccione la misma obligación antes de importar desde Títulos.');
   destino=elegidos[0]||'';
  }
  const resumen=api.aplicarImportacionWebPDF273(fuente,destino);
  if(archivo)soltar();
  estado(`Importación lista: ${resumen.cuotas} cuota(s), ${resumen.sancion?'sanción reconocida, ':''}${resumen.pagosNuevos} pago(s) nuevo(s), ${resumen.pagosOmitidos} repetido(s) omitido(s). Revise los datos antes de calcular.`);
 }catch(e){if(turno===revision)estado(e.message||'No se pudo importar la información.',true);}
 finally{ocupado=false;document.querySelectorAll('.wpdf-trigger').forEach(b=>b.disabled=false);}
}
campos.forEach(campo=>{
 campo.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
 campo.addEventListener('drop',e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();e.stopImmediatePropagation();if(e.dataTransfer.files.length!==1){estado('Adjunte un PDF a la vez.',true);return;}adjuntar(e.dataTransfer.files[0],campo);},true);
 campo.placeholder+=' También puede arrastrar aquí el PDF del Generador de Cuotas y pulsar Importar web - PDF.';
});
// Antes del aislamiento de pegado de TDJ; los textos siguen su ruta habitual.
window.addEventListener('paste',e=>{
 if(!campos.includes(e.target))return;
 const files=e.clipboardData?.files;
 if(files?.length){e.preventDefault();e.stopImmediatePropagation();if(files.length===1)adjuntar(files[0],e.target);else estado('Adjunte un PDF a la vez.',true);}
 else if(e.target.hasAttribute('data-pdf-adjunto')){e.preventDefault();e.stopImmediatePropagation();estado('Retire primero el PDF para pegar texto.',true);}
},true);
document.querySelectorAll('.tab-pane').forEach(pane=>{
 const barra=pane.querySelector('.botonera');if(!barra)return;
 const boton=document.createElement('button');boton.type='button';boton.className='secundario grande wpdf-trigger';boton.textContent='Importar web - PDF';boton.addEventListener('click',importar);barra.prepend(boton);
 const ayuda=document.createElement('div');ayuda.className='wpdf-ayuda';
 const mensaje=document.createElement('span');mensaje.className='wpdf-estado';mensaje.setAttribute('role','status');mensaje.setAttribute('aria-live','polite');mensaje.textContent='Arrastre el PDF en «Pegue aquí». Sin PDF, se consultará la obligación abierta en DIAN.';
 const quitar=document.createElement('button');quitar.type='button';quitar.className='secundario wpdf-quitar';quitar.textContent='Quitar PDF';quitar.hidden=true;quitar.addEventListener('click',()=>{soltar();estado('PDF retirado.');});
 const instrucciones=document.createElement('a');instrucciones.href='descargas/puente-dian-273.zip';instrucciones.textContent='Complemento para importar desde DIAN';instrucciones.setAttribute('download','');
 ayuda.append(mensaje,quitar,instrucciones);barra.before(ayuda);
});
// Captura antes del importador previo: con archivo adjunto, solo lo descarta.
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(adjunto&&['btnProcesarDatosObligacion','btnProcesarPegado','btnImportar','btnImportarObligacionTDJ','btnImportarPagosTDJ','btnProcesarImportTitulos'].includes(b.id)){
  e.preventDefault();e.stopImmediatePropagation();soltar();estado('PDF retirado. Para importarlo utilice Importar web - PDF.');
 }
 if(b.matches('.btn-limpiar-normal,.btn-limpiar-tdj,#btnLimpiarTitulosGlobal')){soltar();estado('');}
},true);
// DIAN comparte su recuadro de obligación con Resultados: mismo elemento y eventos.
if(!esTDJ){
 const panel=document.querySelector('.importador-obligacion-panel'),destino=document.querySelector('[data-pane="resultados"] .tab-pane-inner');
 if(panel&&destino){
  const origen=document.createComment('ubicación del recuadro de importación');panel.before(origen);
  const mover=()=>{const resultados=document.querySelector('[data-pane="resultados"]').classList.contains('active');if(resultados&&panel.parentNode!==destino)destino.prepend(panel);else if(!resultados&&panel.previousSibling!==origen)origen.after(panel);};
  new MutationObserver(mover).observe(document.querySelector('main')||document.body,{subtree:true,attributes:true,attributeFilter:['class']});mover();
 }
}
