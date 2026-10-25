import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/tasa-247');
const live=process.env.TEST_BASE_URL;
const base=live||'http://127.0.0.1:23400';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const errors=[],alerts=[];
try{
 const ctx=await browser.newContext({viewport:{width:1400,height:1000}});
 ctx.setDefaultTimeout(12000);ctx.setDefaultNavigationTimeout(15000);
 await ctx.route('**/*',async route=>{
  if(live)return route.continue();
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});

 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});
 await page.waitForSelector('.obligacion-card');
 await page.locator('[data-tab="titulos"]').click();
 await page.locator('#importarTitulosTexto').fill('TDJ\tFecha\tValor\n4911098513361\t30/03/2026\t3.047.000\n4911098761609\t31/03/2026\t10.924.000\n4911099029075\t04/04/2026\t2.294.000');
 await page.locator('#btnProcesarImportTitulos').click();
 await page.waitForFunction(()=>document.querySelectorAll('#tablaTitulos .tdj-tasa-visual').length===3);
 const cases=[['TASA DIAN',['23.520','23.520','24.760']],['ART. 91 LEY 2277',['11.760','11.760','12.380']],['ART. 45 LEY 2155',['3.400','3.400','3.570']]];
 const results=[];
 for(const [tipo,expected] of cases){
  for(let i=0;i<3;i++){
   const row=page.locator('#tablaTitulos tbody tr').nth(i);
   await row.locator('select.tdj-beneficio-select').selectOption(tipo);
   await page.waitForFunction(({i,rate})=>document.querySelectorAll('#tablaTitulos .tdj-tasa-visual')[i]?.textContent==='TASA: '+rate+'%',{i,rate:expected[i]});
  }
  results.push({tipo,rates:await page.locator('#tablaTitulos .tdj-tasa-visual').allTextContents()});
 }
 for(let i=0;i<3;i++)await page.locator('#tablaTitulos tbody tr').nth(i).locator('select.tdj-beneficio-select').selectOption('TASA DIAN');
 await page.locator('#tablaTitulos').screenshot({path:path.join(output,'tasas-tres-titulos.png')});
 // El problema sigue a la fecha y no al número de fila: intercambiar 30/31.
 for(const [i,date] of [[0,'31/03/2026'],[1,'30/03/2026']]){
  const input=page.locator('#tablaTitulos tbody tr').nth(i).locator('.fecha-campo');
  await input.fill(date);await input.blur();await input.dispatchEvent('change');
 }
 await page.waitForFunction(()=>[...document.querySelectorAll('#tablaTitulos .tdj-tasa-visual')].slice(0,2).every(e=>e.textContent==='TASA: 23.520%'));
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({version:JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8')).version,modo:live?'produccion':'local',results,errors},null,2));
 console.log('NAVEGADOR TASA 247 OK: tres TDJ, marzo/abril, DIAN y derivadas, fecha intercambiada y cero errores JS');
}finally{await browser.close();}
