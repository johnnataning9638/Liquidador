import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/pdf-dian-251');
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
 for(const type of ['PRIVADA','OFICIAL']){
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await choose(page.locator('.btn-importar-excel:visible').first(),fixture);
 await page.locator('#tipoLiquidacion').selectOption(type);
 await page.locator('[data-tab="pagos"]').click();
 await page.locator('[data-k="recibo"]').fill('');
 await page.locator('[data-k="valor"]').fill('0');
 await page.locator('[data-k="valor"]').press('Tab');
 await page.locator('.fecha-pago').fill('26/10/2026');
 await page.locator('.fecha-pago').press('Tab');
 await page.locator('.btn-calcular-normal:visible').first().click();
 await page.locator('[data-tab="resultados"]').click();
 const total=numeric(await page.locator('#rSaldoTotalFooter').textContent());
 assert.ok(total>0);
 await page.evaluate(()=>{window.__pdf251='';window.open=()=>({document:{readyState:'complete',open(){},write(s){window.__pdf251=s;},close(){}},focus(){},print(){}});});
 await page.locator('#btnExportarPdf').click();
 await page.waitForFunction(()=>window.__pdf251.length>0);
 const html=await page.evaluate(()=>window.__pdf251);
 const preview=await ctx.newPage();await preview.setContent(html);
 assert.ok((await preview.locator('body').textContent()).includes('SIN PAGOS'));
 const pdfTotal=numeric(await preview.locator('.pdf-tabla .total td').last().textContent());
 assert.equal(pdfTotal,total,'PDF coincide con UI');
 await preview.pdf({path:path.join(output,'sin-pagos-'+type+'.pdf'),format:'A4',printBackground:true});
 await preview.screenshot({path:path.join(output,'sin-pagos-'+type+'.png'),fullPage:true});
 await preview.close();
 const excel=await captureExcel(page.locator('#btnExportarExcel'),'sin-pagos-'+type);
 assert.ok(excel.rows.some(r=>r[0]==='SALDO TOTAL'&&Number(r[1])===total),'Excel coincide con PDF y UI');
 assert.deepEqual(errors,[]);assert.ok(!alerts.some(a=>a.includes('not defined')));
 console.log('PDF DIAN SIN PAGOS '+type+' OK: UI/PDF/Excel total '+total);
 }
}finally{await browser.close();}
