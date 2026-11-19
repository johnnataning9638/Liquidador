import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('runtime-manifest.json','utf8'));
assert.equal(manifest.version,'16.33.297');
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
 const expected={
  'recursos/instructivo-liquidador.pdf':'dba520e8974c63f35ce5f000d8f9ecb02e520932b5ce4d3e3efe1e3208ace516',
  'recursos/tutorial-liquidacion-individual.mp4':'38210b59b629d5a281853ef8f470815a7586800962157b0470ce9be2b03a3fce',
  'recursos/tutorial-liquidacion-multiple.mp4':'45e4ac75dbf9f7b00a33cf5d59084c18af216d33b53f87158acd02a6e8e50313'
 };
 const digest=createHash('sha256').update(fs.readFileSync(asset)).digest('hex');
 assert.equal(digest,expected[asset],asset+' no coincide con la versión audiovisual corregida aprobada para subida');
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
