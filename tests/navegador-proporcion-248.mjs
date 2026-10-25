import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/proporcion-248');
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

 const fixture=path.resolve(fileURLToPath(new URL('./fixtures/sancion-proporcional-248.xlsx',import.meta.url)));
 const numeric=v=>Number(String(v||'').replace(/[^0-9-]/g,''));
 const choose=async(button,file)=>{
  const ready=page.waitForEvent('dialog');const [chooser]=await Promise.all([page.waitForEvent('filechooser'),button.click()]);
  await chooser.setFiles(file);await ready;await page.waitForTimeout(100);
 };
 const captureExcel=async(button,label)=>{
  await page.evaluate(()=>{window.__xlsx248=null;const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__xlsx248=blob;return original.call(URL,blob);};});
  await button.click();await page.waitForFunction(()=>Boolean(window.__xlsx248));
  const rows=await page.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return leerXlsxPrimeraHoja(window.__xlsx248);});
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx248.arrayBuffer())));
  const file=path.join(output,label+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));return {file,rows};
 };
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),fixture);
 assert.equal(await page.locator('#tablaVencimientos tbody tr').count(),4);
 assert.equal(await page.locator('#tablaPagos tbody tr').count(),1);
 await page.locator('.btn-calcular-normal:visible').first().click();
 await page.waitForFunction(()=>document.querySelector('#rSaldoTotalFooter')?.textContent.includes('420.000'));
 const values={rPropImpuesto:9000,rPropIntereses:0,rPropSancion:1000,rSaldoImpuesto:391000,rSaldoIntereses:0,rSaldoSancion:29000,rSaldoTotalFooter:420000};
 for(const [id,value] of Object.entries(values))assert.equal(numeric(await page.locator('#'+id).textContent()),value,'DIAN '+id);
 await page.locator('[data-tab="resultados"]').click();
 await page.screenshot({path:path.join(output,'dian-corregido.png'),fullPage:true});
 await page.evaluate(()=>{window.__pdf248='';window.open=()=>({document:{readyState:'complete',open(){},write(s){window.__pdf248=s;},close(){}},focus(){},print(){}});});
 await page.locator('#btnExportarPdf').click();await page.waitForFunction(()=>window.__pdf248.length>0);
 const html=await page.evaluate(()=>window.__pdf248);await fs.writeFile(path.join(output,'dian.html'),html);
 const preview=await ctx.newPage();await preview.setContent(html);
 const pdfRows=await preview.locator('.pdf-pago .pdf-tabla tbody tr').evaluateAll(rows=>rows.map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.trim())));
 assert.deepEqual(pdfRows.map(r=>r.slice(1).map(v=>Number(v.replace(/[^0-9-]/g,'')))),[[400000,9000,391000],[0,0,0],[30000,1000,29000],[430000,10000,420000]]);
 await preview.pdf({path:path.join(output,'DIAN_corregido.pdf'),format:'A4',printBackground:true});await preview.close();
 const excel=await captureExcel(page.locator('#btnExportarExcel'),'DIAN_corregido');
 assert.ok(excel.rows.some(r=>r[0]==='SALDO TOTAL'&&Number(r[1])===420000),'Excel refleja saldo real');
 const header=excel.rows.findIndex(r=>r.includes('IMPUESTO APLICADO')&&r.includes('SANCIÓN APLICADA'));
 assert.ok(header>=0,'Tabla de aplicación Excel');
 const h=excel.rows[header],row=excel.rows[header+1];
 assert.equal(Number(row[h.indexOf('IMPUESTO APLICADO')]),9000);assert.equal(Number(row[h.indexOf('SANCIÓN APLICADA')]),1000);
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),excel.file);
 await page.locator('.btn-calcular-normal:visible').first().click();
 await page.waitForFunction(()=>document.querySelector('#rSaldoTotalFooter')?.textContent.includes('420.000'));
 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');
 await choose(page.locator('.tdj-import-excel:visible').first(),excel.file);
 await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();
 await page.waitForFunction(()=>document.querySelector('#resSaldo')?.textContent.includes('420.000'));
 assert.equal(numeric(await page.locator('#resSaldoImpuesto').textContent()),391000);
 assert.equal(numeric(await page.locator('#resSaldoSancion').textContent()),29000);
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({version:JSON.parse(await fs.readFile(path.join(root,'version.json'),'utf8')).version,mode:live?'produccion':'local',values,pdfRows,roundTrip:'DIAN XLSX → DIAN/TDJ aprobado',errors,alerts},null,2));
 console.log('NAVEGADOR 248 OK: Excel del usuario, proporción/saldos, PDF/XLSX y reimportación DIAN/TDJ');
}finally{await browser.close();}
