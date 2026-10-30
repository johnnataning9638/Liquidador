import fs from 'node:fs';
import {revertirCambios264} from './alcance-retiro-campos-264.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
// Esta auditoría verifica exactamente el core actual contra 248 y solo admite
// las tres modificaciones de presentación PDF autorizadas para 249.
import './resumen-sin-titulos-249.mjs';
const read=f=>fs.readFileSync(f,'utf8');
assert.doesNotMatch(read('liquidacion.html'),/auditoria-panel|resultadoAuditoria|btnGenerarAuditoria|Auditoría y trazabilidad/);
assert.doesNotMatch(read('js/app.js'),/AuditoriaTrazabilidad|construirAuditoria|renderAuditoria|ultimaAuditoria|resultadoAuditoria|btnGenerarAuditoria|auditoria-trazabilidad/);
assert.doesNotMatch(read('estilos.css'),/\.audit-|\.auditoria-panel|\.resultado-auditoria/);
assert.equal(fs.existsSync('js/auditoria-trazabilidad.js'),false);
const manifest=JSON.parse(read('runtime-manifest.json'));
assert.ok(!manifest.files.includes('js/auditoria-trazabilidad.js'));
assert.ok(!Object.hasOwn(manifest.protected,'js/auditoria-trazabilidad.js'));
assert.match(read('js/app.js'),/motor\.validarObligacion\(d\)/,'Conservar la validación necesaria para calcular');
const baseline=f=>execFileSync('git',['show',`0f6898ebfa04f77b8358fe74e3f01e9273a8e4fb:${f}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
for(const f of ['js/tdj-core-16.33.143.js','js/tdj-pegado-unico-209.js']){
 const preserved=f==='js/tdj-core-16.33.143.js'
  ?execFileSync('git',['show',`47bfdab7eda02cc8e2f3fc43f52cc9c2993492e6:${f}`],{encoding:'utf8'})
  :read(f);
 assert.equal(preserved.replace(/\r\n/g,'\n'),baseline(f),f+' conserva exactamente color, cálculo y pegado; cambio PDF 249 auditado por separado');
}
const app=revertirCambios264(read('js/app.js'),'js/app.js'),base=baseline('js/app.js');
for(const [start,end] of [['function xlsxCol(','function construirDatosSoporte('],['function exportarExcel(','function escPdf('],['function exportarPdf(','function mostrarEstadoExportacion(']]){
 assert.equal(app.slice(app.indexOf(start),app.indexOf(end)),base.slice(base.indexOf(start),base.indexOf(end)),'Exportación y colores DIAN intactos: '+start);
}
console.log('AUDITORIA 244 OK: panel, módulo, estilos y conexiones retirados; validación de cálculo conservada');
