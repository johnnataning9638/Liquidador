import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('runtime-manifest.json','utf8'));
assert.equal(manifest.version,JSON.parse(fs.readFileSync('version.json','utf8')).version);
assert.match(html,/INSTRUCCIONES DEL LIQUIDADOR/);
const routes=[
 ['recursos/instructivo.html','recursos/instructivo-liquidador.pdf','pdf','%PDF'],
 ['recursos/video.html','recursos/tutorial-liquidacion-individual.mp4','mp4','ftyp'],
 ['recursos/video.html','recursos/tutorial-liquidacion-multiple.mp4','mp4','ftyp']
];
for(const [viewer,asset,type,signature] of routes){
 assert.ok(fs.existsSync(viewer),viewer+' no existe');
 assert.ok(fs.existsSync(asset),asset+' no existe');
 assert.ok(manifest.files.includes(viewer),viewer+' no registrado en manifest');
 assert.ok(manifest.files.includes(asset),asset+' no registrado en manifest');
 const size=fs.statSync(asset).size;
 assert.ok(size>100_000,asset+' parece incompleto');
 const f=fs.openSync(asset,'r'); const buf=Buffer.alloc(16); fs.readSync(f,buf,0,16,0); fs.closeSync(f);
 if(type==='pdf')assert.equal(buf.toString('ascii',0,4),signature);
 else assert.equal(buf.toString('ascii',4,8),signature);
}
assert.match(html,/href="recursos\/instructivo\.html"/);
assert.match(html,/href="recursos\/video\.html\?tipo=individual"/);
assert.match(html,/href="recursos\/video\.html\?tipo=multiple"/);
const player=fs.readFileSync('recursos/video.html','utf8');
assert.match(player,/tutorial-liquidacion-individual\.mp4/);
assert.match(player,/tutorial-liquidacion-multiple\.mp4/);
assert.match(fs.readFileSync('recursos/instructivo.html','utf8'),/instructivo-liquidador\.pdf/);
assert.ok(!html.includes('onclick="window.open('));
console.log('Recursos tutoriales 297: OK');
