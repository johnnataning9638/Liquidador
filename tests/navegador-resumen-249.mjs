import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/resumen-249');
const baseline=process.env.EXPECT_MISSING==='1';
const fixtures=process.env.FIXTURE_DIR||path.join(root,'tests/fixtures/resumen-sin-titulos-249');
const names=(await fs.readdir(fixtures)).filter(n=>n.endsWith('.xlsx')).sort();
assert.equal(names.length,4);
const cases=names.map(name=>({name,mode:'original',fixture:path.join(fixtures,name)}));
if(!baseline)for(const mode of ['parcial','sin-pagos','con-titulo','simple'])cases.push({name:mode,mode,fixture:mode==='simple'?path.join(root,'tests/fixtures/sancion-proporcional-248.xlsx'):path.join(fixtures,names[0])});
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const results=[];
try{
 for(const {name,mode,fixture:sourceFixture} of cases){
  let fixture=sourceFixture;
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  await ctx.addInitScript(()=>{window.print=()=>{};});
  await ctx.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1')return route.abort();
   const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
   if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
   if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
   try{return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  const page=await ctx.newPage(),errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('PDF cierre'))warnings.push(m.text());});
  page.on('dialog',d=>d.accept());
  if(mode==='simple'){
   // El fixture histórico usa el formato de entrada DIAN; TDJ recibe su
   // respaldo normal exportado, igual que en el flujo de regresión 248.
   await page.goto('http://127.0.0.1:23400/liquidacion.html',{waitUntil:'networkidle'});
   const ready=page.waitForEvent('dialog');
   const [picker]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.btn-importar-excel:visible').first().click()]);
   await picker.setFiles(fixture);await ready;
   await page.locator('.btn-calcular-normal:visible').first().click();
   await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__xlsx249=blob;return original.call(URL,blob);};});
   await page.locator('#btnExportarExcel').click();
   await page.waitForFunction(()=>Boolean(window.__xlsx249));
   const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__xlsx249.arrayBuffer())));
   fixture=path.resolve(output,'simple-import.xlsx');await fs.writeFile(fixture,new Uint8Array(bytes));
  }
  await page.goto('http://127.0.0.1:23400/titulos.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.obligacion-card');
  const imported=page.waitForEvent('dialog');
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.tdj-import-excel:visible').first().click()]);
  await chooser.setFiles(fixture);await imported;
  if(['parcial','sin-pagos'].includes(mode))await page.locator('[data-tab="pagos"]').click();
  if(mode==='parcial')await page.locator('[data-p="valor"]').first().evaluate(el=>{el.value='1000000';el.dispatchEvent(new Event('change',{bubbles:true}));});
  if(mode==='sin-pagos')await page.locator('[data-pdel]').first().evaluate(el=>el.click());
  await page.locator('[data-tab="titulos"]').click();
  if(mode==='con-titulo'){
   await page.locator('#importarTitulosTexto').fill('TDJ\tFecha\tValor\nPRUEBA-249\t21/10/2026\t1.000.000');
   await page.locator('#btnProcesarImportTitulos').click();
  }
  await page.locator('.btn-calcular-tdj:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('#resSaldo')?.textContent?.includes('$'));
  const ui=await page.locator('#resSaldo').textContent();
  const uiSanction=await page.locator('#resSaldoSancion').textContent();
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('.tdj-pdf:visible').first().click()]);
  await popup.waitForSelector('main.pdf-soporte');
  if(!baseline)await popup.waitForSelector('#tdj-pdf-cierre-189-style',{state:'attached'});
  const data=await popup.evaluate(()=>{
   const n=v=>Number(String(v||'').replace(/[^0-9-]/g,''));
   const summaries=[...document.querySelectorAll('.pdf-hoja')].filter(s=>s.querySelector('.pdf-titulo')?.textContent==='RESUMEN FINAL DE LA LIQUIDACIÓN');
   const summary=summaries[0];
   const grid=Object.fromEntries([...(summary?.querySelectorAll('.pdf-resumen-grid > div')||[])].map(x=>[x.querySelector('b').textContent,n(x.querySelector('strong').textContent)]));
   const detail=[...document.querySelectorAll('.pdf-tabla tbody tr')].filter(r=>r.children[0]?.textContent.trim()==='TOTALES');
   const sanctions=[...document.querySelectorAll('.pdf-tabla tbody tr')].filter(r=>r.children[0]?.textContent.trim()==='SANCIÓN');
   return {count:summaries.length,grid,detailBalance:n(detail.at(-1)?.children[3]?.textContent),detailSanction:n(sanctions.at(-1)?.children[3]?.textContent),titles:document.querySelector('main').textContent.includes('RESUMEN FINAL — TÍTULOS Y ENDOSO'),paymentSummary:document.querySelector('main').textContent.includes('CONSOLIDACIÓN FINAL DE EXCEDENTES DE PAGOS')};
  });
  const label=name.replace('.xlsx','');
  await fs.writeFile(path.join(output,label+'.html'),await popup.content());
  await popup.pdf({path:path.join(output,label+'.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  results.push({file:name,ui,uiSanction,...data,errors,warnings});
  await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify(results,null,2));
  assert.deepEqual(errors,[]);
  assert.equal(data.count,baseline?0:1,name+': un resumen final');
  assert.equal(data.titles,mode==='con-titulo','Títulos solo si existen');
  if(baseline)assert.ok(warnings.some(w=>w.includes('no fue posible reorganizar')),'Reproducir causa');
  else{
   assert.deepEqual(warnings,[]);
   assert.equal(data.paymentSummary,true);
   assert.equal(data.grid['SALDO TOTAL FINAL'],Number(ui.replace(/[^0-9-]/g,'')));
   assert.equal(data.grid['SANCIÓN FINAL'],Number(uiSanction.replace(/[^0-9-]/g,'')));
   if(mode==='original'){
    assert.equal(data.grid['SALDO TOTAL FINAL'],data.detailBalance);
    assert.equal(data.grid['SANCIÓN FINAL'],data.detailSanction);
   }
   await popup.locator('.pdf-hoja-final-resumen').first().screenshot({path:path.join(output,label+'.png')});
  }
  console.log((baseline?'REPRODUCIDO ':'OK ')+name);
  await ctx.close();
 }
}finally{await browser.close();}
