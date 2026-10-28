import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const patches=JSON.parse(fs.readFileSync(new URL('./fixtures/cambios-presentacion-sancion-255.json',import.meta.url),'utf8'));
export function revertirCambios255(source,file){
 source=source.replace(/\r\n/g,'\n');
 if(file==='js/tdj-core-16.33.143.js'){
  source=source.replace(/  \/\/ PDF TDJ: misma plantilla azul de DIAN también cuando hay cuotas,[\s\S]*?\n  return \`<article class="pdf-liquidacion pdf-detalle-dian pdf-proyeccion-corte">/, m=>m.slice(m.lastIndexOf('  return \`<article')));
  source=source.replace('resultado.resumenObligaciones.some(x=>esSoloSancionSinPagosTDJ(x)||fechaCorteProyeccionPDFTDJ(x))?estilosSancionTDJ():""', 'resultado.resumenObligaciones.some(esSoloSancionSinPagosTDJ)?estilosSancionTDJ():""');
 }
 if(file==='js/tdj.js')source=source.replace('tdj-core-16.33.143.js?v=16.33.258','tdj-core-16.33.143.js?v=16.33.257');
 if(file==='js/tdj-core-16.33.143.js')source=source.replace(`      // Restaurar la fila visible si un cálculo anterior descartó una cuota de valor cero.\n      // De lo contrario, escribir impuesto después de liquidar solo sanción no se procesa.\n      let v=o.vencimientos.find(x=>x.id===tr.dataset.vtoId);\n      if(!v){v={id:tr.dataset.vtoId,numero:o.vencimientos.length+1,periodo:o.vencimientos.length+1,fecha:"",impuesto:0};o.vencimientos.push(v);}`, '      const v=o.vencimientos.find(x=>x.id===tr.dataset.vtoId); if(!v)return;');
 if(file==='js/tdj.js')source=source.replace('tdj-core-16.33.143.js?v=16.33.257','tdj-core-16.33.143.js?v=16.33.256');
 if(file==='js/tdj.js')source=source.replace('tdj-core-16.33.143.js?v=16.33.256','tdj-core-16.33.143.js?v=16.33.255');
 if(file==='js/tdj-core-16.33.143.js'){
  source=source.replace(`  // El detalle de solo sanción permanece exclusivamente en el PDF.\n  // La pantalla conserva únicamente el resultado de aplicación de títulos.\n  document.getElementById("soporteSancionDianTDJ")?.remove();`, '  pintarSoporteSancionTDJ(r);').replace(`    sincronizarCapturaManualTDJ();\n    // La elegibilidad`, '    // La elegibilidad').replace(`    // Invalidar siempre la liquidación anterior, aun si no se detectó un evento change.\n    resultado=null;\n    resultadoDesactualizado=true;\n    ajustarBaseProporcionalTDJ208(motor);`,'    ajustarBaseProporcionalTDJ208(motor);');
 }
 for(const [before,after] of [...(patches[file]||[])].reverse()){
  assert.ok(source.includes(after),file+': soporte de solo sanción delimitado');source=source.replace(after,before);
 }
 return source;
}
for(const file of Object.keys(patches)){
 let original=fs.readFileSync(file,'utf8');
 if(file==='js/tdj.js')original=original.replace('tdj-core-16.33.143.js?v=16.33.256','tdj-core-16.33.143.js?v=16.33.255');
 if(file==='js/tdj-core-16.33.143.js'){
  original=original.replace(`  // El detalle de solo sanción permanece exclusivamente en el PDF.\n  // La pantalla conserva únicamente el resultado de aplicación de títulos.\n  document.getElementById("soporteSancionDianTDJ")?.remove();`, '  pintarSoporteSancionTDJ(r);').replace(`    sincronizarCapturaManualTDJ();\n    // La elegibilidad`, '    // La elegibilidad').replace(`    // Invalidar siempre la liquidación anterior, aun si no se detectó un evento change.\n    resultado=null;\n    resultadoDesactualizado=true;\n    ajustarBaseProporcionalTDJ208(motor);`,'    ajustarBaseProporcionalTDJ208(motor);');
 }
 assert.equal(revertirCambios255(original,file),execFileSync('git',['show','d0f6d51:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+': solo presentación TDJ');
}
for(const file of ['js/app.js','js/motor-liquidacion.js','js/motor-liquidacion-base.js','js/motor-liquidacion-oficial.js'])assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','d0f6d51:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file+': DIAN y motores intactos');
console.log('ALCANCE 255 OK: únicamente presentación TDJ; DIAN y motores idénticos a 254');
