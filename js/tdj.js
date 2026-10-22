import {instalarPegadoUnicoTitulosTDJ} from "./tdj-pegado-unico-209.js?v=16.33.219";
instalarPegadoUnicoTitulosTDJ();
// TDJ v16.33.212 — navegación TAB + tasa individual + restricciones + secuencia/reconciliación + cierre PDF + recuperación de beneficios Excel + identidad estable por obligación + resolución robusta de contexto + remanente antes de endoso + silencio de alerta falsa de endoso.
// Las capas de secuencia se cargan de forma estática para eliminar la carrera
// de módulos que podía dejar la trazabilidad en un estado diferente al PDF.
import "./tdj-tasa-bridge-16.33.174.js?v=16.33.212";
import "./tdj-secuencia-guard-16.33.185.js?v=16.33.185";
import "./tdj-pdf-cierre-16.33.189.js?v=16.33.215";
import "./tdj-import-beneficio-16.33.192.js?v=16.33.210";
import "./tdj-fecha-corte-sin-pagos-16.33.193.js?v=16.33.193";
import "./tdj-beneficio-contexto-16.33.194.js?v=16.33.194";
import "./tdj-obligacion-identity-16.33.195.js?v=16.33.195";
import "./tdj-obligacion-contexto-16.33.196.js?v=16.33.196";
import "./tdj-obligacion-contexto-16.33.197.js?v=16.33.210";

(function(){
  function omitirObservacion(){document.querySelectorAll('#tablaTitulos tbody [data-t="observacion"]').forEach(function(el){el.tabIndex=-1;});}
  function enfocar(el){if(!el)return;setTimeout(function(){try{el.focus({preventScroll:true});}catch(_){try{el.focus();}catch(__){}}if(typeof el.select==='function'&&el.tagName!=='SELECT'){try{el.select();}catch(_) {}}},0);}
  document.addEventListener('DOMContentLoaded',omitirObservacion,{once:true});
  document.addEventListener('focusin',omitirObservacion,true);
  document.addEventListener('keydown',function(e){if(e.key!=='Tab')return;const el=e.target;if(!el||!el.closest||!el.closest('#tablaTitulos'))return;if(!el.matches('[data-t="tdj"], .fecha-campo, [data-t="valor"]'))return;omitirObservacion();const tr=el.closest('tbody tr');if(!tr)return;const tbody=tr.parentElement;if(!tbody)return;const filas=[...tbody.querySelectorAll('tr')],filaActual=filas.indexOf(tr),campos=[tr.querySelector('[data-t="tdj"]'),tr.querySelector('.fecha-campo'),tr.querySelector('[data-t="valor"]')].filter(Boolean),posicion=campos.indexOf(el);if(posicion<0)return;const paso=e.shiftKey?-1:1;let destino=null;if(posicion+paso>=0&&posicion+paso<campos.length)destino=campos[posicion+paso];else if(paso>0&&posicion===campos.length-1)destino=filas[filaActual+1]?.querySelector('[data-t="tdj"]')||null;else if(paso<0&&posicion===0)destino=filas[filaActual-1]?.querySelector('[data-t="valor"]')||null;if(destino){e.preventDefault();e.stopImmediatePropagation();enfocar(destino);}},true);
})();
(function(){
  document.addEventListener("DOMContentLoaded",function(){var footer=document.querySelector("footer");if(footer)footer.textContent=footer.textContent.replace(/v16\\.33\\.(163|164|165|166|167|168|169|170|171|172|174|175|176|177|178|179|180|181|182|183|184|185|186|187|188|189|190|191|192|193|194|195|196|197|198|199|200)/g,"v16.33.210");},{once:true});
  document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("#btnLimpiarTitulosGlobal"):null;if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!window.confirm("¿Desea iniciar una nueva liquidación de títulos? Se borrarán datos, pagos, títulos y resultados."))return;window.location.replace("titulos.html?v=16.33.210&reinicio="+Date.now());},true);
})();

// v16.33.199: una fecha de corte sin valor es informativa. Durante el cálculo
// no debe ocultar un TDJ real posterior, porque el cierre final del motor usa
// esa fecha de corte antes de evaluar el remanente/endoso. Neutralizamos SOLO
// las filas de corte/proyección durante el cálculo y las restauramos al terminar.
// No se toca ningún TDJ real, pago real, tasa, beneficio, fórmula ni distribución.
(function(){
  let restaurar=[];
  function esCorteVisible(tr){
    if(!tr)return false;
    const tdj=String(tr.querySelector('[data-t="tdj"]')?.value||'').trim();
    const recibo=String(tr.querySelector('[data-p="recibo"]')?.value||'').trim();
    const valorRaw=tr.querySelector('[data-t="valor"]')?.value||tr.querySelector('[data-p="valor"]')?.value||'';
    const valor=Number(String(valorRaw).replace(/[^0-9-]/g,''))||0;
    const fecha=String(tr.querySelector('.fecha-campo')?.value||tr.querySelector('.fecha-native')?.value||'').trim();
    return Boolean(fecha)&&!tdj&&!recibo&&valor<=0;
  }
  function neutralizarCortes(){
    restaurar=[];
    const filas=[...document.querySelectorAll('#tablaTitulos tbody tr, .pago-obligacion-card .pagos-mini tbody tr')];
    filas.forEach(tr=>{
      if(!esCorteVisible(tr))return;
      const text=tr.querySelector('.fecha-campo'),picker=tr.querySelector('.fecha-native');
      if(!text&&!picker)return;
      restaurar.push({text,picker,textValue:text?.value||'',pickerValue:picker?.value||''});
      if(text){text.value='';text.dispatchEvent(new Event('blur',{bubbles:true}));}
      if(picker){picker.value='';picker.dispatchEvent(new Event('change',{bubbles:true}));}
    });
  }
  function restaurarCortes(){
    const pendientes=restaurar.splice(0);
    pendientes.forEach(x=>{
      if(x.text){x.text.value=x.textValue;x.text.dispatchEvent(new Event('blur',{bubbles:true}));}
      if(x.picker){x.picker.value=x.pickerValue;x.picker.dispatchEvent(new Event('change',{bubbles:true}));}
    });
  }
  document.addEventListener('click',function(e){
    const b=e.target?.closest?.('.btn-calcular-tdj');
    if(!b)return;
    neutralizarCortes();
    setTimeout(restaurarCortes,0);
  },true);
})();

// Motor histórico protegido; su contenido no se modifica en esta capa.
// v16.33.200: el cálculo neutraliza únicamente cortes informativos mientras
// preserva los movimientos TDJ reales posteriores.
import("./tdj-core-16.33.143.js?v=16.33.218");
// Capa visual TDJ × OBLIGACIÓN.
import("./tdj-visual-beneficios.js?v=16.33.210");
