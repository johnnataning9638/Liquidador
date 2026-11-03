import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from './browser-runtime.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),base='http://127.0.0.1:27500';
const output=process.env.ARTIFACT_DIR||path.join(root,'test-results/oficial-275');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],alerts=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1050}});
 await ctx.addInitScript(()=>{window.print=()=>{};});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  if(name==='datos/ipc.json')return route.fulfill({contentType:'application/json',body:JSON.stringify([2023,2024,2025].map(anio=>({anioInflacion:anio,inflacion:0.10})))});
  try{return route.fulfill({contentType:/\.js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const p=await ctx.newPage();p.setDefaultTimeout(15000);
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const set=async(sel,v)=>{await p.locator(sel).fill(v);await p.locator(sel).press('Tab');};
 const money=v=>Number(String(v).replace(/[^0-9-]/g,''));
 await p.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await set('#nit','900000001');await set('#razonSocial','PRUEBA FÓRMULA OFICIAL');await p.locator('#concepto').selectOption('RENTA');await set('#anio','2025');await p.locator('#periodo').selectOption('1');
 await p.locator('#tieneSancion').selectOption('SI');await p.locator('#tipoLiquidacion').selectOption('OFICIAL');await set('#valorSancion','1000000');await set('#fechaSancion','15/12/2025');
 await p.locator('[data-tab="pagos"]').click();if(!await p.locator('#tablaPagos tbody tr').count())await p.locator('#btnAgregarPago').click();
 await set('.fecha-pago','30/06/2026');await set('[data-k="valor"]','0');
 const resultados=[];
 for(const pagado of [false,true]){
  if(pagado){
   await p.locator('[data-pane="resultados"].active').waitFor({state:'visible'});await p.waitForTimeout(350);
   await p.locator('[data-tab="pagos"]').click();await p.locator('[data-pane="pagos"].active').waitFor({state:'visible'});await p.locator('#btnAgregarPago').click();const row=p.locator('#tablaPagos tbody tr').last();
   await row.locator('.fecha-pago').fill('02/01/2026');await row.locator('.fecha-pago').press('Tab');await row.locator('[data-k="valor"]').fill('10000');await row.locator('[data-k="valor"]').press('Tab');
  }
  await p.locator('.btn-calcular-normal:visible').first().click();await p.locator('[data-pane="resultados"].active').waitFor({state:'visible'});await p.locator('#rSaldoTotalFooter').waitFor({state:'visible'});
  const esperado=pagado?994000:1004000;
  assert.equal(money(await p.locator('#rSaldoTotalFooter').textContent()),esperado,'Pantalla usa fórmula y pagos exactos');
  const [pdf]=await Promise.all([p.waitForEvent('popup'),p.locator('#btnExportarPdf:visible').first().click()]);await pdf.locator('main').waitFor();
  const text=await pdf.locator('main').textContent();assert.ok(text.includes('SA = VS × (1 + IPC/365)^n'));assert.ok(text.includes('15/12/2025'));assert.ok(text.includes('31/12/2025'));
  const filas=await pdf.locator('tr').allTextContents();assert.ok(filas.some(x=>x.includes('15/12/2025')&&x.includes('31/12/2025')&&x.includes('16')),'PDF muestra período y 16 días');
  assert.ok((await pdf.locator('strong,td').allTextContents()).some(x=>money(x)===esperado));
  assert.ok(!text.includes('No se prorratea por días.'),'PDF oficial no conserva descripción anterior');
  await pdf.screenshot({path:path.join(output,`oficial-${pagado?'pago':'sin-pagos'}.png`),fullPage:true});
  await pdf.pdf({path:path.join(output,`oficial-${pagado?'pago':'sin-pagos'}.pdf`),format:'A4',printBackground:true});await pdf.close();
  await p.evaluate(()=>{window.__blob275=null;const old=URL.createObjectURL;URL.createObjectURL=b=>{window.__blob275=b;return old.call(URL,b);};});
  await p.locator('#btnExportarExcel:visible').first().click();await p.waitForFunction(()=>window.__blob275);
  const rows=await p.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('/js/importador-excel.js');return leerXlsxPrimeraHoja(window.__blob275);});
  assert.ok(rows.some(r=>r.includes('FÓRMULA OFICIAL')),'Excel muestra fórmula');
  assert.ok(rows.some(r=>r.includes('2025-12-15')&&r.includes('2025-12-31')&&r.some(v=>Number(v)===16)),'Excel muestra días reales');
  assert.ok(rows.some(r=>r.some(v=>Number(v)===esperado)),'Excel coincide con pantalla y PDF');
  const bytes=await p.evaluate(async()=>[...new Uint8Array(await window.__blob275.arrayBuffer())]);
  const file=path.join(output,`oficial-${pagado?'pago':'sin-pagos'}.xlsx`);await fs.writeFile(file,new Uint8Array(bytes));
  // Reimportación: conserva fecha de sanción, tipo oficial y resultado.
  const [chooser]=await Promise.all([p.waitForEvent('filechooser'),p.locator('.btn-importar-excel:visible').first().click()]);await chooser.setFiles(file);
  await p.waitForTimeout(400);assert.equal(await p.locator('#tipoLiquidacion').inputValue(),'OFICIAL');
  await p.locator('.btn-calcular-normal:visible').first().click();await p.locator('[data-pane="resultados"].active').waitFor({state:'visible'});assert.equal(money(await p.locator('#rSaldoTotalFooter').textContent()),esperado,'Reimportación conserva resultado');
  resultados.push({pagado,esperado});
 }
 assert.deepEqual(errors,[]);assert.ok(!alerts.some(x=>/error|no se pudo/i.test(x)),alerts.join('\n'));
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({resultados,errors,alerts},null,2));
 console.log('NAVEGADOR OFICIAL 275 OK: pantalla/PDF/XLSX/reimportación con y sin pagos; fórmula, 16 días y saldos iguales');
}finally{await browser.close();}
