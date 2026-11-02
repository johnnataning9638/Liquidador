import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {inflateRawSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {revertirImportacion273} from './revertir-importacion-273.mjs';
const base='49004d29ed19de99bc4832d55c34c5556725b585',read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
const patches=JSON.parse(read('tests/fixtures/cambios-importacion-273.json'));
for(const file of Object.keys(patches))assert.equal(revertirImportacion273(read(file),file),execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': adiciones delimitadas y reversibles');
const manifest=JSON.parse(read('runtime-manifest.json'));
for(const file of Object.keys(manifest.protected)){
 if(['js/app.js','js/tdj-core-16.33.143.js'].includes(file))continue;
 assert.equal(read(file),execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),file+': motores y reglas intactos');
}
const ext=JSON.parse(read('extension-dian/manifest.json'));assert.deepEqual(ext.permissions,['scripting']);assert.equal(ext.host_permissions.length,1);assert.ok(!ext.externally_connectable);
for(const f of ['worker.js','puente.js'])assert.doesNotMatch(read('extension-dian/'+f),/fetch\(|XMLHttpRequest|localStorage|chrome\.(cookies|storage|downloads)/,'complemento sin red ni persistencia');
const provenance=JSON.parse(read('vendor/pdfjs/procedencia.json'));
for(const [file,sha] of Object.entries(provenance.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('vendor/pdfjs/'+file)).digest('hex'),sha);
const zip=fs.readFileSync('descargas/puente-dian-273.zip'),entries=new Map();let offset=0;
while(zip.readUInt32LE(offset)===0x04034b50){
 const method=zip.readUInt16LE(offset+8),size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nameLength).toString();
 const start=offset+30+nameLength+extra,data=zip.subarray(start,start+size);entries.set(name,method===8?inflateRawSync(data):data);offset=start+size;
}
assert.deepEqual([...entries.keys()].sort(),['LEAME.txt','manifest.json','muisca.js','puente.js','worker.js']);
for(const [name,data] of entries)assert.deepEqual(data,Buffer.from(read(name==='muisca.js'?'js/importacion-web-pdf/muisca.js':'extension-dian/'+name)),'ZIP coincide con fuente revisada');
let listener,consultas=0;
vm.runInNewContext(read('extension-dian/worker.js').replace(/^import .*\n/,''),{URL,capturarMuisca(){},chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}},tabs:{query(){consultas++;return Promise.resolve([]);}}}});
for(const sender of [{url:'https://otro.example/liquidacion.html',frameId:0},{url:'https://liquidador-de-obligaciones-tributarias.onrender.com/index.html',frameId:0},{url:'https://liquidador-de-obligaciones-tributarias.onrender.com/liquidacion.html',frameId:2}])assert.equal(listener({tipo:'LEER_MUISCA_273'},sender,()=>{}),undefined);
assert.equal(consultas,0,'remitentes y subframes ajenos no consultan DIAN');
console.log('ALCANCE 273 OK: motores y reglas intactos; adaptadores reversibles; permisos mínimos y PDF.js verificado');
