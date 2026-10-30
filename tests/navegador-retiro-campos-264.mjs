import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url))),root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const output=process.env.ARTIFACT_DIR||path.join(project,'test-results/retiro-campos-264');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:26400';
const browser=await chromium.launch({headless:true}),errors=[],results=[];
await fs.mkdir(output,{recursive:true});
try{
 const ctx=await browser.newContext({viewport:{width:1485,height:950}});
 if(!process.env.TEST_BASE_URL)await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="";export const SUPABASE_ANON_KEY="";'});
  try{return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const set=async(sel,value)=>{await p.locator(sel).fill(value);await p.locator(sel).press('Tab');};
 for(const tdj of [false,true]){
  await p.goto(base+(tdj?'/titulos.html':'/liquidacion.html'),{waitUntil:'networkidle'});
  await p.waitForSelector(tdj?'.obligacion-card':'#tieneSancion');
  assert.equal(await p.locator('#sancionMinima,#beneficioSancion,[data-k="beneficioSancion"],[data-k="valorSancionBeneficio"]').count(),0,'Los campos se retiran del DOM');
  if(tdj){
   const grid=await p.locator('.obligacion-card .obligation-fields').boundingBox(),cuotas=await p.locator('.obligacion-card .subpanel').boundingBox();
   assert.ok(cuotas.y-(grid.y+grid.height)<=12,'Cuotas inmediatamente después de la fila superior');
   assert.ok(grid.height<90,'Sin segunda fila vacía en escritorio');
   await p.locator('.obligacion-card').screenshot({path:path.join(output,'TDJ_sin_campos_sancion.png')});
   await p.locator('[data-k="tieneSancion"]').selectOption('SI');await set('[data-k="valorSancion"]','2500000');await set('.obligacion-card .compact-grid .fecha-campo','01/01/2023');
   await p.locator('[data-tab="pagos"]').click();await p.locator('[data-tab="datos"]').click();
   assert.equal((await p.locator('[data-k="valorSancion"]').inputValue()).replace(/\D/g,''),'2500000');
   await p.locator('[data-action="agregar-cuota"]').click();assert.equal(await p.locator('.cuotas-mini tbody tr').count(),2,'Agregar cuotas conserva funcionamiento');
   await p.setViewportSize({width:390,height:1000});
   await p.waitForLoadState('networkidle');
   assert.equal(await p.locator('[data-k="beneficioSancion"],[data-k="valorSancionBeneficio"]').count(),0);
   const select=await p.locator('[data-k="concepto"]').boundingBox();assert.ok(select.width>300,'Formulario móvil conserva ancho legible');
   await p.locator('.obligacion-card').screenshot({path:path.join(output,'TDJ_movil_sin_campos.png')});
   await p.setViewportSize({width:1485,height:950});
  }else{
   await p.locator('.sancion-grid').screenshot({path:path.join(output,'DIAN_sin_campos_sancion.png')});
   for(const choice of ['SI','NO','SI']){await p.locator('#tieneSancion').selectOption(choice);assert.equal(await p.locator('#valorSancion').isDisabled(),choice!=='SI');}
  }
  results.push({module:tdj?'TDJ':'DIAN',camposRetirados:true});
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({estado:'OK',results,errors}));
}finally{await browser.close();}
