import {actualizarParametros,crearLectorHttp} from './core.mjs';

const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rest(path:string,init:RequestInit={}){
 const response=await fetch(`${url}/rest/v1/${path}`,{...init,signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation',...init.headers}});
 if(!response.ok)throw Error(`Supabase HTTP ${response.status}: ${await response.text()}`);
 return response.status===204?null:await response.json();
}
const repository={
 async tim(v:Record<string,unknown>){return (await rest(`tasas_liquidador?select=tasa&fecha_inicio=eq.${v.fecha_inicio}&fecha_fin=eq.${v.fecha_fin}&tipo_tasa=eq.TASA%20DIAN&limit=1`))[0]||null;},
 async ipc(year:number){return (await rest(`ipc_liquidador?select=inflacion&anio_inflacion=eq.${year}&limit=1`))[0]||null;},
 async insertTim(v:unknown){await rest('tasas_liquidador',{method:'POST',body:JSON.stringify(v)});},
 async insertIpc(v:unknown){await rest('ipc_liquidador',{method:'POST',body:JSON.stringify(v)});}
};
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return Response.json({error:'Solo POST'},{status:405});
 let body;try{body=await req.json();}catch{return Response.json({error:'JSON inválido'},{status:400});}
 const started=new Date().toISOString();
 const result=await actualizarParametros({repository,fetchText:crearLectorHttp(),dryRun:body?.dry_run===true});
 // No se registran tokens, cabeceras ni datos de liquidaciones.
 try{await rest('parametros_actualizacion_log',{method:'POST',body:JSON.stringify({version:result.version,dry_run:result.dry_run,inicio:started,fin:new Date().toISOString(),ok:result.ok,tim:result.tim,ipc:result.ipc})});}
 catch(e){console.error('No fue posible registrar el resultado del actualizador',e.message);return Response.json({...result,registro:'ERROR'},{status:500});}
 return Response.json(result,{status:result.ok?200:207});
});
