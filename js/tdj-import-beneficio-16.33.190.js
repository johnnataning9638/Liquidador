import {leerXlsxPrimeraHoja,norm as normImportacionTDJ} from "./importador-excel.js?v=16.33.190";

(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__tdjImportBeneficio190)return;
  window.__tdjImportBeneficio190=true;

  const norm=normImportacionTDJ;
  const upper=v=>String(v??"").trim().toUpperCase();
  const docNum=v=>String(v??"").replace(/\D/g,"");
  const HEAD_TDJ=new Set(["TDJ","TDJ Nº","TDJ NO","TDJ N°","DOCUMENTO FUENTE"]);
  const HEAD_TIPO=new Set(["TIPO","TIPO DE TASA","TIPO TASA","TIPO DE PAGO","NOMBRE FORMATO","FORMATO"]);

  function esCabeceraTitulos(row){
    const n=(row||[]).map(norm);
    return n.some(x=>HEAD_TDJ.has(x))&&n.some(x=>HEAD_TIPO.has(x));
  }

  function extraerTiposPorTDJ(rows){
    const mapa=new Map();
    for(let i=0;i<rows.length;i++){
      const row=rows[i]||[];
      if(!esCabeceraTitulos(row))continue;
      const n=row.map(norm);
      const tdjCol=n.findIndex(x=>HEAD_TDJ.has(x));
      const tipoCol=n.findIndex(x=>HEAD_TIPO.has(x));
      if(tdjCol<0||tipoCol<0)continue;
      for(let j=i+1;j<rows.length;j++){
        const r=rows[j]||[];
        const texto=r.map(norm).join(" | ");
        if(!texto){if(j>i+1)break;continue;}
        if(/^FIN RECUPERACI(?:O|Ó)N COMPLETA/.test(texto)||/^T[IÍ]TULOS \/ TDJ/.test(texto))break;
        const tdj=docNum(r[tdjCol]);
        const tipo=upper(r[tipoCol]);
        if(tdj&&tipo&&tipo!=="TASA DIAN")mapa.set(tdj,tipo);
      }
    }
    return mapa;
  }

  function tiposValidosEnSelect(select){
    return new Set([...select.options].map(o=>upper(o.value||o.textContent)));
  }

  function aplicarBeneficioImportado(mapa){
    const filas=[...document.querySelectorAll("#tablaTitulos tbody tr")];
    if(!filas.length)return false;
    const tipos=[];
    for(const tr of filas){
      const tdj=docNum(tr.querySelector('[data-t="tdj"]')?.value||"");
      const tipo=mapa.get(tdj);
      if(tipo)tipos.push(tipo);
    }
    if(!tipos.length)return false;

    // En el módulo TJ/TDJ el tratamiento de tasa/beneficio se conserva en
    // el selector de la obligación que gobierna la aplicación de los títulos.
    // Si los títulos importados traen un único tratamiento, se restaura ese
    // tratamiento; no se recalculan ni se modifican importes, fechas o pagos.
    const conteo=new Map();
    tipos.forEach(t=>conteo.set(t,(conteo.get(t)||0)+1));
    const tipoDominante=[...conteo.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(!tipoDominante)return false;

    let aplicados=0;
    document.querySelectorAll('#listaObligaciones .obligacion-card').forEach(sec=>{
      const select=sec.querySelector('[data-k="tipoTasa"]');
      if(!select)return;
      const validos=tiposValidosEnSelect(select);
      if(!validos.has(tipoDominante))return;
      if(upper(select.value)===tipoDominante)return;
      select.value=tipoDominante;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      aplicados++;
    });
    return aplicados>0;
  }

  document.addEventListener("change",function(e){
    const input=e.target;
    if(!input||input.tagName!=="INPUT"||String(input.type).toLowerCase()!=="file")return;
    const file=input.files?.[0];
    if(!file||!/\.xlsx$/i.test(file.name||""))return;

    // El importador principal reconstruye primero las obligaciones y títulos.
    // Esta capa lee el mismo archivo en paralelo y, una vez terminada la
    // reconstrucción visual, recupera únicamente el tratamiento asociado al
    // TDJ. Así no sustituye el parser ni toca la lógica de liquidación.
    Promise.resolve().then(async()=>{
      try{
        const rows=await leerXlsxPrimeraHoja(file);
        const mapa=extraerTiposPorTDJ(rows);
        if(!mapa.size)return;
        let intentos=0;
        const aplicar=()=>{
          if(aplicarBeneficioImportado(mapa))return;
          if(intentos++<20)setTimeout(aplicar,100);
        };
        setTimeout(aplicar,250);
      }catch(err){
        console.warn("TDJ v16.33.190 — no fue posible recuperar beneficios de títulos",err);
      }
    });
  },true);
})();
