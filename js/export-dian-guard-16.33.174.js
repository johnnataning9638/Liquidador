// Cargador exclusivo del parche de recuperación XLSX del Liquidador DIAN.
// El módulo TDJ también usa importador-excel.js, por lo que la carga debe quedar
// explícitamente aislada para no tocar su exportación.
if(typeof document !== "undefined" && !document.getElementById("tablaTitulos")){
  await import("./export-tdj-recovery-16.33.174.js?v=16.33.174");
}
