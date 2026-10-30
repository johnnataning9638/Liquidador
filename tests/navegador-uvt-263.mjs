import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/sanciones-minimas-261');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26100';
const {valores:historico}=JSON.parse(await fs.readFile(new URL('./fixtures/uvt-historico-263.json',import.meta.url),'utf8'));
const valores=historico.map(x=>[x.anio,x.sancionMinima]);
const {version}=JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8'));
await fs.mkdir(output,{recursive:true});
const b=await chromium.launch({headless:true});
const errors=[],dialogs=[],results=[],remoteReads=[];
const money=x=>Number(String(x||'').replace(/[^0-9-]/g,''));
try{
 const ctx=await b.newContext({viewport:{width:1400,height:1000}});
 ctx.setDefaultTimeout(15000);
 if(!process.env.TEST_BASE_URL)await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(url.pathname).slice(1),target=path.resolve(root,name);
  if(!target.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html',body:await fs.readFile(target)});}catch{return route.fulfill({status:404,body:''});}
 });
 await ctx.addInitScript(()=>{window.print=()=>{};});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
 p.on('response',r=>{if(r.url().includes('/rest/v1/uvt_liquidador?'))remoteReads.push({status:r.status()});});
 const set=async(selector,value)=>{await p.locator(selector).fill(value);await p.locator(selector).press('Tab');};
 for(const tdj of [false,true]){
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html')+'?v='+version,{waitUntil:'networkidle'});
  await p.waitForSelector(tdj?'.obligacion-card':'#anio');
  assert.ok((await p.locator('footer').textContent()).includes(version),'Pie de página identifica la versión publicada');
  assert.equal(new URL(p.url()).searchParams.get('v'),version,'Guardia conserva la versión publicada');
  const loaded=await p.evaluate(async()=>{const r=await fetch('datos/uvt.json',{cache:'no-store'});if(!r.ok)throw Error('UVT HTTP '+r.status);return (await r.json()).map(x=>[x.anio,x.sancionMinima]);});
  assert.deepEqual(loaded,valores,'Datos reales cargados por '+(tdj?'TDJ':'DIAN'));
  const minimas=await p.evaluate(async()=>{const {MotorLiquidacion}=await import('./js/motor-liquidacion.js');const {cargarUVTConRespaldo}=await import('./js/uvt-parametros.js');const uvt=await cargarUVTConRespaldo();const motor=new MotorLiquidacion({uvt});return Object.fromEntries(uvt.map(x=>[x.anio,motor.sancionMinima(x.anio)]));});
  for(const [year,expected]of valores){
   const actual=minimas[year];
   assert.equal(actual,expected,`${tdj?'TDJ':'DIAN'} mínima interna ${year}`);
   results.push({module:tdj?'TDJ':'DIAN',year,value:actual});
  }
  await p.screenshot({path:path.join(output,tdj?'tdj-2026.png':'dian-2026.png'),fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores JavaScript');assert.deepEqual(dialogs,[],'Sin alertas inesperadas');
 if(process.env.TEST_BASE_URL){assert.ok(remoteReads.length>=2,'DIAN y TDJ consultaron Supabase');assert.ok(remoteReads.every(x=>x.status===200),'Lectura central autorizada');}
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({version,base,results,errors,dialogs,remoteReads},null,2));
 console.log(JSON.stringify({estado:'OK',version,controlesMotor:results.length,errors}));
}finally{await b.close();}
