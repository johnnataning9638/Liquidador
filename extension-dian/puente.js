// Un solo pedido por clic real en el botón del liquidador. No realiza capturas periódicas.
(()=>{
 const ORIGEN='https://liquidador-de-obligaciones-tributarias.onrender.com';let permisoHasta=0;
 document.addEventListener('click',e=>{if(e.isTrusted&&e.target.closest?.('.wpdf-trigger'))permisoHasta=Date.now()+5000;},true);
 window.addEventListener('message',e=>{
  if(e.source!==window||e.origin!==ORIGEN||e.data?.tipo!=='LIQUIDADOR_MUISCA_SOLICITUD_273'||typeof e.data.id!=='string')return;
  if(Date.now()>permisoHasta)return;permisoHasta=0;const id=e.data.id;
  chrome.runtime.sendMessage({tipo:'LEER_MUISCA_273'}).then(r=>window.postMessage({tipo:'LIQUIDADOR_MUISCA_RESPUESTA_273',id,...r},ORIGEN),()=>window.postMessage({tipo:'LIQUIDADOR_MUISCA_RESPUESTA_273',id,error:'No se pudo contactar el complemento DIAN.'},ORIGEN));
 });
})();
