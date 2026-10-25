import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
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
for(const f of ['js/tdj-core-16.33.143.js','js/tdj-pegado-unico-209.js'])assert.equal(read(f).replace(/\r\n/g,'\n'),baseline(f),f+' conserva exactamente color, cálculo y pegado actuales');
const app=read('js/app.js').replace(/\r\n/g,'\n'),base=baseline('js/app.js');
for(const [start,end] of [['function xlsxCol(','function construirDatosSoporte('],['function exportarExcel(','function escPdf('],['function exportarPdf(','function mostrarEstadoExportacion(']]){
 assert.equal(app.slice(app.indexOf(start),app.indexOf(end)),base.slice(base.indexOf(start),base.indexOf(end)),'Exportación y colores DIAN intactos: '+start);
}
console.log('AUDITORIA 244 OK: panel, módulo, estilos y conexiones retirados; validación de cálculo conservada');
