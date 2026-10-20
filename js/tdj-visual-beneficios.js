import {esBeneficio1419TDJ,fechaElegible1419TDJ} from './tdj-tasas-203.js?v=16.33.205';
import {referenciaTimTDJ} from './tdj-tasa-vista-207.js?v=16.33.207';
// TDJ v16.33.205 — TASAS INDIVIDUALES POR TÍTULO Y OBLIGACIÓN.
// La columna OBLIGACIÓN conserva su función exclusivamente descriptiva.
// La selección TIPO DE TASA/TASA se aplica ahora por combinación TDJ × OBLIGACIÓN.
(function(){
  "use strict";

  const TIPOS = [
    "TASA DIAN",
    "ART. 45 LEY 2155",
    "ART. 91 LEY 2277",
    "ART. 93 LEY 2277 - OMISAS",
    "ART. 48 LEY 2155",
    "ART. 1 DECRETO 688 DE 2020 - IBC",
    "ART. 120 LEY 2010 2018 PARAG 3- IBC+2",
    "ART. 20 DECRETO 1474 DE 2025",
    "ART. 21 DECRETO 1474 DE 2025, OMISO- CORRECION",
    "ART. 3 DECRETO 0240 DE 2026",
    "ART. 4 DECRETO 0240 DE 2026, OMISO- CORRECCION",
    "ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO",
    "ART. 10 DECRETO 1419 DE 2026 - OMISAS TRIBUTARIAS",
    "ART. 10 DECRETO 1419 DE 2026 - CORRECCIONES TRIBUTARIAS"
  ];

  const seleccionVisual = new Map();
  let tasasMoratorias = [];
  let ultimaFirma = "";
  let pintando = false;

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
  const upper = value => String(value ?? "").trim().toUpperCase();

  function fechaISOVisual(v){
    const s=String(v??"").trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(!m)return "";
    let [,d,mo,y]=m;
    if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;
    return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  function obtenerObligaciones(){
    const root=document.getElementById("listaObligaciones");
    return root?[...root.querySelectorAll(":scope > .obligacion-card")]:[];
  }

  function valorCampo(card,selector){return String(card?.querySelector(selector)?.value||"").trim();}

  function detalleObligacion(card,index){
    const concepto=valorCampo(card,'[data-k="concepto"]');
    const anio=valorCampo(card,'[data-k="anio"]');
    const periodo=valorCampo(card,'[data-k="periodo"]');
    const detalle=[concepto,anio,periodo?`P${periodo}`:""].filter(Boolean).join(" ");
    return detalle?`OBLIGACIÓN ${index+1}<span class="tdj-obligacion-detalle">${esc(detalle)}</span>`:`OBLIGACIÓN ${index+1}`;
  }

  function instalarEstilos(){
    if(document.getElementById("tdj-visual-obligaciones-style"))return;
    const style=document.createElement("style");
    style.id="tdj-visual-obligaciones-style";
    style.textContent=`
      #tablaTitulos{table-layout:fixed;width:100%;min-width:1120px}
      #tablaTitulos th,#tablaTitulos td{vertical-align:middle}
      #tablaTitulos th.tdj-obligacion-head{background:#e8eef3;color:#173047;text-align:center;font-size:10px;text-transform:uppercase;white-space:normal;line-height:1.2;padding:7px 6px}
      #tablaTitulos .tdj-obligacion-detalle{display:block;margin-top:2px;font-size:9px;font-weight:600;color:#687783;text-transform:none;white-space:normal}
      #tablaTitulos td.tdj-beneficio-visual{padding:5px 6px;min-width:170px}
      #tablaTitulos select.tdj-beneficio-select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #aebbc8;border-radius:5px;padding:7px 8px;background:#fff;color:#173047;font-size:11px;height:34px}
      #tablaTitulos select.tdj-beneficio-select:focus{outline:2px solid #8eb8cf;outline-offset:1px}
      #tablaTitulos .tdj-tasa-visual{margin-top:4px;border:1px solid #c5d1da;border-radius:4px;background:#f5f8fa;color:#173047;text-align:right;padding:4px 7px;font-size:10px;font-weight:700;min-height:23px}
      #tablaTitulos .tdj-tasa-visual.sin-datos{color:#687783;font-weight:600}
      #tablaTitulos .tdj-observacion-legacy{display:none!important}
      #tablaTitulos .tdj-accion-head,#tablaTitulos .tdj-accion-cell{white-space:nowrap;text-align:center}
      #tablaTitulos th.tdj-obligacion-head,#tablaTitulos td.tdj-beneficio-visual{width:auto}
      .tdj-tasa-obligacion{display:none!important}
      @media(max-width:900px){#tablaTitulos{min-width:1120px}#tablaTitulos select.tdj-beneficio-select{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function marcarObservacionLegacy(row){
    const obs=row?.querySelector?.('[data-t="observacion"]');
    const td=obs?.closest("td");
    if(td)td.classList.add("tdj-observacion-legacy");
  }
  function marcarObservacionLegacyHead(head){
    const cell=[...head.cells].find(c=>upper(c.textContent)==="OBSERVACIÓN");
    if(cell)cell.classList.add("tdj-observacion-legacy");
  }

  function claveSeleccion(titleId,index){return `${titleId}|${obtenerObligaciones()[index]?.dataset.id||index}`;}
  function tituloDeFila(titleId){return document.querySelector(`#tablaTitulos tbody tr[data-titulo-id="${CSS.escape(titleId)}"]`);}
  function obtenerTDJDeFila(titleId){return String(tituloDeFila(titleId)?.querySelector('[data-t="tdj"]')?.value||"").trim();}

  function actualizarMapaGlobal(titleId,index,tipo){
    if(!window.__tdjTasaPorTituloObligacion)window.__tdjTasaPorTituloObligacion=new Map();
    const tdj=obtenerTDJDeFila(titleId);
    if(tdj)window.__tdjTasaPorTituloObligacion.set(`${tdj}|${index}`,upper(tipo||"TASA DIAN"));
  }

  function obtenerTipo(titleId,index){
    const key=claveSeleccion(titleId,index);
    const tipo=upper(seleccionVisual.get(key)||window.__tdjTiposCanonicos203?.get(key)||"TASA DIAN")||"TASA DIAN";
    seleccionVisual.set(key,tipo);
    actualizarMapaGlobal(titleId,index,tipo);
    return tipo;
  }

  function sincronizarTipoDeObligacionLegacy(){
    // El campo anterior queda fuera de la interfaz. Se conserva internamente
    // como TASA DIAN únicamente para mantener compatibilidad con validaciones
    // históricas del motor; nunca se usa como fuente de tasa para un TDJ.
    document.querySelectorAll('#listaObligaciones .obligacion-card').forEach(card=>{
      const select=card.querySelector('[data-k="tipoTasa"]');
      if(!select)return;
      if(select.value!=="TASA DIAN"){
        select.value="TASA DIAN";
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
      select.closest("label")?.setAttribute("aria-hidden","true");
      const tasa=card.querySelector('[data-tasa-obligacion]');
      tasa?.closest("label")?.setAttribute("aria-hidden","true");
    });
  }

  function tasaPorFechaLocal(fecha,tipo){
    const f=fechaISOVisual(fecha);
    const t=upper(tipo||"TASA DIAN");
    const es=needle=>t.includes(needle);
    if(es("DECRETO 1419")&&es("ART. 9"))return 0.045;
    if(es("DECRETO 1419")&&es("ART. 10")&&es("OMIS"))return 0.045;
    if(es("DECRETO 1419")&&es("ART. 10")&&es("CORRECC"))return 0;
    if(es("DECRETO 1474")&&es("ART. 20"))return 0.045;
    if(es("DECRETO 1474")&&es("ART. 21"))return 0;
    if(es("DECRETO 0240")&&es("ART. 3"))return 0.045;
    if(es("DECRETO 0240")&&es("ART. 4"))return 0;
    const row=tasasMoratorias.find(x=>String(x?.desde||"").slice(0,10)<=f&&String(x?.hasta||"").slice(0,10)>=f);
    const tim=Number(row?.tasas?.["TASA DIAN"]);
    if(!Number.isFinite(tim))return null;
    const r4=n=>Math.round(Number(n)*10000)/10000;
    if(es("LEY 2277")&&es("ART. 91"))return r4(tim*0.5);
    if(es("LEY 2277")&&es("ART. 93"))return r4(tim*0.4);
    if(es("LEY 2155")&&es("ART. 45"))return r4(((tim+0.02)/1.5)*0.20);
    if(es("ART. 48 LEY 2155")||es("DECRETO 688 DE 2020"))return r4((tim+0.02)/1.5);
    if(es("ART. 120 LEY 2010"))return r4(((tim+0.02)/1.5)+0.02);
    const directo=Number(row?.tasas?.[t]);
    return Number.isFinite(directo)?directo:tim;
  }

  function mostrarTasa(td,select,titleId,index){
    let box=td.querySelector(".tdj-tasa-visual");
    if(!box){box=document.createElement("div");box.className="tdj-tasa-visual";td.appendChild(box);}
    let tipo=upper(select?.value||"TASA DIAN");
    let fueraDeVentana=false;
    const fila=tituloDeFila(titleId);
    const fecha=fechaISOVisual(fila?.querySelector('.fecha-campo')?.value||fila?.querySelector('.fecha-native')?.value||"");
    // Nunca sustituir el beneficio antes de que el funcionario ingrese la fecha.
    // Al tener fecha válida, no permitir que el selector visual diverja del motor y Excel.
    if(fecha&&esBeneficio1419TDJ(tipo)&&!fechaElegible1419TDJ(fecha)){
      tipo="TASA DIAN";
      fueraDeVentana=true;
      if(select)select.value=tipo;
      const clave=claveSeleccion(titleId,index);
      seleccionVisual.set(clave,tipo);
      window.__tdjTiposCanonicos203?.set(clave,tipo);
      actualizarMapaGlobal(titleId,index,tipo);
      box.title="TDJ fuera de ventanas Decreto 1419: hasta 09/08/2026 o 17/09/2026–19/11/2026. Se aplica TASA DIAN.";
    }
    const tasa=tasaPorFechaLocal(fecha,tipo);
    // Solo referencia visual, nunca interés oficial inventado para meses no parametrizados.
    if(tasa==null && tipo==="TASA DIAN" && fecha){
      const ultima=referenciaTimTDJ(fecha,tasasMoratorias);
      if(ultima){
        box.textContent="ÚLTIMA TIM: "+(ultima.tasa*100).toFixed(3)+"% · "+ultima.periodo+" (REFERENCIA)";
        box.classList.add("sin-datos");
        box.title="La TIM de "+fecha.slice(0,7)+" no está parametrizada. Este porcentaje es solo la última tasa histórica disponible ("+ultima.periodo+"), NO la tasa oficial del título. No se utiliza en el cálculo.";
        return;
      }
      box.textContent="TASA OFICIAL PENDIENTE";
      box.classList.add("sin-datos");
      box.title="No hay TIM oficial parametrizada para "+fecha.slice(0,7)+". No se puede presentar un porcentaje como vigente.";
      return;
    }
    if(tasa==null && !["ART. 9 DECRETO 1419 DE 2026 - TRIBUTARIO","ART. 10 DECRETO 1419 DE 2026 - OMISAS TRIBUTARIAS","ART. 10 DECRETO 1419 DE 2026 - CORRECCIONES TRIBUTARIAS","ART. 20 DECRETO 1474 DE 2025","ART. 21 DECRETO 1474 DE 2025, OMISO- CORRECION","ART. 3 DECRETO 0240 DE 2026","ART. 4 DECRETO 0240 DE 2026, OMISO- CORRECCION"].includes(tipo)){
      box.textContent="TASA: SIN DATOS";box.classList.add("sin-datos");
    }else{
      box.textContent=`TASA: ${tasa==null?"SIN DATOS":(Number(tasa)*100).toFixed(3)+"%"}`;box.classList.toggle("sin-datos",tasa==null);
    }
    if(!fueraDeVentana)box.title=`${tipo} · FECHA TDJ ${fecha||"PENDIENTE"}`;
  }

  function crearSelect(titleId,index){
    const td=document.createElement("td");
    td.className="tdj-beneficio-visual";
    td.dataset.obligacionVisual=String(index+1);
    const select=document.createElement("select");
    select.className="tdj-beneficio-select";
    select.setAttribute("aria-label",`Tipo de tasa de la OBLIGACIÓN ${index+1}`);
    const actual=obtenerTipo(titleId,index);
    select.innerHTML=TIPOS.map(x=>`<option value="${esc(x)}"${x===actual?" selected":""}>${esc(x)}</option>`).join("");
    select.addEventListener("change",()=>{
      const tipo=upper(select.value||"TASA DIAN")||"TASA DIAN";
      seleccionVisual.set(claveSeleccion(titleId,index),tipo);
      actualizarMapaGlobal(titleId,index,tipo);
      const fecha=fechaISOVisual(tituloDeFila(titleId)?.querySelector('.fecha-campo')?.value||tituloDeFila(titleId)?.querySelector('.fecha-native')?.value||"");
      const rechazado=Boolean(fecha&&esBeneficio1419TDJ(tipo)&&!fechaElegible1419TDJ(fecha));
      mostrarTasa(td,select,titleId,index);
      if(rechazado){
        const numero=obtenerTDJDeFila(titleId)||"SIN NÚMERO";
        window.alert("BENEFICIO NO APLICABLE AL TÍTULO JUDICIAL\\n\\n"+
          "El TDJ "+numero+" constituido el "+fecha.split("-").reverse().join("/")+
          " no cumple los períodos permitidos para los artículos 9 y 10 del Decreto 1419 de 2026.\\n\\n"+
          "Fechas permitidas: hasta el 09/08/2026, o del 17/09/2026 al 19/11/2026 (inclusive).\\n\\n"+
          "Se ha seleccionado automáticamente TASA DIAN. Compruebe el porcentaje oficial correspondiente a la fecha.");
      }
      window.__tdjRateSelectionVersion=(Number(window.__tdjRateSelectionVersion||0)+1);
      window.dispatchEvent(new CustomEvent("tdj-tasa-selection-changed",{detail:{titleId,index,tipo:upper(select.value||"TASA DIAN")}}));
    });
    td.appendChild(select);
    mostrarTasa(td,select,titleId,index);
    return td;
  }

  function refrescarTasasVisuales(){
    document.querySelectorAll("#tablaTitulos tbody tr").forEach(tr=>{
      const titleId=tr.dataset.tituloId||"";
      tr.querySelectorAll(".tdj-beneficio-visual").forEach(td=>{
        const index=Math.max(0,Number(td.dataset.obligacionVisual||1)-1);
        const select=td.querySelector("select");
        if(select)mostrarTasa(td,select,titleId,index);
      });
    });
  }

  function sincronizarTDJSeleccion(titleId){
    const tdj=obtenerTDJDeFila(titleId);
    if(!tdj||!window.__tdjTasaPorTituloObligacion)return;
    obtenerObligaciones().forEach((_,index)=>{
      const tipo=seleccionVisual.get(claveSeleccion(titleId,index))||"TASA DIAN";
      window.__tdjTasaPorTituloObligacion.set(`${tdj}|${index}`,tipo);
    });
  }

  function reconstruirTabla(){
    if(pintando)return;
    const table=document.getElementById("tablaTitulos");
    if(!table)return;
    const head=table.tHead?.rows?.[0],body=table.tBodies?.[0];
    if(!head||!body)return;
    const obligaciones=obtenerObligaciones();
    const cantidad=Math.max(1,obligaciones.length);
    const detalles=obligaciones.map((card,i)=>detalleObligacion(card,i));
    const ids=[...body.rows].map(tr=>tr.dataset.tituloId||"").join(",");
    const firma=`${cantidad}|${detalles.join("||")}|${body.rows.length}|${ids}`;
    if(firma===ultimaFirma){sincronizarTipoDeObligacionLegacy();refrescarTasasVisuales();return;}
    pintando=true;
    try{
      instalarEstilos();
      sincronizarTipoDeObligacionLegacy();
      marcarObservacionLegacyHead(head);
      [...body.rows].forEach(marcarObservacionLegacy);
      head.querySelectorAll(":scope > .tdj-obligacion-head").forEach(el=>el.remove());
      body.querySelectorAll(":scope > tr").forEach(tr=>tr.querySelectorAll(":scope > .tdj-beneficio-visual").forEach(el=>el.remove()));
      const accionHead=head.querySelector(":scope > .tdj-accion-head")||head.cells[head.cells.length-1];
      if(!accionHead)return;
      accionHead.classList.add("tdj-accion-head");
      accionHead.textContent="ELIMINAR";
      obligaciones.forEach((_,i)=>{const th=document.createElement("th");th.className="tdj-obligacion-head";th.innerHTML=detalles[i];head.insertBefore(th,accionHead);});
      if(!obligaciones.length){const th=document.createElement("th");th.className="tdj-obligacion-head";th.textContent="OBLIGACIÓN 1";head.insertBefore(th,accionHead);}
      [...body.rows].forEach(tr=>{
        const titleId=tr.dataset.tituloId||"fila";
        const accion=tr.querySelector(":scope > .tdj-accion-cell")||tr.cells[tr.cells.length-1];
        if(!accion)return;
        accion.classList.add("tdj-accion-cell");
        for(let i=0;i<cantidad;i++)tr.insertBefore(crearSelect(titleId,i),accion);
        sincronizarTDJSeleccion(titleId);
      });
      ultimaFirma=firma;
      table.dataset.tdjVisualVersion="16.33.167";
      if(typeof window.__tdjResetMotorRateContext==="function")window.__tdjResetMotorRateContext();
    }finally{pintando=false;}
  }

  function iniciarMotorPuente(){
    Promise.all([
      import("./motor-liquidacion.js?v=16.33.161"),
      import("./motor-liquidacion.js?v=16.33.122"),
      import("./motor-liquidacion-oficial.js?v=16.33.161")
    ]).then(mods=>{
      const clases=[mods[0]?.MotorLiquidacion,mods[1]?.MotorLiquidacion,mods[2]?.MotorLiquidacionOficial].filter(Boolean);
      const parchear=Clase=>{
        const proto=Clase?.prototype;
        if(!proto||proto.__tdjTasaIndividual167)return;
        const original=proto.calcular;
        if(typeof original!=="function")return;
        proto.calcular=function(datos){
          const d=datos||{};
          const pagos=Array.isArray(d.pagos)?d.pagos:[];
          const tieneTDJ=pagos.some(p=>p?.esTDJ===true||String(p?.tdj||"").trim()!=="");
          const vtos=d.vencimientos;
          if(vtos){
            if(!window.__tdjMotorRateMap)window.__tdjMotorRateMap=new WeakMap();
            if(!window.__tdjMotorRateOrder)window.__tdjMotorRateOrder=[];
            if(!window.__tdjMotorRatePhase)window.__tdjMotorRatePhase="idle";
            if(!tieneTDJ && window.__tdjMotorRatePhase==="tdj" && window.__tdjMotorRateOrder[0]===vtos){
              window.__tdjMotorRateMap=new WeakMap();
              window.__tdjMotorRateOrder=[];
            }
            if(!window.__tdjMotorRateMap.has(vtos)){
              window.__tdjMotorRateMap.set(vtos,window.__tdjMotorRateOrder.length);
              window.__tdjMotorRateOrder.push(vtos);
            }
            const indice=Number(window.__tdjMotorRateMap.get(vtos)||0);
            if(tieneTDJ){
              window.__tdjMotorRatePhase="tdj";
              pagos.forEach(p=>{
                if(!(p?.esTDJ===true||String(p?.tdj||"").trim()!==""))return;
                const tdj=String(p?.tdj||"").trim();
                const mapa=window.__tdjTasaPorTituloObligacion;
                const seleccionado=upper(mapa?.get(`${tdj}|${indice}`)||"TASA DIAN")||"TASA DIAN";
                p.tipo=seleccionado;
                p.tipoTasaObligacion=seleccionado;
              });
            }else if(window.__tdjMotorRatePhase!=="tdj"){
              window.__tdjMotorRatePhase="base";
            }
          }
          return original.call(this,d);
        };
        proto.__tdjTasaIndividual167=true;
      };
      clases.forEach(parchear);
      window.__tdjResetMotorRateContext=()=>{
        window.__tdjMotorRateMap=new WeakMap();
        window.__tdjMotorRateOrder=[];
        window.__tdjMotorRatePhase="idle";
      };
      window.__tdjResetMotorRateContext();
    }).catch(err=>console.error("TDJ TASA INDIVIDUAL",err));
  }

  function iniciar(){
    const table=document.getElementById("tablaTitulos");
    if(!table)return;
    const root=document.getElementById("listaObligaciones");
    instalarEstilos();
    if(!window.__tdjTasaPorTituloObligacion)window.__tdjTasaPorTituloObligacion=new Map();
    reconstruirTabla();
    const repintar=()=>requestAnimationFrame(reconstruirTabla);
    const observer=new MutationObserver(repintar);
    observer.observe(table.tBodies?.[0]||table,{childList:true,subtree:true});
    if(root)observer.observe(root,{childList:true,subtree:true});
    document.addEventListener("change",e=>{
      if(e.target?.closest?.("#listaObligaciones")){ultimaFirma="";repintar();}
      if(e.target?.matches?.('#tablaTitulos [data-t="tdj"]')){
        const tr=e.target.closest("tr");if(tr)sincronizarTDJSeleccion(tr.dataset.tituloId||"");
      }
      if(e.target?.matches?.('#tablaTitulos .fecha-campo, #tablaTitulos .fecha-native')){
        requestAnimationFrame(refrescarTasasVisuales);
      }
    },true);
    document.addEventListener("input",e=>{
      if(e.target?.matches?.('#tablaTitulos [data-t="tdj"]')){
        const tr=e.target.closest("tr");if(tr)sincronizarTDJSeleccion(tr.dataset.tituloId||"");
      }
      if(e.target?.matches?.('#tablaTitulos .fecha-campo'))requestAnimationFrame(refrescarTasasVisuales);
    },true);
    window.addEventListener("tdj-tasa-selection-changed",()=>refrescarTasasVisuales());
    fetch("datos/tasas-moratorias.json",{cache:"no-store"}).then(r=>r.json()).then(data=>{tasasMoratorias=Array.isArray(data)?data:[];refrescarTasasVisuales();}).catch(()=>{});
    // v203: el core transmite identidad y tasas explícitas; sin inferencia por orden de simulación.
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
})();
