// COMPATIBILITY LOADER — TDJ PDF CIERRE v16.33.188
// Mantiene el import histórico de v16.33.187 y delega toda la presentación
// al cierre homologado v16.33.188.
(function(){
  "use strict";
  if(window.__tdjPdfCierre187)return;
  window.__tdjPdfCierre187=true;
  import("./tdj-pdf-cierre-16.33.188.js?v=16.33.188").catch(e=>console.warn("TDJ PDF cierre 188: no fue posible cargar la nueva capa de presentación.",e));
})();