import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/sanciones-minimas-261');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26100';
const {valores}=JSON.parse(await fs.readFile(new URL('./fixtures/sanciones-minimas-dian-261.json',import.meta.url),'utf8'));
const {version}=JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8'));
await fs.mkdir(output,{recursive:true});
const b=await chromium.launch({headless:true});
const errors=[],dialogs=[],results=[];
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
 const set=async(selector,value)=>{await p.locator(selector).fill(value);await p.locator(selector).press('Tab');};
 for(const tdj of [false,true]){
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html')+'?v='+version,{waitUntil:'networkidle'});
  await p.waitForSelector(tdj?'.obligacion-card':'#anio');
  const loaded=await p.evaluate(async()=>{const r=await fetch('datos/uvt.json',{cache:'no-store'});if(!r.ok)throw Error('UVT HTTP '+r.status);return (await r.json()).map(x=>[x.anio,x.sancionMinima]);});
  assert.deepEqual(loaded,valores,'Datos reales cargados por '+(tdj?'TDJ':'DIAN'));
  if(tdj){
   await p.locator('[data-k="tieneSancion"]').selectOption('SI');await set('[data-k="valorSancion"]','1000000');await p.locator('[data-k="beneficioSancion"]').selectOption('CON BENEFICIO');
   await p.locator('[data-tab="pagos"]').click();if(!await p.locator('.pagos-mini tbody tr').count())await p.locator('[data-action="agregar-pago"]').click();
   await set('.pagos-mini .fecha-campo','15/03/2026');await p.locator('[data-p="tipo"]').selectOption('ART. 3 DECRETO 0240 DE 2026');
   await p.locator('[data-tab="datos"]').click();
  }else{
   await p.locator('#tieneSancion').selectOption('SI');await p.locator('#beneficioSancion').selectOption('CON BENEFICIO');
  }
  for(const [year,expected]of valores){
   if(tdj){await set('.obligacion-card .compact-grid .fecha-campo',`01/01/${year}`);await set('[data-k="anio"]',String(year));}
   else await set('#anio',String(year));
   const actual=money(await p.locator(tdj?'[data-k="valorSancionBeneficio"]':'#sancionMinima').inputValue());
   assert.equal(actual,expected,`${tdj?'TDJ beneficio':'DIAN mínima'} ${year}`);
   results.push({module:tdj?'TDJ':'DIAN',year,value:actual});
  }
  await p.screenshot({path:path.join(output,tdj?'tdj-2026.png':'dian-2026.png'),fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores JavaScript');assert.deepEqual(dialogs,[],'Sin alertas inesperadas');
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({version,base,results,errors,dialogs},null,2));
 console.log(JSON.stringify({estado:'OK',version,controlesUI:results.length,errors}));
}finally{await b.close();}
