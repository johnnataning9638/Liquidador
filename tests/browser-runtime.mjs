import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium:engine}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
export const chromium={async launch(options){
  const browser=await engine.launch({...options,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
  if(process.env.TEST_LOCAL==='1'){
    const newPage=browser.newPage.bind(browser);
    browser.newPage=async options=>{
      const page=await newPage(options);
      const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
      await page.route('https://liquidador-de-obligaciones-tributarias.onrender.com/**',async route=>{
        const name=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
        const file=path.resolve(root,name);
        if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
        try{return route.fulfill({status:200,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html',body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:''});}
      });
      return page;
    };
  }
  return browser;
}};
