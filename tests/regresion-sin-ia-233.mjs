import fs from 'node:fs';
import assert from 'node:assert/strict';
const {version}=JSON.parse(fs.readFileSync('version.json','utf8'));
for(const file of ['liquidacion.html','titulos.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(html,/IMPORTAR IA|Importar IA|indicador-ia/);
  assert.ok(html.includes(version),file+' debe mostrar la versión vigente');
}
for(const file of ['js/app.js','js/tdj-core-16.33.143.js','js/importador-tdj.js']){
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/ai-bridge|interpretar\w*IA|comprobarMotorIA|enviarFeedbackIA|dian-ai-status|usarIA|ai-liquidador/);
}
assert.equal(fs.existsSync('js/ai-bridge.js'),false);
assert.ok(fs.readFileSync('js/tdj.js','utf8').includes(`tdj-core-16.33.143.js?v=${version}`));
for(const [file,module] of [['liquidacion.html','app'],['titulos.html','tdj']]){
  const html=fs.readFileSync(file,'utf8');
  assert.ok(html.includes(`js/${module}.js?v=${version}`));
  assert.ok(html.includes(`estilos.css?v=${version}`));
}
console.log('SIN IA OK: módulos desconectados y versiones sincronizadas');
