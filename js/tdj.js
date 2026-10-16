// TDJ v16.33.144 — barrera física contra módulos cacheados.
(function(){
  document.addEventListener("click",function(e){
    var b=e.target && e.target.closest ? e.target.closest("#btnLimpiarTitulosGlobal") : null;
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(!window.confirm("¿Desea iniciar una nueva liquidación de títulos? Se borrarán datos, pagos, títulos y resultados."))return;
    window.location.replace("titulos.html?v=16.33.144&reinicio="+Date.now());
  },true);
})();

// El motor original se conserva íntegramente en un blob con ruta física nueva.
import("./tdj-core-16.33.143.js");
