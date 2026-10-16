import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../js/tdj.js",import.meta.url),"utf8");

// El botón LIMPIAR de TÍTULOS/TJ pertenece a data-pane="titulos".
// La ruta actual debe llevarlo a limpiarTodo(), no a una limpieza aislada.
assert.match(
  source,
  /document\.querySelectorAll\("\.btn-limpiar-tdj"\)\.forEach\(b=>b\.addEventListener\("click",\(\)=>\{const pane=b\.closest\("\.tab-pane"\)\?\.dataset\.pane;if\(pane==="datos"\)limpiarDatosPestanaTDJ\(\);else if\(pane==="pagos"\)limpiarPagosPestanaTDJ\(\);else limpiarTodo\(\);\}\)\)/,
  "El botón LIMPIAR de TÍTULOS/TJ debe ejecutar limpieza global."
);

// La limpieza global debe reiniciar los cuatro bloques funcionales.
assert.match(source,/obligaciones=\[nuevaObligacion\(1\)\];titulos=\[\];resultado=null;resultadoDesactualizado=false/);
assert.match(source,/renderObligaciones\(\);renderPagos\(\);renderTitulos\(\);actualizarSelectoresImportacion\(\)/);
assert.match(source,/limpiarCampo\(\$\("importarTitulosTexto"\)\)/);

console.log("OK: LIMPIAR en TÍTULOS/TJ ejecuta limpieza global de Datos, Pagos, Títulos y Resultados.");
