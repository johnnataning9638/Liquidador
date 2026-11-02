import {capturarMuisca} from './muisca.js';
const ORIGEN='https://liquidador-de-obligaciones-tributarias.onrender.com';
chrome.runtime.onMessage.addListener((mensaje,sender,responder)=>{
 if(mensaje?.tipo!=='LEER_MUISCA_273')return;
 let url;try{url=new URL(sender.url);}catch{return;}
 if(sender.frameId!==0||url.origin!==ORIGEN||!['/liquidacion.html','/titulos.html'].includes(url.pathname))return;
 (async()=>{
  const tabs=await chrome.tabs.query({url:'https://muisca.dian.gov.co/WebRecaudacion/DefConsultaObligacion.faces*'});
  if(!tabs.length)throw Error('Abra en DIAN el detalle de la obligación que desea importar.');
  if(tabs.length!==1)throw Error('Hay varias consultas DIAN abiertas. Deje abierta solo la obligación que desea importar.');
  const [salida]=await chrome.scripting.executeScript({target:{tabId:tabs[0].id},func:capturarMuisca});
  if(salida?.error)throw Error(salida.error.message||'No se pudo leer la consulta DIAN.');
  if(salida?.result?.errorLectura)throw Error(salida.result.errorLectura);
  if(!salida?.result)throw Error('La consulta DIAN no entregó información.');return salida.result;
 })().then(datos=>responder({datos}),e=>responder({error:e.message||'No fue posible leer la obligación DIAN.'}));
 return true;
});
