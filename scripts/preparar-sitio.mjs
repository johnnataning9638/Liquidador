import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const target=path.resolve(root,'dist');
if(path.dirname(target)!==root||path.basename(target)!=='dist')throw Error('Destino de publicación inválido');
const manifest=JSON.parse(await fs.readFile(path.join(root,'runtime-manifest.json'),'utf8'));
// Solo se limpia la carpeta generada dist, comprobada dentro del repositorio.
await fs.rm(target,{recursive:true,force:true});
for(const file of manifest.files){
 const input=path.resolve(root,file),output=path.resolve(target,file);
 if(!input.startsWith(root+path.sep)||!output.startsWith(target+path.sep))throw Error('Ruta fuera del sitio');
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(input,output);
}
console.log(`Sitio ${manifest.version}: ${manifest.files.length} recursos. Solo aplicación y parámetros públicos en dist.`);
