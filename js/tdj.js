// TDJ PRE-MIGRACIÓN DIAN→TDJ — V16.33.129
//
// Este archivo es deliberadamente un puente de compatibilidad para restaurar
// SOLO el comportamiento del módulo TDJ al estado inmediatamente anterior a
// la migración estructural 16.33.130 (commit dce4726f...).
//
// NO modifica el liquidador BIEN/RIAN, el motor compartido ni el importador
// Excel. Carga la versión histórica de TDJ y su prioridad 16.33.129 desde el
// commit de referencia y resuelve sus dependencias compartidas contra el
// código actual del proyecto.

(async function(){
  "use strict";

  const REV="dce4726f2fa10d5110c00e71269aa53035a96311";
  const RAW="https://raw.githubusercontent.com/johnnataning9638/Liquidador/"+REV+"/";
  const renderJs=new URL("./",import.meta.url).href;

  async function cargar(path){
    const r=await fetch(RAW+path,{cache:"no-store"});
    if(!r.ok)throw new Error("No fue posible cargar el componente histórico TDJ: "+path+" (HTTP "+r.status+")");
    return r.text();
  }

  function resolverImports(source,base){
    source=source.replace(/from\s+(["'])\.\//g,(m,q)=>`from ${q}${base}`);
    source=source.replace(/import\(\s*(["'])\.\//g,(m,q)=>`import(${q}${base}`);
    return source;
  }

  // 1. Recuperamos exactamente la capa de prioridad que existía antes de la
  // migración: pagos normales primero, TDJ después, SIMPLE 4–6 excluido.
  let prioridad=await cargar("js/prioridad-tdj.js");
  prioridad=resolverImports(prioridad,renderJs);
  const prioridadUrl=URL.createObjectURL(new Blob([prioridad],{type:"text/javascript"}));

  // 2. Recuperamos el tdj.js histórico inmediatamente anterior a la migración.
  let tdj=await cargar("js/tdj.js");
  tdj=tdj.replace(/from\s+(["'])\.\/prioridad-tdj\.js(?:\?[^"']*)?\1/g,()=>`from "${prioridadUrl}"`);
  tdj=resolverImports(tdj,renderJs);

  // 3. Ejecutamos el módulo histórico como ES module para conservar sus
  // exportaciones/importaciones y su estado interno exactamente como fue diseñado.
  const tdjUrl=URL.createObjectURL(new Blob([tdj],{type:"text/javascript"}));
  try{
    await import(tdjUrl);
  }finally{
    URL.revokeObjectURL(tdjUrl);
    URL.revokeObjectURL(prioridadUrl);
  }
})();
