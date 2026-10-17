// TDJ v16.33.167 — tasa individual por título y obligación + cache busting.
(function(){
  document.addEventListener("DOMContentLoaded",function(){
    var footer=document.querySelector("footer");
    if(footer)footer.textContent=footer.textContent.replace(/v16\.33\.163/g,"v16.33.167").replace(/v16\.33\.164/g,"v16.33.167").replace(/v16\.33\.165/g,"v16.33.167").replace(/v16\.33\.166/g,"v16.33.167");
  },{once:true});

  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest("#btnLimpiarTitulosGlobal"):null;
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(!window.confirm("¿Desea iniciar una nueva liquidación de títulos? Se borrarán datos, pagos, títulos y resultados."))return;
    window.location.replace("titulos.html?v=16.33.167&reinicio="+Date.now());
  },true);
})();

// Motor de cálculo: archivo histórico protegido; únicamente se actualiza
// el querystring para impedir que el navegador reutilice módulos anteriores.
import("./tdj-core-16.33.143.js?v=16.33.167");

// Capa visual + puente aislado de tasa individual TDJ × OBLIGACIÓN.
// No reemplaza el motor ni altera la lógica cronológica de imputación.
import("./tdj-visual-beneficios.js?v=16.33.167");
