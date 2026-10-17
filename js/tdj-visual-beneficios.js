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

  function instalarEstilos(){
    if(document.getElementById("tdj-visual-beneficios-style"))return;
    const style=document.createElement("style");
    style.id="tdj-visual-beneficios-style";
    style.textContent=`
      #tablaTitulos{table-layout:fixed;width:100%;min-width:0}
      #tablaTitulos th,#tablaTitulos td{vertical-align:middle}
      #tablaTitulos .tdj-obligacion-head{background:#e8eef3;color:#173047;text-align:center;font-size:10px;text-transform:uppercase;white-space:normal;line-height:1.2}
      #tablaTitulos .tdj-obligacion-detalle{display:block;margin-top:2px;font-size:9px;font-weight:600;color:#687783;text-transform:none}
      #tablaTitulos .tdj-beneficio-visual{padding:5px 6px;min-width:125px}
      #tablaTitulos .tdj-beneficio-select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #aebbc8;border-radius:5px;padding:6px 7px;background:#fff;color:#173047;font-size:11px}
      #tablaTitulos .tdj-beneficio-select:focus{outline:2px solid #8eb8cf;outline-offset:1px}
      #tablaTitulos .tdj-observacion-legacy{display:none!important}
      #tablaTitulos .tdj-accion-head,#tablaTitulos .tdj-accion-cell{white-space:nowrap;text-align:center}
      @media(max-width:900px){#tablaTitulos{min-width:900px}.tdj-beneficio-select{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

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
    // No hay listener ni escritura sobre el estado del liquidador.
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
    const body=table.tBodies?.[0];
    if(!row || !body)return;

    const detalles=lista.map((card,i)=>detalleObligacion(card,i));
    const firma=`${cantidad}|${detalles.join("||")}`;
    const visualHeadCount=[...row.cells].filter(c=>c.classList.contains("tdj-obligacion-head")).length;
    const visualRowOk=[...body.rows].every(tr=>tr.querySelectorAll(":scope > .tdj-beneficio-visual").length===cantidad);
    if(table.dataset.tdjVisualSignature===firma && visualHeadCount===cantidad && visualRowOk)return;

    instalarEstilos();

    // Conservamos el campo OBSERVACIÓN real en el DOM para no afectar
    // importación, estado ni cálculo; visualmente solo se oculta.
    if(row.cells[4])row.cells[4].classList.add("tdj-observacion-legacy");

    // Limpiar únicamente las columnas visuales creadas por esta capa.
    row.querySelectorAll(":scope > .tdj-obligacion-head").forEach(el=>el.remove());

    // Las columnas nuevas se insertan antes de la acción existente.
    const accionHead=row.cells[row.cells.length-1];
    for(let i=0;i<cantidad;i++){
      const th=document.createElement("th");
      th.className="tdj-obligacion-head";
      th.innerHTML=detalles[i];
      row.insertBefore(th,accionHead);
    }
    accionHead.classList.add("tdj-accion-head");
    accionHead.textContent="ELIMINAR";

    [...body.rows].forEach(tr=>{
      tr.querySelectorAll(":scope > .tdj-beneficio-visual").forEach(el=>el.remove());
      if(tr.cells[4])tr.cells[4].classList.add("tdj-observacion-legacy");
      const accion=tr.cells[tr.cells.length-1];
      if(accion)accion.classList.add("tdj-accion-cell");
      for(let i=0;i<cantidad;i++)tr.insertBefore(crearSelect(i),accion||null);
    });

    table.dataset.tdjVisualSignature=firma;
    table.dataset.tdjVisualVersion="16.33.162";
  }

  function iniciar(){
    const table=document.getElementById("tablaTitulos");
    const root=document.getElementById("listaObligaciones");
    if(!table)return;
    instalarEstilos();
    reconstruirTabla();

    const observer=new MutationObserver(()=>{
      // El núcleo puede reconstruir las filas al agregar/importar/eliminar.
      // Solo se vuelve a pintar si realmente falta la capa visual.
      requestAnimationFrame(reconstruirTabla);
    });
    observer.observe(table.tBodies?.[0] || table,{childList:true,subtree:true});
    if(root)observer.observe(root,{childList:true,subtree:true});

    document.addEventListener("change",function(e){
      if(e.target?.closest?.("#listaObligaciones"))requestAnimationFrame(reconstruirTabla);
    },true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
  else iniciar();
})();
