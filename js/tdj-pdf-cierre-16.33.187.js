// TDJ PDF CIERRE v16.33.187
// Solo reorganiza la PRESENTACIÓN del PDF generado por exportarPdfTDJ.
// No modifica motores, cálculos, distribución, secuencia, endoso ni datos.
(function(){
  "use strict";
  if(window.__tdjPdfCierre187)return;
  window.__tdjPdfCierre187=true;

  const SOPORTE="LIQUIDACIÓN DE TÍTULOS / TDJ — SOPORTE COMPLETO";
  const RESUMEN="RESUMEN FINAL — TÍTULOS Y ENDOSO";

  function reorganizar(html){
    try{
      const parser=new DOMParser();
      const doc=parser.parseFromString(String(html||""),"text/html");
      const main=doc.querySelector("main.pdf-soporte");
      if(!main)return html;

      const paginas=[...main.children].filter(el=>el.matches?.("section.pdf-hoja"));
      const soporte=paginas.find(el=>String(el.textContent||"").includes(SOPORTE));
      const resumen=paginas.find(el=>String(el.textContent||"").includes(RESUMEN));
      if(!soporte||!resumen)return html;

      const soporteArticulo=soporte.querySelector(":scope > article")||soporte.firstElementChild;
      const resumenArticulo=resumen.querySelector(":scope > article")||resumen.firstElementChild;
      if(!soporteArticulo||!resumenArticulo)return html;

      const cierre=doc.createElement("section");
      cierre.className="pdf-hoja pdf-hoja-final-resumen pdf-hoja-final-tdj-cierre";
      cierre.appendChild(soporteArticulo);
      cierre.appendChild(resumenArticulo);

      soporte.remove();
      resumen.remove();
      main.appendChild(cierre);

      const style=doc.createElement("style");
      style.textContent=`
        .pdf-hoja-final-tdj-cierre{height:246.2mm!important;min-height:246.2mm!important;overflow:visible!important;break-before:page!important;page-break-before:always!important;break-after:auto!important;page-break-after:auto!important;display:block!important}
        .pdf-hoja-final-tdj-cierre>.pdf-liquidacion{height:auto!important;min-height:0!important;overflow:visible!important;break-inside:avoid!important;page-break-inside:avoid!important;margin-bottom:3mm}
        .pdf-hoja-final-tdj-cierre>.pdf-liquidacion:last-child{margin-bottom:0}
        .pdf-hoja-final-tdj-cierre>.pdf-liquidacion .pdf-marca{height:10mm}
      `;
      doc.head.appendChild(style);
      return "<!doctype html>"+doc.documentElement.outerHTML;
    }catch(e){
      console.warn("TDJ PDF cierre 187: no fue posible reorganizar el soporte; se conserva el PDF original.",e);
      return html;
    }
  }

  function prepararIntercepcion(){
    const boton=document.querySelector(".tdj-pdf");
    if(!boton)return;
    document.addEventListener("click",function(e){
      const objetivo=e.target?.closest?.(".tdj-pdf");
      if(!objetivo)return;
      const openOriginal=window.open;
      let restaurado=false;
      const restaurar=()=>{
        if(restaurado)return;
        restaurado=true;
        if(window.open===openInterceptado)window.open=openOriginal;
      };
      function openInterceptado(...args){
        const real=openOriginal.apply(window,args);
        if(!real)return real;
        try{
          const realDoc=real.document;
          const docProxy=new Proxy(realDoc,{
            get(target,prop){
              if(prop==="write")return html=>target.write.call(target,reorganizar(html));
              const value=Reflect.get(target,prop,target);
              return typeof value==="function"?value.bind(target):value;
            }
          });
          return new Proxy(real,{
            get(target,prop){
              if(prop==="document")return docProxy;
              const value=Reflect.get(target,prop,target);
              return typeof value==="function"?value.bind(target):value;
            },
            set(target,prop,value){return Reflect.set(target,prop,value,target);}
          });
        }catch(err){
          console.warn("TDJ PDF cierre 187: no se pudo interceptar la ventana de impresión.",err);
          return real;
        }
      }
      window.open=openInterceptado;
      setTimeout(restaurar,3000);
    },true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",prepararIntercepcion,{once:true});
  else prepararIntercepcion();
})();
