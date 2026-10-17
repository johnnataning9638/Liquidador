import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('js/app.js','utf8');
const tdj=fs.readFileSync('js/tdj-core-16.33.143.js','utf8');
assert.ok(app.includes('\n}\n\nfunction crc32('),'app.js no tiene cierre de xlsxSheet antes de crc32');
assert.ok(tdj.includes('\n}\n\nfunction crc32TDJ('),'tdj-core no tiene cierre de xlsxSheetTDJ antes de crc32TDJ');
for(const f of ['liquidacion.html','titulos.html','js/app.js','js/tdj-core-16.33.143.js','js/tdj.js','js/prioridad-tdj-v132.js']) assert.match(fs.readFileSync(f,'utf8'),/16\.33\.161/);
for(const f of ['datos/uvt.json','datos/tasas-moratorias.json','datos/ipc.json','datos/beneficios.json','datos/sanciones.json','datos/reglas-obligaciones.json','datos/calendario.json','datos/reglas-historicas.json']) JSON.parse(fs.readFileSync(f,'utf8'));
console.log('REGRESION PARAMETROS 16.33.161 OK');
