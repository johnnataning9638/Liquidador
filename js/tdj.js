// TDJ v16.33.177 — navegación TAB + tasa individual + restricciones + secuencia/reconciliación.
// Las capas de secuencia se cargan de forma estática para eliminar la carrera
// de módulos que podía dejar la trazabilidad en un estado diferente al PDF.
import "./tdj-tasa-bridge-16.33.174.js?v=16.33.174";
import "./tdj-secuencia-guard-16.33.177.js?v=16.33.177";

(function(){
  function omitirObservacion(){document.querySelectorAll('#tablaTitulos tbody [data-t="observacion"]').forEach(function(el){el.tabIndex=-1;});}
  function enfocar(el){if(!el)return;setTimeout(function(){try{el.focus({preventScroll:true});}catch(_){try{el.focus();}catch(__){}}if(typeof el.select==='function'&&el.tagName!=='SELECT'){try{el.select();}catch(_) {}}},0);}
  document.addEventListener('DOMContentLoaded',omitirObservacion,{once:true});
  document.addEventListener('focusin',omitirObservacion,true);
  document.addEventListener('keydown',function(e){if(e.key!=='Tab')return;const el=e.target;if(!el||!el.closest||!el.closest('#tablaTitulos'))return;if(!el.matches('[data-t="tdj"], .fecha-campo, [data-t="valor"]'))return;omitirObservacion();const tr=el.closest('tbody tr');if(!tr)return;const tbody=tr.parentElement;if(!tbody)return;const filas=[...tbody.querySelectorAll('tr')],filaActual=filas.indexOf(tr);const campos=[tr.querySelector('[data-t="tdj"]'),tr.querySelector('.fecha-campo'),tr.querySelector('[data-t="valor"]')].filter(Boolean),posicion=campos.indexOf(el);if(posicion<0)return;const paso=e.shiftKey?-1:1;let destino=null;if(posicion+paso>=0&&posicion+paso<campos.length)destino=campos[posicion+paso];else if(paso>0&&posicion===campos.length-1)destino=filas[filaActual+1]?.querySelector('[data-t="tdj"]')||null;else if(paso<0&&posicion===0)destino=filas[filaActual-1]?.querySelector('[data-t="valor"]')||null;if(destino){e.preventDefault();e.stopImmediatePropagation();enfocar(destino);}},true);
})();
(function(){
  document.addEventListener("DOMContentLoaded",function(){var footer=document.querySelector("footer");if(footer)footer.textContent=footer.textContent.replace(/v16\\.33\\.(163|164|165|166|167|168|169|170|171|172|174|175|176)/g,"v16.33.177");},{once:true});
  document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("#btnLimpiarTitulosGlobal"):null;if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!window.confirm("¿Desea iniciar una nueva liquidación de títulos? Se borrarán datos, pagos, títulos y resultados."))return;window.location.replace("titulos.html?v=16.33.177&reinicio="+Date.now());},true);
})();
// Motor histórico protegido; no se modifica su contenido.
import("./tdj-core-16.33.143.js?v=16.33.177");
// Capa visual TDJ × OBLIGACIÓN.
import("./tdj-visual-beneficios.js?v=16.33.177");
