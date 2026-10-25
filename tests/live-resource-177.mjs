import {chromium} from './browser-runtime.mjs';
import fs from 'node:fs';
const {version}=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8'));
const u=`https://liquidador-de-obligaciones-tributarias.onrender.com/titulos.html?v=${version}`;
const b=await chromium.launch({headless:true});const p=await b.newPage();try{
  await p.goto(u,{waitUntil:'networkidle',timeout:30000});
  const r=await p.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/tdj\.js|tdj-secuencia-guard|tdj-core/.test(x)));
  console.log('LIVE RESOURCES',r);
  if(!r.some(x=>x.includes(`/js/tdj.js?v=${version}`)))throw new Error('entrypoint vigente no cargado');
  if(!r.some(x=>x.includes('/js/tdj-secuencia-guard-16.33.185.js?v=16.33.185')))throw new Error('guardia vigente 185 no cargada');
  if(!r.some(x=>x.includes(`/js/tdj-core-16.33.143.js?v=${version}`)))throw new Error('core sin versión vigente');
  console.log('LIVE RESOURCE OK',version);
}finally{await b.close()}
