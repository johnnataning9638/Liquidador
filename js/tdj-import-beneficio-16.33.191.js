import {leerXlsxPrimeraHoja,norm as normImportacionTDJ} from "./importador-excel.js?v=16.33.191";

// TDJ v16.33.191 — RECUPERACIÓN REAL DE BENEFICIOS POR TDJ × OBLIGACIÓN.
// Fuente de verdad: la estructura efectiva de los Excel generados por el
// Liquidador DIAN y por el módulo TDJ. No modifica motores ni cálculos.
(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__tdjImportBeneficio191)return;
  window.__tdjImportBeneficio191=true;

  const norm=normImportacionTDJ;
  const upper=v=>String(v??"").trim().toUpperCase();
  const docNum=v=>String(v??"").replace(/\D/g,"");
  const rowText=row=>(row||[]).map(norm).join(" | ");

  function esFinSeccion(texto){
    return /^(FIN RECUPERACION|FIN RECUPERACIÓN|T[IÍ]TULOS TDJ|T[IÍ]TULOS \/ TDJ|OBLIGACION\b|OBLIGACIÓN\b)/.test(texto||"");
  }

  function extraerMapaBeneficios(rows){
    const especificos=new Map();
    const globales=new Map();
    let obligacionActual=null;

    for(let i=0;i<rows.length;i++){
      const row=rows[i]||[];
      const texto=rowText(row);
      if(!texto)continue;

      // Excel del módulo TDJ: cada bloque "OBLIGACIÓN N — APLICACIÓN..."
      // contiene luego los "DETALLE TDJ ..." con TIPO/TASA. Esta es la
      // relación exacta TDJ × OBLIGACIÓN que necesitamos reconstruir.
      const mOb=texto.match(/^OBLIGACI[ÓO]N\s+(\d+)\s*[-—]\s*APLICACI[ÓO]N SECUENCIAL/i);
      if(mOb){
        obligacionActual=Number(mOb[1]);
        continue;
      }

      const mDetalle=texto.match(/^DETALLE TDJ\s*(\d+)\s*[-—]\s*APLICACI[ÓO]N/i);
      if(mDetalle){
        const tdjDelTitulo=docNum(mDetalle[1]);
        let header=-1;
        for(let j=i+1;j<Math.min(rows.length,i+10);j++){
          const n=(rows[j]||[]).map(norm);
          if(n.includes("DOCUMENTO")&&n.includes("TIPO")){header=j;break;}
        }
        if(header>=0){
          const h=(rows[header]||[]).map(norm);
          const ixDoc=h.indexOf("DOCUMENTO");
          const ixTipo=h.indexOf("TIPO");
          for(let j=header+1;j<Math.min(rows.length,header+5);j++){
            const r=rows[j]||[];
            const tdj=docNum(r[ixDoc]);
            const tipo=upper(r[ixTipo]);
            if(tdj&&tipo&&obligacionActual){
              especificos.set(`${tdj}|${obligacionActual}`,tipo);
              break;
            }
          }
        }
        // No hacemos continue: el mismo Excel puede contener también un
        // bloque global de títulos que sirve como respaldo.
      }

      // Excel del Liquidador DIAN: la sección "TÍTULOS / TDJ — TÍTULOS
      // REGISTRADOS" contiene directamente TDJ + TIPO. Si no existe una
      // relación específica TDJ×obligación, esta es la fuente global.
      const n=row.map(norm);
      if(n.includes("TDJ")&&n.includes("TIPO")&&(n.includes("VALOR")||n.includes("VALOR ORIGINAL"))){
        const ixTDJ=n.indexOf("TDJ");
        const ixTipo=n.indexOf("TIPO");
        for(let j=i+1;j<rows.length;j++){
          const r=rows[j]||[];
          const s=rowText(r);
          if(!s){if(j>i+1)break;continue;}
          if(esFinSeccion(s))break;
          const tdj=docNum(r[ixTDJ]);
          const tipo=upper(r[ixTipo]);
          if(tdj&&tipo)globales.set(tdj,tipo);
        }
      }
    }

    return {especificos,globales};
  }

  function obtenerSelectsDeFila(tr){
    return [...tr.querySelectorAll("select.tdj-beneficio-select")];
  }

  function aplicarMapeoBeneficios(mapa){
    const filas=[...document.querySelectorAll("#tablaTitulos tbody tr")];
    const obligaciones=[...document.querySelectorAll("#listaObligaciones > .obligacion-card")];
    if(!filas.length||!obligaciones.length)return {ok:false,aplicados:0,encontrados:0};

    let encontrados=0,aplicados=0;
    for(const tr of filas){
      const tdj=docNum(tr.querySelector('[data-t="tdj"]')?.value||"");
      if(!tdj)continue;
      const selects=obtenerSelectsDeFila(tr);
      if(selects.length<obligaciones.length)continue;

      for(let i=0;i<obligaciones.length;i++){
        const tipoEspecifico=mapa.especificos.get(`${tdj}|${i+1}`);
        const tipoGlobal=mapa.globales.get(tdj);
        const tipo=upper(tipoEspecifico||tipoGlobal||"");
        if(!tipo)continue;
        encontrados++;
        const select=selects[i];
        const opcion=[...select.options].find(o=>upper(o.value||o.textContent)===tipo);
        if(!opcion)continue;
        if(upper(select.value)!==tipo){
          select.value=opcion.value;
          select.dispatchEvent(new Event("change",{bubbles:true}));
          aplicados++;
        }
      }
    }
    return {ok:encontrados>0,aplicados,encontrados};
  }

  function esperarYAplicar(mapa){
    let intentos=0;
    const intento=()=>{
      const r=aplicarMapeoBeneficios(mapa);
      // Reintentamos mientras la tabla/columnas de obligaciones todavía estén
      // siendo reconstruidas por el importador principal o la capa visual.
      if(r.ok)return;
      if(++intentos<60)setTimeout(intento,125);
    };
    setTimeout(intento,200);
  }

  document.addEventListener("change",function(e){
    const input=e.target;
    if(!input||input.tagName!=="INPUT"||String(input.type).toLowerCase()!=="file")return;
    const file=input.files?.[0];
    if(!file||!/\.xlsx$/i.test(file.name||""))return;

    Promise.resolve().then(async()=>{
      try{
        const rows=await leerXlsxPrimeraHoja(file);
        const mapa=extraerMapaBeneficios(rows);
        if(!mapa.especificos.size&&!mapa.globales.size)return;
        esperarYAplicar(mapa);
      }catch(err){
        console.warn("TDJ v16.33.191 — no fue posible recuperar beneficios por TDJ × obligación",err);
      }
    });
  },true);
})();
