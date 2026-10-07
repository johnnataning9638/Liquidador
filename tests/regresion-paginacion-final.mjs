import fs from 'node:fs';
for(const f of ['js/app.js','js/tdj.js']){
  const s=fs.readFileSync(f,'utf8');
  if(!s.includes('pdf-resumen-final-agrupado')) throw new Error(`Agrupador ausente: ${f}`);
}
const c=fs.existsSync('estilos.css')?fs.readFileSync('estilos.css','utf8'):fs.readFileSync('js/estilos.css','utf8');
if(!c.includes('.pdf-resumen-final-agrupado > .pdf-hoja')) throw new Error('CSS de agrupación ausente');
if(!c.includes('break-inside:avoid-page')) throw new Error('Protección de bloque ausente');
console.log('REGRESION_PAGINACION_FINAL_OK');
