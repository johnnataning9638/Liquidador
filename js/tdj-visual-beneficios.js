// TDJ v16.33.162 — PRESENTACIÓN ÚNICAMENTE.
// Este módulo modifica exclusivamente la interfaz de la tabla de títulos.
// NO escribe sobre obligaciones, títulos, pagos, motor ni resultados.
(function(){
  "use strict";

  const BENEFICIOS = [
    "SIN BENEFICIO",
    "ART. 3 D. 0240",
    "ART. 4 D. 0240",
    "ART. 9 D. 1419",
    "ART. 10 D. 1419"
  ];

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",\"":"&quot;","'":"&#039;"
  }[m]));

  function obligaciones(){
    const root=document.getElementById("listaObligaciones");
    if(!root)return [];
    const cards=[...root.querySelectorAll(".obligacion-card")];
    if(cards.length)return cards;
    return [...root.children];
  }

  function detalleObligacion(card,index){
    const concepto=card?.querySelector('select[id*="concepto"], [data-campo="concepto"]')?.value || "";
    const anio=card?.querySelector('input[id*="anio"], [data-campo="anio"]')?.value || "";
    const periodo=card?.querySelector('select[id*="periodo"], input[id*="periodo"], [data-campo="periodo"]')?.value || "";
    const detalle=[concepto, anio && String(anio), periodo && `P${periodo}`].filter(Boolean).join(" ");
    return detalle ? `OBLIGACIÓN ${index+1}<span class="tdj-obligacion-detalle">${esc(detalle)}</span>` : `OBLIGACIÓN ${index+1}`;
  }

  function crearSelect(index){
    const td=document.createElement("td");
    td.className="tdj-beneficio-visual";
    td.dataset.obligacionVisual=String(index+1);
    const select=document.createElement("select");
    select.className="tdj-beneficio-select";
    select.setAttribute("aria-label",`Beneficio visual de la obligación ${index+1}`);
    select.dataset.visualOnly="true";
    select.innerHTML=BENEFICIOS.map((x,i)=>`<option value="${esc(x)}"${i===0?" selected":""}>${esc(x)}</option>`).join("");
    // Intencionalmente no se registra ningún listener de cálculo.
    td.appendChild(select);
    return td;
  }

  function reconstruirTabla(){
    const table=document.getElementById("tablaTitulos");
    if(!table)return;
    const lista=obligaciones();
    const cantidad=Math.max(1,lista.length);
    const head=table.tHead;
    const row=head?.rows?.[0];
    if(!row)return;

    // Primera pasada: dejamos intactas las cuatro columnas de datos del TDJ
    // y el último botón de eliminación; solo reconstruimos la zona visual.
    while(row.cells.length>4)row.deleteCell(4);
    for(let i=0;i<cantidad;i++){
      const th=document.createElement("th");
      th.className="tdj-obligacion-head";
      th.innerHTML=detalleObligacion(lista[i],i);
      row.appendChild(th);
    }
    const thAcc=document.createElement("th");
    thAcc.className="tdj-accion-head";
    thAcc.textContent="ELIMINAR";
    row.appendChild(thAcc);

    const body=table.tBodies?.[0];
    if(!body)return;
    [...body.rows].forEach(tr=>{
      // El núcleo TDJ ya creó las primeras cuatro celdas y una celda final
      // con la acción. No tocamos inputs ni handlers de esas celdas.
      while(tr.cells.length>4)tr.deleteCell(4);
      for(let i=0;i<cantidad;i++)tr.appendChild(crearSelect(i));
      const accion=document.createElement("td");
      accion.className="tdj-accion-visual";
      const boton=document.createElement("button");
      boton.type="button";
      boton.className="peligro small tdj-eliminar-proxy";
      boton.textContent="Eliminar";
      // El botón visual delega al botón real creado por el núcleo, sin alterar
      // su lógica. Si no existe, no hace nada.
      boton.addEventListener("click",function(){
        const reales=[...tr.querySelectorAll("button")].filter(x=>x!==boton);
        const real=reales.find(x=>/eliminar|trash|remove/i.test(String(x.textContent||"")+' '+String(x.getAttribute('aria-label')||"")));
        if(real)real.click();
      });
      accion.appendChild(boton);
      tr.appendChild(accion);
    });

    table.dataset.tdjVisualVersion="16.33.162";
  }

  function iniciar(){
    const table=document.getElementById("tablaTitulos");
    const root=document.getElementById("listaObligaciones");
    if(!table)return;

    reconstruirTabla();

    const observer=new MutationObserver(()=>{
      if(table.dataset.tdjVisualLock)return;
      table.dataset.tdjVisualLock="1";
      requestAnimationFrame(()=>{
        table.dataset.tdjVisualLock="";
        reconstruirTabla();
      });
    });
    observer.observe(table.tBodies?.[0] || table,{childList:true,subtree:true});
    if(root)observer.observe(root,{childList:true,subtree:true});

    // Cambios en los datos de las obligaciones solo actualizan los encabezados.
    document.addEventListener("change",function(e){
      if(e.target?.closest?.("#listaObligaciones"))requestAnimationFrame(reconstruirTabla);
    },true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
})();
