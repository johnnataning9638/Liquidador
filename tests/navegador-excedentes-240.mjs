import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(process.env.ARTIFACT_DIR||'test-results/excedentes-240');
const live=process.env.TEST_BASE_URL,base=live||'http://127.0.0.1:24000';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const errors=[],failures=[];
try{
 const ctx=await browser.newContext({viewport:{width:1400,height:950}});
 await ctx.route('**/*',async route=>{
  if(live)return route.continue();
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(path.resolve(root)+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const check=(label,fn)=>{try{fn();}catch(e){failures.push(label+': '+e.message);}};
 const obligation='NIT: 900123456\nRazón social: PRUEBA EXCEDENTES SAS\nAño: 2024\nFecha\tImpuesto\n19/05/2024\t11.000.000';
 const titles='TDJ\tFecha\tValor\n240000001\t16/05/2024\t19.573.163\n240000002\t18/05/2024\t14.794.449';
 const movements='TDJ\tRecibo\tFecha\tValor\n240000001\t\t16/05/2024\t19.573.163\n\t49124000001\t17/05/2024\t1.000.000\n240000002\t\t18/05/2024\t14.794.449';
 const capture=async(button,label)=>{
  await page.evaluate(()=>{window.__pdf240='';window.open=()=>({document:{readyState:'complete',open(){},write(h){window.__pdf240=h;},close(){}},focus(){},print(){}});});
  await button.click();await page.waitForFunction(()=>window.__pdf240.length>0);
  const html=await page.evaluate(()=>window.__pdf240);await fs.writeFile(path.join(output,label+'.html'),html);
  const preview=await ctx.newPage();await preview.setContent(html);await preview.pdf({path:path.join(output,label+'.pdf'),format:'A4',printBackground:true});
  return preview;
 };
 await page.goto(base+'/liquidacion.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#concepto')?.options.length>1);
 await page.locator('#pegarDatosObligacion').fill(obligation);await page.locator('#btnProcesarDatosObligacion').click();
 await page.locator('#concepto').selectOption('RENTA');await page.locator('#periodo').selectOption('1');await page.locator('#tieneSancion').selectOption('NO');
 await page.locator('[data-tab="pagos"]').click();await page.locator('#pegarDatos').fill(movements);await page.locator('#btnProcesarPegado').click();
 await page.locator('.btn-calcular-normal:visible').first().click();await page.locator('[data-tab="resultados"]').click();
 const total=Number((await page.locator('#rExcedente').textContent()).replace(/[^0-9-]/g,''));
 check('Excedente DIAN',()=>assert.equal(total,24367612));
 await page.locator('#rExcedenteBox').screenshot({path:path.join(output,'dian-total.png')});
 const pdf=await capture(page.locator('#btnExportarPdf'),'dian');
 const summary=await pdf.locator('.pdf-resumen-grid').first().textContent();check('Resumen PDF DIAN',()=>assert.ok(summary.includes('24.367.612')));
 await pdf.close();
 await page.evaluate(()=>{window.__excel240=null;const create=URL.createObjectURL;URL.createObjectURL=b=>{window.__excel240=b;return create.call(URL,b);};});
 await page.locator('#btnExportarExcel').click();await page.waitForFunction(()=>Boolean(window.__excel240));
 const rows=await page.evaluate(async()=>{const {leerXlsxPrimeraHoja}=await import('./js/importador-excel.js');return leerXlsxPrimeraHoja(window.__excel240);});
 const saldoRow=rows.find(r=>r[0]==='SALDO TOTAL');check('Excel excedente DIAN',()=>assert.equal(Number(saldoRow?.[3]),24367612));
 const totalRow=rows.find(r=>String(r[0]).includes('EXCEDENTE TOTAL — SUMATORIA'));check('Excel total consolidado DIAN',()=>assert.equal(Number(totalRow?.[2]),24367612));
 await page.goto(base+'/titulos.html',{waitUntil:'networkidle'});await page.waitForSelector('.obligacion-card');
 await page.locator('#destinoImportacionObligacion').selectOption({index:1});await page.locator('#importarObligacionTexto').fill(obligation);await page.locator('#btnImportarObligacionTDJ').click();
 await page.locator('.obligacion-card [data-k="concepto"]').selectOption('RENTA');await page.locator('.obligacion-card [data-k="periodo"]').selectOption('1');
 await page.locator('[data-tab="pagos"]').click();await page.locator('#destinoImportacionPagos').selectOption({index:1});await page.locator('#importarPagosTexto').fill('Recibo\tFecha\tValor\n49124000001\t17/05/2024\t1.000.000');await page.locator('#btnImportarPagosTDJ').click();
 await page.locator('[data-tab="titulos"]').click();await page.locator('#importarTitulosTexto').fill(titles);await page.locator('#btnProcesarImportTitulos').click();
 await page.locator('.btn-calcular-tdj:visible').first().click();
 const endoso=Number((await page.locator('#resEndoso').textContent()).replace(/[^0-9-]/g,''));check('Endoso TDJ',()=>assert.equal(endoso,24367612));
 const tdj=await capture(page.locator('.tdj-pdf:visible').first(),'tdj');
 const details=tdj.locator('section.pdf-hoja').filter({has:tdj.locator('.pdf-pago-titulo')});
 const last=details.filter({hasText:'240000002'});const count=await last.count();check('Detalle título sin aplicación',()=>assert.equal(count,1));
 if(count){const debt=await last.locator('.pdf-tabla tbody').textContent();check('Deuda/aplicación/saldo cero',()=>assert.ok(!/[1-9]/.test(debt)));const text=await last.textContent();check('Excedente íntegro',()=>assert.ok(text.includes('14.794.449')));await last.screenshot({path:path.join(output,'tdj-ultimo-detalle.png')});}
 await tdj.close();check('Sin errores JS',()=>assert.deepEqual(errors,[]));
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({total,endoso,detalleSinAplicacion:count,errors,failures},null,2));
 assert.deepEqual(failures,[]);console.log('EXCEDENTES 240 OK: DIAN total/UI/PDF y TDJ detalle sin aplicación, sin cambios de endoso');
}finally{await browser.close();}
