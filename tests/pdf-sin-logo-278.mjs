import fs from 'node:fs';
import assert from 'node:assert/strict';
const fuentes=['js/app.js','js/tdj-core-16.33.143.js','js/tdj-pdf-cierre-16.33.188.js','js/tdj-soporte-sancion-255.js'];
for(const f of fuentes){
 const s=fs.readFileSync(f,'utf8');
 assert.doesNotMatch(s,/<div class="pdf-logo">DIAN<\/div>/,f+': no debe generar el rótulo DIAN');
 assert.match(s,/<div class="pdf-marca"><div aria-hidden="true"><\/div><div class="pdf-titulo">/,f+': título en su misma columna');
}
console.log('PDF 278 OK: ningún encabezado de detalle, corte, sanción, resumen o cierre genera el rótulo DIAN');
