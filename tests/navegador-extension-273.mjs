import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url))),root=path.resolve(process.env.TEST_SITE_DIR||project);
const output=path.join(project,'test-results/importacion-273'),extension=path.join(output,'extension');
await fs.mkdir(extension,{recursive:true});
for(const file of ['manifest.json','worker.js','puente.js'])await fs.copyFile(path.join(project,'extension-dian',file),path.join(extension,file));
await fs.copyFile(path.join(project,'js/importacion-web-pdf/muisca.js'),path.join(extension,'muisca.js'));
const perfil=await fs.mkdtemp(path.join(output,'perfil-extension-'));
const ctx=await chromium.launchPersistentContext(perfil,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:1000}});
const origin='https://liquidador-de-obligaciones-tributarias.onrender.com',dian='https://muisca.dian.gov.co/WebRecaudacion/DefConsultaObligacion.faces',results=[],errors=[];
try{
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin==='https://muisca.dian.gov.co')return route.fulfill({contentType:'text/html',body:await fs.readFile(path.join(project,'tests/fixtures/muisca-273.html'))});
  if(u.origin!==origin)return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:/\.(mjs|js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const fuente=await ctx.newPage();await fuente.goto(dian);const html=await fuente.locator('form').innerHTML();
 for(const tdj of [false,true]){
  const p=await ctx.newPage(),name=tdj?'titulos.html':'liquidacion.html';p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/'+name,{waitUntil:'networkidle'});await p.locator('.wpdf-trigger').first().waitFor();
  const nit=tdj?'#nitGlobal':'#nit';assert.equal(await p.locator(nit).inputValue(),'','sin importación automática');
  for(const tab of ['datos','pagos',tdj?'titulos':'resultados']){
   await p.locator(`.tab-btn[data-tab="${tab}"]`).click();await p.locator('.tab-pane.active .wpdf-trigger').click();
   await p.waitForFunction(()=>document.querySelector('.tab-pane.active .wpdf-estado')?.textContent.startsWith('Importación lista')).catch(async e=>{console.log('DIAGNÓSTICO',await p.locator('.tab-pane.active .wpdf-estado').innerText(),ctx.serviceWorkers().map(w=>w.url()));console.log(await ctx.serviceWorkers()[0].evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://muisca.dian.gov.co/*'});return chrome.scripting.executeScript({target:{tabId:tabs[0].id},func:()=>({url:location.href,form:!!document.querySelector('form')})});}));throw e;});
   assert.equal(await p.locator(nit).inputValue(),'900123456');
  }
  const mod=tdj?'tdj-core-16.33.143.js':'app.js';const snapshot=await p.evaluate(async({mod,tdj})=>{const s=(await import('/js/'+mod+'?v=16.33.273')).contextoImportacionWebPDF273();return tdj?s.obligaciones[0]:s;},{mod,tdj});
  assert.equal(snapshot.concepto,'RENTA');assert.equal(snapshot.vencimientos[0].fecha,'2025-08-01');assert.equal(snapshot.pagos.length,2);assert.equal(snapshot.pagos.reduce((s,p)=>s+p.valor,0),19578000);
  await p.screenshot({path:path.join(output,tdj?'tdj-web.png':'dian-web.png'),fullPage:true});
  const duplicada=await ctx.newPage();await duplicada.goto(dian);await p.locator('.tab-pane.active .wpdf-trigger').click();await p.locator('.tab-pane.active .wpdf-error').waitFor();assert.match(await p.locator('.tab-pane.active .wpdf-estado').innerText(),/varias consultas/);await duplicada.close();
  results.push(name+': complemento real, tres pestañas, 2 pagos únicos y rechazo de consulta ambigua');await p.close();
 }
 assert.equal(await fuente.locator('form').innerHTML(),html,'la página DIAN no cambia');assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'extension.json'),JSON.stringify(results,null,2));console.log('EXTENSIÓN 273 OK',results);
}finally{await ctx.close();}
