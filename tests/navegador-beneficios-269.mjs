import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/beneficios-269');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26900';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],resultados=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 ctx.setDefaultTimeout(12000);
 let inject=false,fail=false,malicious=false;
 if(!process.env.TEST_BASE_URL)await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const n=decodeURIComponent(u.pathname).slice(1),f=path.resolve(root,n);
  if(!f.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(n==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  if(n==='datos/beneficios.json'&&fail)return route.fulfill({status:503,body:''});
  try{
   let body=await fs.readFile(f);
   if(n==='datos/beneficios.json'&&inject){
    const data=JSON.parse(body);data.push({id:'PRUEBA_FUTURA',nombre:'Beneficio futuro de prueba',vigenciaDesde:'2027-01-01',fechaPagoHasta:'2027-12-31',efectoInteresFactor:0.25,fuente:'Fuente de prueba',fuente_url:malicious?'javascript:alert(1)':'https://normograma.dian.gov.co/'});
    if(malicious)data.at(-1).nombre='<img src=x onerror="window.__xss269=1">';
    body=Buffer.from(JSON.stringify(data));
   }
   return route.fulfill({contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':n.endsWith('.json')?'application/json':'text/html',body});
  }catch{return route.fulfill({status:404,body:''});}
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 for(const file of ['liquidacion.html','titulos.html']){
  await p.setViewportSize({width:1440,height:1000});await p.goto(base+'/'+file,{waitUntil:'networkidle'});
  if(file==='titulos.html')await p.waitForSelector('.obligacion-card');
  const trigger=p.locator('#btnBeneficios');assert.equal(await trigger.count(),1);
  const boxes=await p.evaluate(()=>({button:document.querySelector('#btnBeneficios').getBoundingClientRect().toJSON(),led:document.querySelector('.indicador-parametros').getBoundingClientRect().toJSON(),title:document.querySelector('.encabezado-liquidacion').getBoundingClientRect().toJSON()}));
  assert.ok(boxes.button.right<boxes.led.left,'Botón a la izquierda del indicador');assert.ok(boxes.button.left>boxes.title.right,'Sin solapar título en escritorio');
  const state=await p.locator('main input,main select').evaluateAll(xs=>xs.map(x=>[x.id,x.value]));
  await p.screenshot({path:path.join(output,file+'-boton.png'),fullPage:false});
  await trigger.click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===15);
  const dialog=p.locator('#catalogoBeneficios');assert.equal(await dialog.getAttribute('open'),'');
  assert.equal(await p.locator('#buscarBeneficios').evaluate(x=>x===document.activeElement),true);
  assert.equal(await dialog.locator('thead th').count(),4);
  assert.equal(await dialog.locator('[data-beneficio-id]').count(),15);
  assert.equal(await dialog.locator('.beneficios-tabla').evaluate(x=>getComputedStyle(x).fontWeight),'400');
  await p.screenshot({path:path.join(output,file+'-tabla.png'),fullPage:false});
  await p.locator('[data-filtro="automaticos"]').click();assert.equal(await dialog.locator('[data-beneficio-id]').count(),3);
  await p.locator('#buscarBeneficios').fill('corriente');assert.equal(await dialog.locator('[data-beneficio-id]').count(),3);
  await p.locator('#buscarBeneficios').fill('sin coincidencias 269');assert.equal(await dialog.locator('[data-beneficio-id]').count(),0);assert.ok(await dialog.textContent().then(t=>t.includes('No hay beneficios')));
  await p.locator('#buscarBeneficios').fill('');await p.locator('[data-filtro="todos"]').click();
  await dialog.locator('summary').first().click();assert.equal(await dialog.locator('details[open]').count(),1);
  assert.ok((await dialog.locator('a').first().getAttribute('href')).startsWith('https://normograma.dian.gov.co/'));
  await p.keyboard.press('Escape');assert.equal(await dialog.evaluate(x=>x.open),false);assert.equal(await trigger.evaluate(x=>x===document.activeElement),true);
  for(const cierre of ['boton','escape','fondo']){
   await trigger.click();await p.locator('[data-filtro="automaticos"]').click();await p.locator('#buscarBeneficios').fill('corriente');
   assert.equal(await dialog.locator('[data-beneficio-id]').count(),3);
   if(cierre==='boton')await dialog.locator('.beneficios-cerrar').click();
   else if(cierre==='escape'){await dialog.locator('.beneficios-cerrar').focus();await p.keyboard.press('Escape');}
   else await p.mouse.click(1,1);
   await p.waitForFunction(()=>!document.querySelector('#catalogoBeneficios').open);
   await trigger.click();
   assert.equal(await p.locator('#buscarBeneficios').inputValue(),'','Búsqueda limpia después de cerrar con '+cierre);
   assert.equal(await p.locator('[data-filtro="todos"]').getAttribute('aria-pressed'),'true','Todos seleccionado después de '+cierre);
   assert.equal(await p.locator('.beneficios-filtros [aria-pressed="true"]').count(),1);
   assert.equal(await dialog.locator('[data-beneficio-id]').count(),15,'Catálogo completo al reabrir');
   await p.keyboard.press('Escape');
  }
  assert.deepEqual(await p.locator('main input,main select').evaluateAll(xs=>xs.map(x=>[x.id,x.value])),state,'Consulta no cambia datos de liquidación');
  for(const width of [390,360]){
   await p.setViewportSize({width,height:844});await trigger.click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===15);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desbordar la página en móvil');
   const size=await dialog.boundingBox();assert.ok(size.x>=0&&size.x+size.width<=width,'Ventana dentro de pantalla');
   assert.ok(await dialog.locator('.beneficios-scroll').evaluate(x=>x.scrollWidth>x.clientWidth),'Tabla desplazable en móvil');
   if(width===390)await p.screenshot({path:path.join(output,file+'-movil.png'),fullPage:false});
   await p.keyboard.press('Escape');
  }
  await p.setViewportSize({width:1440,height:1000});
  if(!process.env.TEST_BASE_URL){
   inject=true;await trigger.click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===16);
   assert.equal(await dialog.locator('[data-beneficio-id="PRUEBA_FUTURA"]').count(),1,'Nuevo registro visible automáticamente en ambos módulos');
   await p.keyboard.press('Escape');inject=false;
   fail=true;await trigger.click();await p.waitForSelector('.beneficios-reintentar:visible');assert.ok((await dialog.locator('[role="status"]').textContent()).includes('No se pudo actualizar'));
   fail=false;await p.locator('.beneficios-reintentar').click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===15);
   await p.keyboard.press('Escape');
  }
  resultados.push({modulo:file,filas:15,automaticos:3,teclado:true,movil:[390,360],reinicioFiltros:['boton','escape','fondo'],datosIntactos:true});
 }
 if(!process.env.TEST_BASE_URL){
  // Falla inicial y recuperación, sin afirmar que un catálogo vacío está completo.
  fail=true;await p.reload({waitUntil:'networkidle'});await p.locator('#btnBeneficios').click();await p.waitForSelector('.beneficios-reintentar:visible');assert.equal(await p.locator('[data-beneficio-id]').count(),0);
  fail=false;await p.locator('.beneficios-reintentar').click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===15);await p.keyboard.press('Escape');
  inject=true;malicious=true;await p.locator('#btnBeneficios').click();await p.waitForFunction(()=>document.querySelectorAll('[data-beneficio-id]').length===16);
  assert.equal(await p.locator('#catalogoBeneficios img').count(),0);assert.equal(await p.evaluate(()=>window.__xss269),undefined);assert.equal(await p.locator('#catalogoBeneficios a[href^="javascript:"]').count(),0);
  await p.keyboard.press('Escape');inject=false;malicious=false;
  // Nueva opción del selector sin metadatos: visible con ficha pendiente, sin ejecutar código.
  await p.evaluate(()=>{const s=document.createElement('select');s.dataset.p='tipo';s.hidden=true;s.append(new Option('Beneficio nuevo del selector','Beneficio nuevo del selector'));document.querySelector('main').append(s);});
  await p.locator('#btnBeneficios').click();await p.waitForFunction(()=>document.querySelector('#catalogoBeneficios')?.textContent.includes('Beneficio nuevo del selector'));
  assert.ok((await p.locator('#catalogoBeneficios').textContent()).includes('Beneficio nuevo del selector'));
 }
 assert.deepEqual(errors,[],'Sin errores de página');
 await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify({resultados,errors},null,2));
 console.log('NAVEGADOR CATÁLOGO 269 OK: '+JSON.stringify(resultados));
}finally{await browser.close();}
