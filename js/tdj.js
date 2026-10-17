// TDJ v16.33.164 — barrera física contra módulos cacheados + capa visual aislada.
(function(){
  document.addEventListener("DOMContentLoaded",function(){
    var footer=document.querySelector("footer");
    if(footer)footer.textContent=footer.textContent.replace(/v16\.33\.163/g,"v16.33.164");
  },{once:true});

  document.addEventListener("click",function(e){
    var b=e.target && e.target.closest ? e.target.closest("#btnLimpiarTitulosGlobal") : null;
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(!window.confirm("¿Desea iniciar una nueva liquidación de títulos? Se borrarán datos, pagos, títulos y resultados."))return;
    window.location.replace("titulos.html?v=16.33.164&reinicio="+Date.now());
  },true);
})();

// El motor original se conserva íntegramente; el querystring fuerza la
// revalidación del módulo para evitar que el navegador reutilice una versión
// anterior del motor TDJ.
import("./tdj-core-16.33.143.js?v=16.33.164");

// Capa exclusivamente visual: genera las columnas OBLIGACIÓN 1..N y sus
// listas de beneficio por cada título. No modifica el estado del motor.
import("./tdj-visual-beneficios.js?v=16.33.164");
