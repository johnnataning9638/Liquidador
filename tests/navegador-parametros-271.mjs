import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:27100';
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/parametros-271');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 let fallarTasas=false;
 ctx.setDefaultTimeout(15000);
 if(!process.env.TEST_BASE_URL)await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  if(fallarTasas&&name==='datos/tasas-moratorias.json')return route.fulfill({status:503,body:'Servicio no disponible'});
  try{return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 for(const file of ['titulos.html','liquidacion.html']){
  const p=await ctx.newPage(),errors=[];
  p.on('console',m=>{if(m.type()==='error'&&m.text())errors.push(m.text());});
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(base+'/'+file,{waitUntil:'networkidle'});
  await p.waitForFunction(()=>!document.querySelector('.indicador-parametros')?.classList.contains('cargando'));
  assert.equal(await p.locator('.indicador-parametros').evaluate(x=>x.classList.contains('listo')),true,file+' debe completar la carga y mostrar verde');
  assert.deepEqual(errors,[],file+' sin excepciones atrapadas ni errores de página');
  if(file==='titulos.html'){
   const local=JSON.parse(await fs.readFile(path.join(root,'datos/tasas-moratorias.json'),'utf8'));
   const filas=await p.locator('#tablaTasasTDJ tbody tr').evaluateAll(xs=>xs.map(tr=>[...tr.cells].map(td=>td.textContent)));
   assert.ok(filas.length>=local.length,'Histórico completo en el panel de tasas');
   for(const t of local){
    const fecha=x=>x.split('-').reverse().join('/');
    const fila=filas.find(f=>f[0]===fecha(t.desde)&&f[1]===fecha(t.hasta));assert.ok(fila,'Fila histórica '+t.desde);
    const n=Number(t.tasas?.['TASA DIAN']);const tasa=Number.isFinite(n)?(n>1?n/100:n):null;
    assert.equal(fila[2],tasa==null?'SIN DATOS':(tasa*100).toFixed(3)+'%','La tabla muestra la TIM de su propia fila '+t.desde);
   }
   assert.ok(await p.locator('#tablaIPCTDJ tbody tr').count()>0,'IPC renderizado después de tasas');
   await p.screenshot({path:path.join(output,'tdj-indicador-verde.png'),fullPage:false});
   // Un cálculo real se completa después de la inicialización, con parámetros cargados.
   await p.locator('#nitGlobal').fill('900000001');await p.locator('#razonGlobal').fill('PRUEBA PARAMETROS');
   await p.locator('[data-k="concepto"]').selectOption('RENTA');await p.locator('[data-k="anio"]').fill('2023');await p.locator('[data-k="periodo"]').selectOption('1');
   await p.locator('.cuotas-mini .fecha-campo').fill('01/01/2023');await p.locator('.cuotas-mini .fecha-campo').press('Tab');await p.locator('.cuotas-mini [data-v="impuesto"]').fill('1000000');await p.locator('.cuotas-mini [data-v="impuesto"]').press('Tab');
   await p.locator('[data-tab="titulos"]').click();await p.locator('.btn-calcular-tdj:visible').first().click();
   await p.waitForSelector('#tablaResultadoObligaciones tbody tr');
   const saldo=await p.locator('#tablaResultadoObligaciones tbody tr').first().locator('td').last().textContent();
   assert.ok(Number(saldo.replace(/[^0-9-]/g,''))>=1000000,'Cálculo disponible con capital e intereses al corte');
  }
  assert.deepEqual(errors,[],file+' sin errores después de inicializar y operar');
  results.push({modulo:file,indicador:'verde',errores:errors});await p.close();
 }
 if(!process.env.TEST_BASE_URL){
  fallarTasas=true;const p=await ctx.newPage();await p.goto(base+'/titulos.html',{waitUntil:'networkidle'});
  await p.waitForFunction(()=>document.querySelector('.indicador-parametros')?.classList.contains('error'));
  assert.equal(await p.locator('.indicador-parametros').getAttribute('title'),'ERROR CARGANDO PARÁMETROS','Un fallo real de carga conserva el indicador rojo');await p.close();
 }
 await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify(results,null,2));console.log('PARÁMETROS 271 OK: '+JSON.stringify(results));
}finally{await browser.close();}
