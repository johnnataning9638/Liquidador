import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('js/app.js','utf8');
const tdj=fs.readFileSync('js/tdj-core-16.33.143.js','utf8');
assert.match(app,/function xlsxSheet\([^\n]+\}\=\{\}\)\{/);
assert.match(tdj,/function xlsxSheetTDJ\([^\n]+\}\=\{\}\)\{/);
for(const f of ['datos/uvt.json','datos/tasas-moratorias.json','datos/ipc.json','datos/beneficios.json','datos/sanciones.json','datos/reglas-obligaciones.json','datos/calendario.json','datos/reglas-historicas.json']){
  JSON.parse(fs.readFileSync(f,'utf8'));
}
for(const f of ['liquidacion.html','titulos.html','js/app.js','js/tdj-core-16.33.143.js']){
  assert.match(fs.readFileSync(f,'utf8'),/16\.33\.159/);
}
console.log('REGRESION PARAMETROS 16.33.159 OK');
