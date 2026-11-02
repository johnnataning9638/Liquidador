import {validarEntrada} from './modelo.js';
export function leerWeb({timeout=12000}={}){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();let timer;
  const terminar=()=>{clearTimeout(timer);window.removeEventListener('message',respuesta);};
  const respuesta=e=>{
   if(e.source!==window||e.origin!==location.origin||e.data?.tipo!=='LIQUIDADOR_MUISCA_RESPUESTA_273'||e.data.id!==id)return;
   terminar();if(e.data.error)return reject(Error(String(e.data.error).slice(0,300)));
   try{resolve(validarEntrada(e.data.datos));}catch(err){reject(err);}
  };
  window.addEventListener('message',respuesta);
  timer=setTimeout(()=>{terminar();reject(Error('Para leer la página de DIAN, active el complemento de importación y mantenga abierta una sola pestaña de la obligación.'));},timeout);
  window.postMessage({tipo:'LIQUIDADOR_MUISCA_SOLICITUD_273',id},location.origin);
 });
}
