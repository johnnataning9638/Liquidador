// TDJ v16.33.164 — DISEÑO DE TÍTULOS POR OBLIGACIÓN.
// PRESENTACIÓN ÚNICAMENTE: NO MODIFICA EL MOTOR, CÁLCULOS, PAGOS NI RESULTADOS.
(function(){
  "use strict";

  // Catálogo acordado en el diseño aprobado.
  const BENEFICIOS = [
    "SIN BENEFICIO",
    "ART. 3 D. 0240",
    "ART. 4 D. 0240",
    "ART. 9 D. 1419",
    "ART. 10 D. 1419"
  ];

  // La selección es exclusivamente visual. Se conserva mientras la fila
  // exista, pero NO se escribe en el objeto del motor ni alimenta cálculos.
  const seleccionVisual = new Map();
  let ultimaFirma = "";
  let pintando = false;

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));

  function instalarEstilos(){
    if(document.getElementById("tdj-visual-obligaciones-style"))return;
    const style=document.createElement("style");
    style.id="tdj-visual-obligaciones-style";
    style.textContent=`
      #tablaTitulos{table-layout:fixed;width:100%;min-width:1120px}
      #tablaTitulos th,#tablaTitulos td{vertical-align:middle}
      #tablaTitulos th.tdj-obligacion-head{
        background:#e8eef3;color:#173047;text-align:center;font-size:10px;
        text-transform:uppercase;white-space:normal;line-height:1.2;padding:7px 6px;
      }
      #tablaTitulos .tdj-obligacion-detalle{
        display:block;margin-top:2px;font-size:9px;font-weight:600;
        color:#687783;text-transform:none;white-space:normal;
      }
      #tablaTitulos td.tdj-beneficio-visual{padding:5px 6px;min-width:145px}
      #tablaTitulos select.tdj-beneficio-select{
        width:100%;min-width:0;box-sizing:border-box;border:1px solid #aebbc8;
        border-radius:5px;padding:7px 8px;background:#fff;color:#173047;
        font-size:11px;height:34px;
      }
      #tablaTitulos select.tdj-beneficio-select:focus{
        outline:2px solid #8eb8cf;outline-offset:1px;
      }
      #tablaTitulos .tdj-observacion-legacy{display:none!important}
      #tablaTitulos .tdj-accion-head,#tablaTitulos .tdj-accion-cell{
        white-space:nowrap;text-align:center;
      }
      #tablaTitulos th.tdj-obligacion-head,
      #tablaTitulos td.tdj-beneficio-visual{width:auto}
      @media(max-width:900px){
        #tablaTitulos{min-width:1120px}
        #tablaTitulos select.tdj-beneficio-select{font-size:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function obtenerObligaciones(){
    const root=document.getElementById("listaObligaciones");
    if(!root)return [];
    return [...root.querySelectorAll(":scope > .obligacion-card")];
  }

  function valorCampo(card,selector){
    return String(card?.querySelector(selector)?.value || "").trim();
  }

  function detalleObligacion(card,index){
    const concepto=valorCampo(card,'[data-k="concepto"]');
    const anio=valorCampo(card,'[data-k="anio"]');
    const periodo=valorCampo(card,'[data-k="periodo"]');
    const detalle=[concepto,anio,periodo ? `P${periodo}` : ""].filter(Boolean).join(" ");
    return detalle
      ? `OBLIGACIÓN ${index+1}<span class="tdj-obligacion-detalle">${esc(detalle)}</span>`
      : `OBLIGACIÓN ${index+1}`;
  }

  function marcarObservacionLegacy(row){
    const obs=row?.querySelector?.('[data-t="observacion"]');
    const td=obs?.closest("td");
    if(td)td.classList.add("tdj-observacion-legacy");
  }

  function marcarObservacionLegacyHead(head){
    const cells=[...head.cells];
    const cell=cells.find(c=>String(c.textContent||"").trim().toUpperCase()==="OBSERVACIÓN");
    if(cell)cell.classList.add("tdj-observacion-legacy");
  }

  function claveSeleccion(titleId,index){
    return `${titleId}|${index}`;
  }

  function crearSelect(titleId,index){
    const td=document.createElement("td");
    td.className="tdj-beneficio-visual";
    td.dataset.obligacionVisual=String(index+1);

    const select=document.createElement("select");
    select.className="tdj-beneficio-select";
    select.dataset.visualOnly="true";
    select.setAttribute("aria-label",`Beneficio visual de la OBLIGACIÓN ${index+1}`);

    const clave=claveSeleccion(titleId,index);
    const actual=seleccionVisual.get(clave) || BENEFICIOS[0];
    select.innerHTML=BENEFICIOS.map(x=>
      `<option value="${esc(x)}"${x===actual?" selected":""}>${esc(x)}</option>`
    ).join("");

    // IMPORTANTE: este cambio no toca el estado del motor.
    select.addEventListener("change",()=>{
      seleccionVisual.set(clave,select.value);
    });

    td.appendChild(select);
    return td;
  }

  function reconstruirTabla(){
    if(pintando)return;
    const table=document.getElementById("tablaTitulos");
    if(!table)return;
    const head=table.tHead?.rows?.[0];
    const body=table.tBodies?.[0];
    if(!head || !body)return;

    const obligaciones=obtenerObligaciones();
    const cantidad=Math.max(1,obligaciones.length);
    const detalles=obligaciones.map((card,i)=>detalleObligacion(card,i));
    const ids=[...body.rows].map(tr=>tr.dataset.tituloId||"").join(",");
    const firma=`${cantidad}|${detalles.join("||")}|${body.rows.length}|${ids}`;
    if(firma===ultimaFirma)return;

    pintando=true;
    try{
      instalarEstilos();

      // La tabla base conserva OBSERVACIÓN internamente para no alterar el motor.
      marcarObservacionLegacyHead(head);
      [...body.rows].forEach(marcarObservacionLegacy);

      // Retirar únicamente la presentación agregada por esta capa.
      head.querySelectorAll(":scope > .tdj-obligacion-head").forEach(el=>el.remove());
      body.querySelectorAll(":scope > tr").forEach(tr=>
        tr.querySelectorAll(":scope > .tdj-beneficio-visual").forEach(el=>el.remove())
      );

      const accionHead=head.querySelector(":scope > .tdj-accion-head") || head.cells[head.cells.length-1];
      if(!accionHead)return;
      accionHead.classList.add("tdj-accion-head");
      accionHead.textContent="ELIMINAR";

      // Generación horizontal: OBLIGACIÓN 1 por defecto y las siguientes hacia la derecha.
      obligaciones.forEach((_,i)=>{
        const th=document.createElement("th");
        th.className="tdj-obligacion-head";
        th.innerHTML=detalles[i];
        head.insertBefore(th,accionHead);
      });

      // Si por alguna razón el contenedor aún no tiene obligación, siempre mostramos OBLIGACIÓN 1.
      if(!obligaciones.length){
        const th=document.createElement("th");
        th.className="tdj-obligacion-head";
        th.textContent="OBLIGACIÓN 1";
        head.insertBefore(th,accionHead);
      }

      [...body.rows].forEach(tr=>{
        const titleId=tr.dataset.tituloId || "fila";
        const accion=tr.querySelector(":scope > .tdj-accion-cell") || tr.cells[tr.cells.length-1];
        if(!accion)return;
        accion.classList.add("tdj-accion-cell");
        for(let i=0;i<cantidad;i++)tr.insertBefore(crearSelect(titleId,i),accion);
      });

      ultimaFirma=firma;
      table.dataset.tdjVisualVersion="16.33.164";
    }finally{
      pintando=false;
    }
  }

  function iniciar(){
    const table=document.getElementById("tablaTitulos");
    if(!table)return;
    const root=document.getElementById("listaObligaciones");
    instalarEstilos();
    reconstruirTabla();

    const repintar=()=>requestAnimationFrame(reconstruirTabla);
    const observer=new MutationObserver(repintar);
    observer.observe(table.tBodies?.[0] || table,{childList:true,subtree:true});
    if(root)observer.observe(root,{childList:true,subtree:true});

    // Los cambios de Datos y vencimientos deben reflejarse inmediatamente en las columnas.
    document.addEventListener("change",e=>{
      if(e.target?.closest?.("#listaObligaciones")){
        ultimaFirma="";
        repintar();
      }
    },true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
})();
