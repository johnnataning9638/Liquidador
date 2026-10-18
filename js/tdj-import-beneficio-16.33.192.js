import {leerXlsxPrimeraHoja,norm as normImportacionTDJ} from "./importador-excel.js?v=16.33.192";

/*
 * TDJ v16.33.192
 * - Integra la recuperación TDJ × OBLIGACIÓN directamente con el importador
 *   XLSX dinámico usado por importarExcelTDJ().
 * - No depende de que el input file esté conectado al DOM.
 * - Calcula la fecha de referencia global para obligaciones sin pagos:
 *   usa la fecha más reciente disponible en PAGOS (pago real o fecha de corte
 *   informativa), conservando la fecha de corte explícita cuando sea posterior.
 * - No modifica pagos, títulos, distribución, endoso, parámetros ni Supabase.
 */
(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__tdjImportBeneficio192)return;
  window.__tdjImportBeneficio192=true;

  const norm=normImportacionTDJ;
  const upper=v=>String(v??"").trim().toUpperCase();
  const docNum=v=>String(v??"").replace(/\D/g,"");
  const iso=v=>{
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if(!m)return "";
    const y=m[3].length===2?(Number(m[3])>=70?`19${m[3]}`:`20${m[3]}`):m[3];
    return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`;
  };

  function rowText(row){return (row||[]).map(norm).join(" | ");}

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

      const mOb=texto.match(/^OBLIGACI[ÓO]N\s+(\d+)\s*[-—]\s*APLICACI[ÓO]N SECUENCIAL/i);
      if(mOb){obligacionActual=Number(mOb[1]);continue;}

      const mDetalle=texto.match(/^DETALLE TDJ\s*(\d+)\s*[-—]\s*APLICACI[ÓO]N/i);
      if(mDetalle){
        let header=-1;
        for(let j=i+1;j<Math.min(rows.length,i+10);j++){
          const n=(rows[j]||[]).map(norm);
          if(n.includes("DOCUMENTO")&&n.includes("TIPO")){header=j;break;}
        }
        if(header>=0){
          const h=(rows[header]||[]).map(norm);
          const ixDoc=h.indexOf("DOCUMENTO"),ixTipo=h.indexOf("TIPO");
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
      }

      const n=row.map(norm);
      if(n.includes("TDJ")&&n.includes("TIPO")&&(n.includes("VALOR")||n.includes("VALOR ORIGINAL"))){
        const ixTDJ=n.indexOf("TDJ"),ixTipo=n.indexOf("TIPO");
        for(let j=i+1;j<rows.length;j++){
          const r=rows[j]||[],s=rowText(r);
          if(!s){if(j>i+1)break;continue;}
          if(esFinSeccion(s))break;
          const tdj=docNum(r[ixTDJ]),tipo=upper(r[ixTipo]);
          if(tdj&&tipo)globales.set(tdj,tipo);
        }
      }
    }
    return {especificos,globales};
  }

  function aplicarMapeoBeneficios(mapa){
    const filas=[...document.querySelectorAll("#tablaTitulos tbody tr")];
    const obligaciones=[...document.querySelectorAll("#listaObligaciones > .obligacion-card")];
    if(!filas.length||!obligaciones.length)return {ok:false,aplicados:0,encontrados:0};

    let encontrados=0,aplicados=0;
    for(const tr of filas){
      const tdj=docNum(tr.querySelector('[data-t="tdj"]')?.value||"");
      if(!tdj)continue;
      const selects=[...tr.querySelectorAll("select.tdj-beneficio-select")];
      if(selects.length<obligaciones.length)continue;

      for(let i=0;i<obligaciones.length;i++){
        const tipo=upper(mapa.especificos.get(`${tdj}|${i+1}`)||mapa.globales.get(tdj)||"");
        if(!tipo)continue;
        encontrados++;
        const select=selects[i];
        const opcion=[...select.options].find(o=>upper(o.value)===tipo||upper(o.textContent)===tipo);
        if(!opcion)continue;
        if(upper(select.value)!==upper(opcion.value)){
          select.value=opcion.value;
          select.dispatchEvent(new Event("change",{bubbles:true}));
          aplicados++;
        }
      }
    }
    return {ok:encontrados>0,aplicados,encontrados};
  }

  function aplicarCuandoLista(mapa){
    let intentos=0;
    const intento=()=>{
      const r=aplicarMapeoBeneficios(mapa);
      if(r.aplicados>0 || (r.ok&&r.encontrados>0))return;
      if(++intentos<80)setTimeout(intento,125);
    };
    setTimeout(intento,150);
  }

  async function procesarArchivo(file){
    if(!file||!/\.xlsx$/i.test(file.name||""))return;
    try{
      const rows=await leerXlsxPrimeraHoja(file);
      const mapa=extraerMapaBeneficios(rows);
      if(mapa.especificos.size||mapa.globales.size)aplicarCuandoLista(mapa);
    }catch(err){
      console.warn("TDJ v16.33.192 — recuperación de beneficios no disponible",err);
    }
  }

  /*
   * importarExcelTDJ() crea un <input type=file> dinámico y luego ejecuta
   * input.click(). Ese input no está conectado al document, por lo que un
   * listener document-level no recibe su change. Interceptamos únicamente
   * click() de inputs XLSX y registramos el change directamente en el input.
   */
  const inputProto=window.HTMLInputElement?.prototype;
  if(inputProto&&!inputProto.__tdjExcelHook192){
    const clickOriginal=inputProto.click;
    inputProto.click=function(...args){
      try{
        const tipo=String(this.type||"").toLowerCase();
        const accept=String(this.accept||"").toLowerCase();
        if(tipo==="file"&&(/\.xlsx/.test(accept)||accept.includes("spreadsheetml"))){
          this.addEventListener("change",()=>{
            const file=this.files?.[0];
            if(file)procesarArchivo(file);
          },{once:true});
        }
      }catch(err){
        console.warn("TDJ v16.33.192 — no fue posible instalar el puente XLSX",err);
      }
      return clickOriginal.apply(this,args);
    };
    inputProto.__tdjExcelHook192=true;
  }

  /*
   * Fecha de referencia para obligaciones sin pagos.
   * Se toma la fecha más reciente disponible en PAGOS:
   * - pagos reales con valor > 0;
   * - registros informativos con fecha y sin recibo/valor.
   * Si la obligación ya trae una fecha de corte posterior, se conserva la
   * posterior. Si no existe ninguna fecha, se conserva el comportamiento
   * histórico (hoy).
   */
  function fechaReferenciaGlobalTDJ(fechaActual=""){
    const fechas=[];
    document.querySelectorAll(".pago-obligacion-card").forEach(sec=>{
      sec.querySelectorAll(".pagos-mini tbody tr").forEach(tr=>{
        const fecha=iso(tr.querySelector(".fecha-campo")?.value||"")||iso(tr.querySelector(".fecha-native")?.value||"");
        if(!fecha)return;
        const valor=String(tr.querySelector('[data-p="valor"]')?.value||"").replace(/[^\d]/g,"");
        const recibo=String(tr.querySelector('[data-p="recibo"]')?.value||"").trim();
        if(Number(valor)>0||!recibo)fechas.push(fecha);
      });
    });
    const maxGlobal=fechas.sort().at(-1)||"";
    const actual=iso(fechaActual);
    if(!maxGlobal)return actual;
    if(!actual)return maxGlobal;
    const hoy=new Date().toISOString().slice(0,10);
    if(actual===hoy)return maxGlobal;
    return maxGlobal>actual?maxGlobal:actual;
  }

  function datosConFechaReferencia(datos){
    const d={...(datos||{})};
    const pagos=Array.isArray(d.pagos)?d.pagos:[];
    const tienePagoReal=pagos.some(p=>Number(p?.valor||0)>0);
    if(tienePagoReal)return d;
    const fecha=fechaReferenciaGlobalTDJ(d.fechaCorte||"");
    if(fecha)d.fechaCorte=fecha;
    return d;
  }

  function instalarPuenteFechaMotor(){
    Promise.all([
      import("./motor-liquidacion.js?v=16.33.161"),
      import("./motor-liquidacion-oficial.js?v=16.33.161")
    ]).then(mods=>{
      for(const Clase of [mods[0]?.MotorLiquidacion,mods[1]?.MotorLiquidacionOficial]){
        const protoMotor=Clase?.prototype;
        if(!protoMotor||protoMotor.__tdjFechaReferencia192)continue;
        const original=protoMotor.calcular;
        if(typeof original!=="function")continue;
        protoMotor.calcular=function(datos){
          return original.call(this,datosConFechaReferencia(datos));
        };
        protoMotor.__tdjFechaReferencia192=true;
      }
    }).catch(err=>console.warn("TDJ v16.33.192 — puente fecha referencia no disponible",err));
  }

  instalarPuenteFechaMotor();
  window.__tdjImportBeneficio192={procesarArchivo,extraerMapaBeneficios,aplicarMapeoBeneficios,fechaReferenciaGlobalTDJ};
})();