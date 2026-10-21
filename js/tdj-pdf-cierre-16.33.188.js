// TDJ PDF CIERRE v16.33.188
// Solo reorganiza la PRESENTACIÓN del PDF generado por exportarPdfTDJ.
// No modifica motores, cálculos, distribución, secuencia, endoso ni datos.
(function(){
  "use strict";
  if(window.__tdjPdfCierre188)return;
  window.__tdjPdfCierre188=true;

  const SOPORTE="LIQUIDACIÓN DE TÍTULOS / TDJ — SOPORTE COMPLETO";
  const RESUMEN_TITULOS="RESUMEN FINAL — TÍTULOS Y ENDOSO";
  const DETALLE="LIQUIDADOR OBLIGACIONES";
  const moneyText=v=>String(v??"").replace(/\u00a0/g," ").replace(/[^0-9-]/g,"");
  const money=v=>{const n=Number(moneyText(v));return Number.isFinite(n)?n:0;};
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const moneyFmt=v=>`$ ${Math.round(Number(v)||0).toLocaleString("es-CO")}`;
  const dateText=v=>clean(v)||"—";
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];

  function cellByLabel(article,label){
    const target=String(label).toUpperCase();
    return [...article.querySelectorAll(".pdf-celda")].find(c=>clean(c.querySelector("b")?.textContent).toUpperCase()===target)||null;
  }
  function cellValue(article,label){
    const c=cellByLabel(article,label); return c?clean(c.querySelector("strong")?.textContent):"";
  }
  function datos(article){
    const out={};
    article.querySelectorAll(".pdf-dato").forEach(c=>{const k=clean(c.querySelector("b")?.textContent).toUpperCase();const v=clean(c.querySelector("strong")?.textContent);if(k)out[k]=v;});
    return out;
  }
  function pageDetail(article,index){
    const d=datos(article);
    const tabla=article.querySelector(".pdf-tabla");
    let sancionSaldo=0, saldoTotal=0;
    if(tabla){
      const row=[...tabla.querySelectorAll("tbody tr")].find(tr=>clean(tr.children[0]?.textContent).toUpperCase()==="SANCIÓN");
      if(row)sancionSaldo=money(row.children[3]?.textContent);
      const totalRow=[...tabla.querySelectorAll("tbody tr")].find(tr=>clean(tr.children[0]?.textContent).toUpperCase()==="TOTALES");
      if(totalRow)saldoTotal=money(totalRow.children[3]?.textContent);
    }
    const intereses=money(article.querySelector(".pdf-intereses tfoot tr:last-child > :last-child")?.textContent);
    const valorPago=money(article.querySelector(".pdf-pago-titulo")?.textContent?.split("→").pop());
    const fecha=cellValue(article,"FECHA PREVISTA DE PAGO");
    const recibo=cellValue(article,"RECIBO DE PAGO");
    const tdj=cellValue(article,"TDJ");
    const observacion=cellValue(article,"OBSERVACIONES");
    let excedentePago=0;
    const ex=article.querySelector(".pdf-excedente");
    if(ex && clean(ex.textContent).toUpperCase().includes("PAGO EN EXCESO"))excedentePago=money(ex.textContent);

    const actualizaciones=[];
    let reducciones=[];
    article.querySelectorAll(".pdf-actualizacion-sancion").forEach(sec=>{
      const tables=[...sec.querySelectorAll("table")];
      const updateTable=tables.find(t=>clean(t.querySelector("thead")?.textContent).toUpperCase().includes("AÑO DE ACTUALIZACIÓN"));
      if(updateTable){
        [...updateTable.querySelectorAll("tbody tr")].forEach(tr=>{
          const c=[...tr.children].map(x=>clean(x.textContent));
          if(c.length>=7)actualizaciones.push({
            pago:index+1,fechaPago:fecha,anio:c[0],fechaAplicacion:c[1],anioIPC:c[2],antes:money(c[3]),actualizacion:money(c[5]),despues:money(c[6])
          });
        });
      }
      const redH=[...sec.querySelectorAll("h3")].find(h=>clean(h.textContent).toUpperCase().includes("REDUCCIÓN DE SANCIÓN"));
      if(redH){
        const redTable=redH.nextElementSibling?.tagName==="TABLE"?redH.nextElementSibling:tables.find(t=>clean(t.querySelector("thead")?.textContent).toUpperCase().includes("PORCENTAJE A PAGAR"));
        if(redTable)[...redTable.querySelectorAll("tbody tr")].forEach(tr=>{
          const c=[...tr.children].map(x=>clean(x.textContent));
          if(c.length>=6)reducciones.push({pago:index+1,fecha:fecha,antes:money(c[0]),porcentaje:c[2],valor15:money(c[3]),minima:money(c[4]),aplicado:money(c[5])});
        });
      }
    });

    return {article,index,datos:d,clave:[d.AÑO,d.CONCEPTO,d.PERÍODO,d.NIT].map(clean).join("|")||`OBL-${index+1}`,
      valorPago,fecha,recibo,tdj,observacion,intereses,sancionSaldo,saldoTotal,excedentePago,actualizaciones,reducciones};
  }

  function parseSupport(section){
    const a=section?.querySelector(":scope > article")||section?.firstElementChild;
    if(!a)return {};
    const grid={};
    a.querySelectorAll(".pdf-resumen-grid > div").forEach(x=>{
      const k=clean(x.querySelector("b")?.textContent).toUpperCase();
      const v=money(x.querySelector("strong")?.textContent);
      if(k)grid[k]=v;
    });
    return {article:a,grid};
  }

  function parseTitleSummary(section){
    const a=section?.querySelector(":scope > article")||section?.firstElementChild;
    if(!a)return null;
    const grid={};
    a.querySelectorAll(".pdf-resumen-grid > div").forEach(x=>{
      const k=clean(x.querySelector("b")?.textContent).toUpperCase();
      const v=money(x.querySelector("strong")?.textContent);
      if(k)grid[k]=v;
    });
    const rows=[];
    const table=[...a.querySelectorAll("table")].find(t=>clean(t.querySelector("thead")?.textContent).toUpperCase().includes("TDJ"));
    if(table)[...table.querySelectorAll("tbody tr")].forEach(tr=>{
      const c=[...tr.children].map(x=>clean(x.textContent));
      if(c.length>=4 && !c[0].toUpperCase().includes("NO HAY")){
        const original=money(c[2]);
        const sobrante=c.length>=6?money(c[4]):money(c[3]);
        const aplicado=c.length>=6?money(c[3]):Math.max(0,original-sobrante);
        rows.push({tdj:c[0],fecha:c[1],original,aplicado,sobrante:c.length>=6?money(c[4]):sobrante,destino:c.length>=6?c[5]:"ENDOSO"});
      }
    });
    return {article:a,grid,rows};
  }

  function sectionPage(doc,title,body){
    const s=doc.createElement("section");
    s.className="pdf-hoja pdf-hoja-final-resumen pdf-hoja-final-tdj-188";
    s.innerHTML=`<article class="pdf-liquidacion pdf-resumen-final"><div class="pdf-marca"><div class="pdf-logo">DIAN</div><div class="pdf-titulo">${title}</div><div class="pdf-generado">Generado: ${dateVisible()}</div></div>${body}</article>`;
    return s;
  }
  function dateVisible(){
    const d=new Date();
    const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0"),yy=d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  function gridItem(label,value){return `<div><b>${esc(label)}</b><strong>${moneyFmt(value)}</strong></div>`;}
  function note(){return `<div class="pdf-nota">La liquidación adjunta no exime al contribuyente de su responsabilidad de verificar que los valores determinados correspondan con su obligación tributaria y de efectuar el pago respectivo, conforme a los artículos 1, 6, 574 y 591 del Estatuto Tributario – Título II, Deberes y Obligaciones Formales.</div>`;}

  function resumenLiquidacion(doc,details,support){
    const grupos=new Map();
    details.forEach(x=>{if(!grupos.has(x.clave))grupos.set(x.clave,[]);grupos.get(x.clave).push(x);});
    let saldoFinal=Number(support.grid["SALDO OBLIGACIONES"]||support.grid["SALDO FINAL OBLIGACIONES"]||0);
    if(!saldoFinal)saldoFinal=[...grupos.values()].reduce((sum,g)=>sum+(g[g.length-1]?.saldoTotal||0),0);
    const excedenteTotal=details.reduce((s,x)=>s+x.excedentePago,0);
    const sancionFinal=[...grupos.values()].reduce((s,g)=>s+(g[g.length-1]?.sancionSaldo||0),0);
    const intereses=details.reduce((s,x)=>s+x.intereses,0);
    const actualizacion=details.reduce((s,x)=>s+x.actualizaciones.reduce((a,u)=>a+u.actualizacion,0),0);
    const reduccion=details.reduce((s,x)=>s+x.reducciones.reduce((a,r)=>a+Math.max(0,r.antes-r.aplicado),0),0);
    const updRows=[];
    details.forEach(x=>x.actualizaciones.forEach(u=>updRows.push(`<tr><td>${u.pago}</td><td>${esc(dateText(u.fechaPago))}</td><td>${esc(u.anio)}</td><td>${esc(dateText(u.fechaAplicacion))}</td><td>${esc(u.anioIPC)}</td><td>${moneyFmt(u.antes)}</td><td>${moneyFmt(u.actualizacion)}</td><td>${moneyFmt(u.despues)}</td></tr>`)));
    const updBody=updRows.length?updRows.join(""):"<tr><td colspan=\"8\">No se realizaron actualizaciones de sanción.</td></tr>";
    const redRows=[];
    details.forEach(x=>x.reducciones.forEach(r=>redRows.push(`<tr><td>${r.pago}</td><td>${esc(dateText(r.fecha))}</td><td>${moneyFmt(r.antes)}</td><td>${esc(r.porcentaje||"15.00%")}</td><td>${moneyFmt(r.valor15)}</td><td>${moneyFmt(r.minima)}</td><td>${moneyFmt(r.aplicado)}</td></tr>`)));
    const redBody=redRows.length?redRows.join(""):"<tr><td colspan=\"7\">No se registró reducción de sanción del artículo 9 en los pagos liquidados.</td></tr>";
    const alerts=uniq(details.flatMap(x=>[...x.article.querySelectorAll(".pdf-alerta")].map(a=>clean(a.textContent))));
    const body=`<div class="pdf-resumen-grid">
      ${gridItem("SALDO TOTAL FINAL",saldoFinal)}${gridItem("EXCEDENTE TOTAL",excedenteTotal)}${gridItem("SANCIÓN FINAL",sancionFinal)}
      ${gridItem("INTERESES GENERADOS EN LOS PAGOS",intereses)}${gridItem("ACTUALIZACIÓN TOTAL DE SANCIÓN",actualizacion)}${gridItem("REDUCCIÓN EFECTIVA SANCIÓN ART. 9",reduccion)}
    </div>
    <div class="pdf-actualizacion-sancion"><h3>RESUMEN DE ACTUALIZACIONES DE SANCIÓN</h3><table><thead><tr><th>PAGO</th><th>FECHA PAGO</th><th>AÑO ACTUALIZACIÓN</th><th>FECHA APLICACIÓN</th><th>AÑO IPC</th><th>ANTES</th><th>ACTUALIZACIÓN</th><th>DESPUÉS</th></tr></thead><tbody>${updBody}</tbody></table>
    <h3>DETALLE DE REDUCCIÓN DE SANCIÓN — ARTÍCULO 9</h3><table><thead><tr><th>PAGO</th><th>FECHA</th><th>ANTES DE REDUCIR</th><th>PORCENTAJE A PAGAR</th><th>VALOR AL 15 %</th><th>SANCIÓN MÍNIMA</th><th>VALOR APLICADO</th></tr></thead><tbody>${redBody}</tbody></table></div>
    ${alerts.map(a=>`<div class="pdf-alerta">${esc(a)}</div>`).join("")}${note()}`;
    return sectionPage(doc,"RESUMEN FINAL DE LA LIQUIDACIÓN",body);
  }

  function resumenPagos(doc,details){
    const pagos=[]; const seen=new Set();
    details.forEach(x=>{
      const esTDJ=Boolean(clean(x.tdj));
      if(esTDJ||!x.valorPago)return;
      const key=[x.clave,x.recibo,x.fecha,x.valorPago].join("|");
      if(seen.has(key))return; seen.add(key);
      pagos.push(x);
    });
    // Régimen SIMPLE y ordinario: mostrar siempre la consolidación de pagos, incluso sin excedentes.
    // Si no hay pagos, informar explícitamente que no existen movimientos, sin inventar importes.
    if(!pagos.length){
      const body=`<div class="pdf-excedentes-finales"><h3>EXCEDENTES POR PAGO</h3><table><thead><tr><th>PAGO</th><th>RECIBO</th><th>FECHA DE PAGO</th><th>VALOR PAGADO</th><th>EXCEDENTE</th></tr></thead><tbody><tr><td colspan="5">NO SE REGISTRARON PAGOS.</td></tr></tbody><tfoot><tr><th colspan="4">TOTAL EXCEDENTES</th><th>${moneyFmt(0)}</th></tr></tfoot></table></div><div class="pdf-excedente-final"><b>TOTAL EXCEDENTES:</b> <span>${moneyFmt(0)}</span></div>`;
      return sectionPage(doc,"CONSOLIDACIÓN FINAL DE EXCEDENTES DE PAGOS",body);
    }
    const rows=pagos.map((x,i)=>`<tr><td>PAGO ${i+1}</td><td>${esc(x.recibo||"—")}</td><td>${esc(dateText(x.fecha))}</td><td>${moneyFmt(x.valorPago)}</td><td>${moneyFmt(x.excedentePago)}</td></tr>`).join("");
    const total=pagos.reduce((s,x)=>s+x.excedentePago,0);
    const body=`<div class="pdf-excedentes-finales"><h3>EXCEDENTES POR PAGO</h3><table><thead><tr><th>PAGO</th><th>RECIBO</th><th>FECHA DE PAGO</th><th>VALOR PAGADO</th><th>EXCEDENTE</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">TOTAL EXCEDENTES</th><th>${moneyFmt(total)}</th></tr></table></div><div class="pdf-excedente-final"><b>TOTAL EXCEDENTES:</b> <span>${moneyFmt(total)}</span></div><div class="pdf-nota">Nota: el excedente corresponde al valor de cada pago que no fue aplicado a la obligación liquidada.</div>`;
    return sectionPage(doc,"CONSOLIDACIÓN FINAL DE EXCEDENTES DE PAGOS",body);
  }

  function resumenTitulos(doc,parsedTitle,support){
    if(!parsedTitle)return null;
    const g=parsedTitle.grid;
    const rows=parsedTitle.rows;
    const totalTitulos=Number(g["TOTAL TÍTULOS"]||support.grid["TOTAL TÍTULOS"]||rows.reduce((s,r)=>s+r.original,0));
    const totalAplicado=Number(g["TOTAL APLICADO"]||rows.reduce((s,r)=>s+r.aplicado,0));
    const saldo=Number(g["SALDO FINAL OBLIGACIONES"]||support.grid["SALDO OBLIGACIONES"]||0);
    const endoso=Number(g["TOTAL ENDOSO"]||rows.reduce((s,r)=>s+r.sobrante,0));
    const body=`<div class="pdf-resumen-grid">${gridItem("TOTAL TÍTULOS",totalTitulos)}${gridItem("TOTAL APLICADO",totalAplicado)}${gridItem("SALDO FINAL OBLIGACIONES",saldo)}${gridItem("TOTAL ENDOSO",endoso)}</div>
      <div class="pdf-bloque"><h2>TÍTULOS SOBRANTES PARA ENDOSO</h2><table><thead><tr><th>TDJ</th><th>FECHA</th><th>VALOR ORIGINAL</th><th>APLICADO</th><th>SOBRANTE</th><th>DESTINO</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.tdj)}</td><td>${esc(dateText(r.fecha))}</td><td>${moneyFmt(r.original)}</td><td>${moneyFmt(r.aplicado)}</td><td>${moneyFmt(r.sobrante)}</td><td>${esc(r.destino||"ENDOSO")}</td></tr>`).join(""):"<tr><td colspan=\"6\">NO HAY TÍTULOS SOBRANTES.</td></tr>"}</tbody><tfoot><tr><th colspan="4">TOTAL ENDOSO</th><th>${moneyFmt(endoso)}</th><th>ENDOSO</th></tr></table></div><div class="pdf-nota">Nota: el valor a endosar corresponde al remanente del valor nominal del título después de su aplicación efectiva en la liquidación.</div>`;
    return sectionPage(doc,"RESUMEN FINAL — TÍTULOS Y ENDOSO",body);
  }

  function reorganizar(html){
    try{
      const parser=new DOMParser();
      const doc=parser.parseFromString(String(html||""),"text/html");
      const main=doc.querySelector("main.pdf-soporte");
      if(!main)return html;
      const paginas=[...main.children].filter(el=>el.matches?.("section.pdf-hoja"));
      const soporte=paginas.find(el=>clean(el.textContent).includes(SOPORTE));
      const resumenTit=paginas.find(el=>clean(el.textContent).includes(RESUMEN_TITULOS));
      const detailSections=paginas.filter(el=>clean(el.textContent).includes(DETALLE)&&clean(el.textContent).includes("DETALLE DEL PAGO"));
      const details=detailSections.map(pageDetail);
      const support=parseSupport(soporte);
      const parsedTitle=parseTitleSummary(resumenTit);

      [soporte,resumenTit].filter(Boolean).forEach(x=>x.remove());

      const finalPages=[];
      finalPages.push(resumenLiquidacion(doc,details,support));
      const pagos=resumenPagos(doc,details); if(pagos)finalPages.push(pagos);
      const titulos=resumenTitulos(doc,parsedTitle,support); if(titulos)finalPages.push(titulos);
      finalPages.forEach(x=>main.appendChild(x));

      const style=doc.createElement("style");
      style.textContent=`
        .pdf-hoja-final-tdj-188{height:246.2mm!important;min-height:246.2mm!important;overflow:hidden!important;break-before:page!important;page-break-before:always!important;break-after:page!important;page-break-after:always!important;display:block!important}
        .pdf-hoja-final-tdj-188:last-child{break-after:auto!important;page-break-after:auto!important}
        .pdf-hoja-final-tdj-188>.pdf-liquidacion{height:auto!important;min-height:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}
        .pdf-hoja-final-tdj-188>.pdf-liquidacion .pdf-marca{height:10mm}
        .pdf-hoja-final-tdj-188 .pdf-bloque,.pdf-hoja-final-tdj-188 .pdf-actualizacion-sancion{break-inside:avoid!important;page-break-inside:avoid!important}
      `;
      doc.head.appendChild(style);
      return "<!doctype html>"+doc.documentElement.outerHTML;
    }catch(e){
      console.warn("TDJ PDF cierre 188: no fue posible reorganizar el soporte; se conserva el PDF original.",e);
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
      const restaurar=()=>{if(restaurado)return;restaurado=true;if(window.open===openInterceptado)window.open=openOriginal;};
      function openInterceptado(...args){
        const real=openOriginal.apply(window,args);
        if(!real)return real;
        try{
          const realDoc=real.document;
          const docProxy=new Proxy(realDoc,{
            get(target,prop){
              if(prop==="write")return html=>{try{return target.write.call(target,reorganizar(html));}finally{restaurar();}};
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
          console.warn("TDJ PDF cierre 188: no se pudo interceptar la ventana de impresión.",err);
          return real;
        }
      }
      window.open=openInterceptado;
      // La exportación es asíncrona: un cálculo previo puede tardar más de 3 s.
      // Mantener la intercepción hasta que el PDF escriba su HTML o hasta 30 s.
      setTimeout(restaurar,30000);
    },true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",prepararIntercepcion,{once:true});
  else prepararIntercepcion();
})();