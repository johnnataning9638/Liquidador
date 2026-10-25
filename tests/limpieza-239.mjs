import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const removed=['.excel158-trigger',...['D','E','F','G'].map(x=>`TRIGGER_PDF_114${x}.txt`),'js/estilos.css','js/export-dian-tdj-control-16.33.177.js','js/export-lian-complete-16.33.179.js','js/export-tdj-recovery-16.33.174.js','js/importador-tdj.js',...['190','191'].map(x=>`js/tdj-import-beneficio-16.33.${x}.js`),'js/tdj-pdf-cierre-16.33.187.js',...['175','176','177','178','181','182','183','184'].map(x=>`js/tdj-secuencia-guard-16.33.${x}.js`),...['169','170','171','172'].map(x=>`js/tdj-tasa-bridge-16.33.${x}.js`),'.github/workflows/apply-importacion-opcional.yml','.github/workflows/correctivo-secuencia-tdj-149.yml','scripts/aplicar-fix-importacion-opcional.mjs'];
for(const f of removed)assert.equal(fs.existsSync(f),false,`${f} no se utiliza y debe estar retirado`);
const manifest=JSON.parse(fs.readFileSync('runtime-manifest.json','utf8'));
for(const [f,expected] of Object.entries(manifest.protected)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
 assert.equal(actual,expected,`${f}: se prohíbe cambiar fórmulas o capas matemáticas`);
 const baseline=execFileSync('git',['show',`627b181fb2c56a9e67e578fa72ea1fc129fc950a:${f}`]);
 assert.equal(crypto.createHash('sha256').update(baseline.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),expected,`${f}: conservar exactamente la versión aprobada`);
}
assert.equal(manifest.version,JSON.parse(fs.readFileSync('version.json','utf8')).version);
for(const f of manifest.files)assert.ok(fs.existsSync(f),`Recurso publicado faltante: ${f}`);
assert.equal(fs.readFileSync('supabase/migrations/20261025023900_parametros_monitor_cron.sql','utf8').includes("0 10 * * *"),true);
console.log('LIMPIEZA 239 OK: archivos retirados, recursos vigentes y hashes de cálculos preservados');
