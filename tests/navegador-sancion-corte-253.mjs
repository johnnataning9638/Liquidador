import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/sancion-corte-253');
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
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());console.log('DIALOG',d.message());await d.accept();});


 const fixture=path.resolve(fileURLToPath(new URL('./fixtures/sancion-proporcional-248.xlsx',import.meta.url)));
 const numeric=v=>Number(String(v||'').replace(/[^0-9-]/g,''));
 const choose=async(button,file)=>{const done=page.waitForEvent('dialog');const [c]=await Promise.all([page.waitForEvent('filechooser'),button.click()]);await c.setFiles(file);await done;await page.waitForTimeout(200);};
 const set=async(selector,value)=>{const el=page.locator(selector);await el.fill(value);await el.press('Tab');};
 const excel=async(button,label)=>{
  await page.evaluate(()=>{window.__blob253=null;const old=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob253=b;return old.call(URL,b);};});
  await button.click();await page.waitForFunction(()=>window.__blob253);
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__blob253.arrayBuffer())));
  const file=path.join(output,label+'.xlsx');await fs.writeFile(file,new Uint8Array(bytes));return file;
 };
 const pdf=async(button,label,expected)=>{
  const [p]=await Promise.all([page.waitForEvent('popup'),button.click()]);await p.waitForSelector('main');
  const text=await p.locator('main').textContent();assert.ok(text.includes('21/01/2026'),'PDF conserva fecha de corte');
  const numbers=await p.locator('td,th,strong').allTextContents();assert.ok(numbers.some(x=>numeric(x)===expected),'PDF contiene saldo final esperado');
  const projected=p.locator('.pdf-proyeccion-corte tfoot');
  if(await projected.count())assert.equal(numeric(await projected.first().textContent()),expected,'La proyección usa el saldo posterior a todos los pagos y TDJ');
  await p.pdf({path:path.join(output,label+'.pdf'),format:'A4',printBackground:true});await p.close();
 };
 await ctx.addInitScript(()=>{window.print=()=>{};});
 const results=[];
 for(const capital of [0,1000000]){
  await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
  await choose(page.locator('.btn-importar-excel:visible').first(),fixture);
  while(await page.locator('[data-clear]').count()>1)await page.locator('[data-clear]').last().click();
  await page.locator('#concepto').selectOption('VENTAS');
  await set('.fecha-vto','01/01/2026');await set('[data-v="impuesto"]',capital?'1000000':'');
  await set('#valorSancion','1000000');await set('#fechaSancion','01/01/2026');
  await page.locator('[data-tab="pagos"]').click();
  await set('[data-k="recibo"]','');await set('.fecha-pago','21/01/2026');await set('[data-k="valor"]','');
  await page.locator('.btn-calcular-normal:visible').first().click();
  const sinPagos=numeric(await page.locator('#rSaldoTotalFooter').textContent());
  if(!capital)assert.equal(sinPagos,1000000,'Solo sanción sin pagos, cero intereses');
  const sinPagosFile=await excel(page.locator('#btnExportarExcel'),'sin-pagos-'+capital);
  await pdf(page.locator('#btnExportarPdf'),'sin-pagos-dian-'+capital,sinPagos);
  await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');await choose(page.locator('.tdj-import-excel:visible').first(),sinPagosFile);await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();
  assert.equal(numeric(await page.locator('#tablaResultadoObligaciones tbody tr td').last().textContent()),sinPagos,'TDJ sin pagos coincide con DIAN');
  await pdf(page.locator('.tdj-pdf:visible').first(),'sin-pagos-tdj-'+capital,sinPagos);
  await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});await choose(page.locator('.btn-importar-excel:visible').first(),sinPagosFile);await page.locator('[data-tab="pagos"]').click();
  await set('[data-k="recibo"]','P1');await set('.fecha-pago','02/01/2026');await set('[data-k="valor"]','10000');
  await page.locator('#btnAgregarPago').click();
  const rows=page.locator('#tablaPagos tbody tr');
  await rows.nth(1).locator('[data-k="recibo"]').fill('P2');await rows.nth(1).locator('.fecha-pago').fill('11/01/2026');await rows.nth(1).locator('.fecha-pago').press('Tab');await rows.nth(1).locator('[data-k="valor"]').fill('10000');await rows.nth(1).locator('[data-k="valor"]').press('Tab');
  await page.locator('#btnAgregarPago').click();
  await rows.nth(2).locator('.fecha-pago').fill('21/01/2026');await rows.nth(2).locator('.fecha-pago').press('Tab');await rows.nth(2).locator('[data-k="valor"]').fill('0');await rows.nth(2).locator('[data-k="valor"]').press('Tab');
  await page.locator('.btn-calcular-normal:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('#rSaldoTotalFooter')?.textContent.trim().length>1);
  const expected=numeric(await page.locator('#rSaldoTotalFooter').textContent());
  assert.ok(expected>0);if(!capital){assert.equal(expected,980000);assert.equal(numeric(await page.locator('#rSaldoIntereses').textContent()),0);}
  await page.locator('[data-tab="resultados"]').click();
  await pdf(page.locator('#btnExportarPdf'),'dian-'+capital,expected);
  const source=await excel(page.locator('#btnExportarExcel'),'dian-'+capital);
  await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});await choose(page.locator('.btn-importar-excel:visible').first(),source);await page.locator('.btn-calcular-normal:visible').first().click();
  assert.equal(numeric(await page.locator('#rSaldoTotalFooter').textContent()),expected,'DIAN reimporta capital cero y corte');
  for(const corteEnTitulo of [false,true]){
   await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');await choose(page.locator('.tdj-import-excel:visible').first(),source);
   await page.locator('[data-tab="pagos"]').click();
   await page.locator('.pagos-mini tbody tr').nth(1).locator('[data-pdel]').click();
   if(corteEnTitulo)await page.locator('.pagos-mini tbody tr').last().locator('[data-pdel]').click();
   await page.locator('[data-tab="titulos"]').click();
   if(!await page.locator('#tablaTitulos tbody tr').count())await page.locator('#btnAgregarTitulo').click();
   let t=page.locator('#tablaTitulos tbody tr').first();
   await t.locator('[data-t="tdj"]').fill('253000001');await t.locator('[data-t="valor"]').fill('10000');await t.locator('[data-t="valor"]').press('Tab');await t.locator('.fecha-campo').fill('11/01/2026');await t.locator('.fecha-campo').press('Tab');
   if(corteEnTitulo){await page.locator('#btnAgregarTitulo').click();t=page.locator('#tablaTitulos tbody tr').last();await t.locator('.fecha-campo').fill('21/01/2026');await t.locator('.fecha-campo').press('Tab');await t.locator('[data-t="valor"]').fill('');await t.locator('[data-t="valor"]').press('Tab');}
   await page.locator('.btn-calcular-tdj:visible').first().click();
   await page.waitForFunction(()=>document.querySelector('#tablaResultadoObligaciones tbody tr'));
   const actual=numeric(await page.locator('#tablaResultadoObligaciones tbody tr td').last().textContent());
   assert.equal(actual,expected,'TDJ combina pagos y títulos hasta corte en cualquiera de las pestañas');
   if(!capital){assert.equal(numeric(await page.locator('#resSaldoImpuesto').textContent()),0);assert.equal(numeric(await page.locator('#resSaldoSancion').textContent()),actual);}
   await pdf(page.locator('.tdj-pdf:visible').first(),`tdj-${capital}-${corteEnTitulo}`,expected);
   const exported=await excel(page.locator('.tdj-excel:visible').first(),`tdj-${capital}-${corteEnTitulo}`);
   await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');await choose(page.locator('.tdj-import-excel:visible').first(),exported);await page.locator('[data-tab="titulos"]').click();await page.locator('.btn-calcular-tdj:visible').first().click();
   assert.equal(numeric(await page.locator('#tablaResultadoObligaciones tbody tr td').last().textContent()),expected,'TDJ reimporta toda la cronología');
   results.push({capital,corteEnTitulo,saldo:actual});
  }
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({results,errors,alerts},null,2));console.log(JSON.stringify({estado:'OK',results,errors}));
}finally{await browser.close();}
