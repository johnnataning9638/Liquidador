import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser-runtime.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url))),root=process.env.TEST_SITE_DIR?path.resolve(process.env.TEST_SITE_DIR):project;
const local=JSON.parse(await fs.readFile(root+'/datos/uvt.json','utf8'));
const rows=local.map(x=>({anio:x.anio,valor_uvt:x.valor,sancion_minima:x.sancionMinima,aplicable_desde:`${x.anio}-01-01`,estado:'ACTIVA'}));
rows.push({anio:2027,valor_uvt:55123,sancion_minima:551000,aplicable_desde:'2027-01-01',estado:'ACTIVA'});
const b=await chromium.launch({headless:true});let offline=false,calls=0;
try{
 const c=await b.newContext();
 await c.addInitScript(()=>{const Original=Date;globalThis.Date=class extends Original{constructor(...args){super(...(args.length?args:['2027-01-04T12:00:00Z']));}static now(){return new Original('2027-01-04T12:00:00Z').getTime();}};});
 await c.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='prueba.supabase.co'){calls++;return route.fulfill({status:offline?503:200,contentType:'application/json',body:JSON.stringify(rows)});}
  if(u.hostname!=='127.0.0.1')return route.abort();
  const name=decodeURIComponent(u.pathname).slice(1),f=path.resolve(root,name);
  if(!f.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(name==='js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'export const SUPABASE_URL="https://prueba.supabase.co";export const SUPABASE_ANON_KEY="publica-prueba";'});
  try{return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html',body:await fs.readFile(f)});}catch{return route.fulfill({status:404,body:''});}
 });
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const set=async(sel,value)=>{await p.locator(sel).fill(value);await p.locator(sel).press('Tab');};
 for(const cached of [false,true]){
  offline=cached;
  await p.goto('http://127.0.0.1:26300/liquidacion.html',{waitUntil:'networkidle'});
  await p.locator('#tieneSancion').selectOption('SI');await p.locator('#beneficioSancion').selectOption('CON BENEFICIO');await set('#anio','2027');
  assert.equal((await p.locator('#sancionMinima').inputValue()).replace(/\D/g,''),'551000',cached?'Respaldo de UVT verificada':'Año nuevo desde tabla central sin desplegar');
 }
 assert.ok(calls>=2);assert.deepEqual(errors,[]);
 console.log('UVT FUTURA 263 OK: año 2027 simulado desde Supabase, activación por fecha y caché ante caída; sin agregar datos ficticios a producción');
}finally{await b.close();}
