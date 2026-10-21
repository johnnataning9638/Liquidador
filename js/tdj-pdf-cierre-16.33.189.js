// TDJ PDF CIERRE v16.33.189
// Homologación visual FINAL con el resumen PDF del Liquidador DIAN.
// No modifica cálculos, motores, distribución, cronología, endoso ni datos.
import "./tdj-pdf-cierre-16.33.188.js?v=16.33.215";

(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__tdjPdfCierre189)return;
  window.__tdjPdfCierre189=true;

  const CSS=`
    @page{size:A4 portrait;margin:22mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#17324d;font-family:Arial,Helvetica,sans-serif}
    body{font-size:11pt}
    .pdf-soporte{width:100%;padding:0;margin:0}
    .pdf-hoja-final-resumen{width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;break-before:page!important;page-break-before:always!important;break-after:page!important;page-break-after:always!important;break-inside:auto!important;page-break-inside:auto!important}
    .pdf-hoja-final-resumen:last-child{break-after:auto!important;page-break-after:auto!important}
    .pdf-hoja-final-resumen .pdf-pagina{width:100%!important;height:auto!important;min-height:0!important;display:block!important}
    .pdf-hoja-final-resumen .pdf-liquidacion{width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;border:1px solid #8aa0b2!important;background:#fff!important;break-inside:avoid!important;page-break-inside:avoid!important}
    .pdf-marca{display:grid!important;grid-template-columns:18mm 1fr 30mm!important;align-items:center!important;border-bottom:1px solid #7f9aae!important;background:#f5f8fa!important;height:10mm!important}
    .pdf-logo{font-weight:700!important;color:#007f9e!important;font-size:11pt!important;text-align:center!important;padding:1mm!important;border-right:1px solid #9aadb9!important}
    .pdf-titulo{text-align:center!important;font-weight:700!important;font-size:11pt!important;letter-spacing:.1px!important;padding:1mm!important}
    .pdf-generado{text-align:right!important;font-size:8pt!important;padding:1mm 1.5mm!important}
    .pdf-resumen-final{overflow:hidden!important}
    .pdf-resumen-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:2mm!important;margin:3mm 2mm!important}
    .pdf-resumen-grid>div{border:1px solid #8da6b7!important;padding:3mm!important;text-align:center!important;background:#eef5f9!important}
    .pdf-resumen-grid b{display:block!important;font-size:8pt!important;margin-bottom:1mm!important}
    .pdf-resumen-grid strong{font-size:13pt!important}
    .pdf-actualizacion-sancion{margin:1.5mm 2mm!important;border:1px solid #8da6b7!important;break-inside:avoid!important;page-break-inside:avoid!important}
    .pdf-actualizacion-sancion h3{font-size:9.5pt!important;margin:0!important;padding:1.25mm!important;background:#edf3f6!important}
    .pdf-actualizacion-sancion table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}
    .pdf-actualizacion-sancion th,.pdf-actualizacion-sancion td{border:1px solid #b7c4cc!important;padding:1mm!important;font-size:7.5pt!important;line-height:1.02!important;text-align:right!important;white-space:nowrap!important}
    .pdf-actualizacion-sancion th:first-child,.pdf-actualizacion-sancion td:first-child{text-align:center!important}
    .pdf-actualizacion-sancion thead th{background:#eef4f8!important;font-size:7.2pt!important}
    .pdf-actualizacion-sancion tfoot th{background:#e8f1f6!important;font-weight:700!important}
    .pdf-bloque{margin:2mm!important;border:1px solid #c58a1a!important;background:#fffdf7!important;break-inside:avoid!important;page-break-inside:avoid!important}
    .pdf-bloque h2{margin:0!important;padding:1.5mm 2mm!important;background:#fff6d8!important;color:#7a5200!important;font-size:11pt!important;border-bottom:1px solid #c58a1a!important}
    .pdf-bloque table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}
    .pdf-bloque th,.pdf-bloque td{border:1px solid #c9a45a!important;padding:1.25mm!important;font-size:8.5pt!important;line-height:1.05!important;text-align:right!important;white-space:nowrap!important}
    .pdf-bloque th:first-child,.pdf-bloque td:first-child{text-align:center!important}
    .pdf-bloque thead th{background:#fff9e8!important}
    .pdf-bloque tfoot th{background:#fff0c2!important;font-weight:700!important}
    .pdf-excedentes-finales{margin:1.5mm 2mm!important;border:1px solid #c58a1a!important;background:#fffdf7!important;break-inside:avoid!important;page-break-inside:avoid!important}
    .pdf-excedentes-finales h3{font-size:9.5pt!important;margin:0!important;padding:1.25mm!important;background:#fff6d8!important;color:#7a5200!important}
    .pdf-excedentes-finales table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}
    .pdf-excedentes-finales th,.pdf-excedentes-finales td{border:1px solid #c9a45a!important;padding:1mm!important;font-size:8pt!important;line-height:1.02!important;text-align:right!important;white-space:nowrap!important}
    .pdf-excedentes-finales th:first-child,.pdf-excedentes-finales td:first-child{text-align:center!important}
    .pdf-excedentes-finales thead th{background:#fff9e8!important}
    .pdf-excedentes-finales tfoot th{background:#fff0c2!important;font-weight:700!important}
    .pdf-excedente-final{margin:3mm 2mm!important;padding:3mm!important;border:1px solid #c58a1a!important;background:#fff6d8!important;color:#7a5200!important;font-size:12pt!important}
    .pdf-excedente-final span{font-size:9pt!important}
    .pdf-alerta{margin:2mm!important;padding:1.5mm!important;border:1px solid #d2a84a!important;background:#fff8df!important;font-size:10pt!important}
    .pdf-nota{text-align:center!important;font-weight:700!important;padding:1mm!important;font-size:8pt!important}
    @media print{
      html,body{width:210mm!important;background:#fff!important}
      .pdf-soporte{display:block!important;width:100%!important}
      .pdf-hoja-final-resumen{display:block!important;width:100%!important;height:auto!important;min-height:0!important;page-break-after:always!important;break-after:page!important}
      .pdf-hoja-final-resumen:last-child{page-break-after:auto!important;break-after:auto!important}
      .pdf-pagina{display:block!important;width:100%!important;height:auto!important}
      .pdf-liquidacion{display:block!important;visibility:visible!important;width:100%!important;height:auto!important}
    }
  `;

  function enhance(win){
    if(!win||win.closed)return;
    let tries=0;
    const apply=()=>{
      if(!win||win.closed)return;
      const doc=win.document;
      if(!doc||!doc.documentElement){if(tries++<100)setTimeout(apply,25);return;}
      const sections=[...doc.querySelectorAll("main.pdf-soporte > section.pdf-hoja-final-resumen")];
      if(!sections.length){if(tries++<100)setTimeout(apply,25);return;}
      let style=doc.getElementById("tdj-pdf-cierre-189-style");
      if(!style){style=doc.createElement("style");style.id="tdj-pdf-cierre-189-style";style.textContent=CSS;(doc.head||doc.documentElement).appendChild(style);}
      sections.forEach(sec=>{
        if(!sec.querySelector(":scope > .pdf-pagina")){
          const article=sec.querySelector(":scope > article.pdf-liquidacion");
          if(article){const page=doc.createElement("div");page.className="pdf-pagina";sec.insertBefore(page,article);page.appendChild(article);}
        }
        sec.classList.add("pdf-hoja-final-resumen","pdf-hoja-final-tdj-189");
      });
      sections.forEach((sec,i)=>{
        sec.style.breakBefore="page";
        sec.style.pageBreakBefore="always";
        sec.style.breakAfter=i===sections.length-1?"auto":"page";
        sec.style.pageBreakAfter=i===sections.length-1?"auto":"always";
      });
    };
    apply();
    try{
      const obs=new win.MutationObserver(()=>apply());
      obs.observe(win.document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>{try{obs.disconnect()}catch(_){ }},5000);
    }catch(_){ }
  }

  const nativeOpen=window.open;
  window.open=function(...args){
    const win=nativeOpen.apply(this,args);
    try{enhance(win)}catch(_){ }
    return win;
  };
})();
