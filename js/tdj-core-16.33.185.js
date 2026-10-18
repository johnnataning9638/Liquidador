// TDJ v16.33.185 — PUENTE DE SECUENCIA CRONOLÓGICA.
//
// CORRECCIÓN AISLADA:
// El core histórico calcula correctamente la aplicación económica del TDJ,
// pero una capa de prioridad podía sobrescribir pagoActual.valor con un valor
// ajustado para pagos posteriores. Ese valor NO es el valor aplicado por el
// motor y terminaba contaminando la trazabilidad, el excedente y el arrastre
// hacia la siguiente obligación.
//
// Esta capa mantiene intacto el core histórico y reemplaza únicamente esa
// asignación por una operación neutra. El motor conserva la fuente de verdad
// para "aplicado" y "excedente"; la prioridad de cierre/arrastre continúa
// funcionando mediante prioridad-tdj-v132.js.

(async function(){
  "use strict";
  const originalUrl=new URL("./tdj-core-16.33.143.js?v=16.33.143",import.meta.url);
  const response=await fetch(originalUrl,{cache:"no-store"});
  if(!response.ok)throw new Error(`No se pudo cargar el core TDJ histórico (${response.status}).`);
  let source=await response.text();

  const objetivo='if(pagoAjustado)pagoActual.valor=truncarValorEntero(pagoAjustado.valor);';
  const reemplazo='if(pagoAjustado){pagoActual.__tdjAjustePrioridad=truncarValorEntero(pagoAjustado.valor);}\n        // v16.33.185: el valor ajustado para priorización NO sustituye el nominal disponible.\n        // La aplicación efectiva y el excedente son exclusivamente los calculados por el motor.';
  if(!source.includes(objetivo)){
    throw new Error("Patrón de seguridad TDJ v16.33.185 no encontrado; se detiene la carga para evitar ejecutar una versión incompatible.");
  }
  source=source.replace(objetivo,reemplazo);

  // Un Blob URL no resuelve imports relativos respecto del repositorio. Los
  // convertimos a URLs absolutas del mismo directorio antes de importar el core.
  const base=new URL("./",originalUrl).href;
  source=source.replace(/from\s+(["'])\.\//g,(m,q)=>`from ${q}${base}`);
  source=source.replace(/import\(\s*(["'])\.\//g,(m,q)=>`import(${q}${base}`);

  const blobUrl=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
  try{
    await import(blobUrl);
  }finally{
    URL.revokeObjectURL(blobUrl);
  }
})();
