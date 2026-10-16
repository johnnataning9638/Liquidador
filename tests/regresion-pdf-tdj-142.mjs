import fs from "node:fs";
const s=fs.readFileSync("js/tdj.js","utf8");
const decl="const hayTitulosRegistrados=titulos.some(t=>fechaISO(t.fecha)&&Number(t.valor)>0);";
if((s.match(new RegExp(decl.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length!==1) throw new Error("declaración duplicada/ausente");
if(s.indexOf(decl)>s.indexOf("if(hayTitulosRegistrados || hayExcedentesPago)")) throw new Error("TDZ: declaración posterior al uso");
console.log("OK: regresión PDF TDJ v16.33.142");
