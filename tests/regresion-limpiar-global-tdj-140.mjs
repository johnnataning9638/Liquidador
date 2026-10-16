import fs from "node:fs";

const tdj = fs.readFileSync("js/tdj.js", "utf8");
const titulos = fs.readFileSync("titulos.html", "utf8");

if (!tdj.includes('else limpiarTodo();')) {
  throw new Error('El botón LIMPIAR de TÍTULOS/TJ no está conectado a limpiarTodo().');
}
if (!tdj.includes('obligaciones=[nuevaObligacion(1)];titulos=[];resultado=null;resultadoDesactualizado=false;')) {
  throw new Error('La limpieza global no restablece obligaciones, títulos y resultado.');
}
if (!tdj.includes('renderObligaciones();renderPagos();renderTitulos();actualizarSelectoresImportacion();')) {
  throw new Error('La limpieza global no actualiza Datos, Pagos y Títulos.');
}
if (!tdj.includes('limpiarCampo($("importarTitulosTexto"));')) {
  throw new Error('La limpieza global no elimina el contenido residual del importador TDJ.');
}
if (!titulos.includes('js/tdj.js?v=16.33.140')) {
  throw new Error('La página TÍTULOS/TJ no está apuntando al bundle versionado v16.33.140.');
}
if (titulos.includes('js/tdj.js?v=16.33.123')) {
  throw new Error('La página TÍTULOS/TJ conserva la referencia antigua v16.33.123.');
}

console.log('OK: LIMPIAR desde TÍTULOS/TJ ejecuta limpieza global y la página usa tdj.js v16.33.140.');
