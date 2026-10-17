import fs from "node:fs";
import assert from "node:assert/strict";
const s=fs.readFileSync("js/tdj-core-16.33.143.js","utf8");
assert.match(s,/v16\.33\.157: el remanente del título/);
assert.doesNotMatch(s,/saldoObligacionActual>0\.5\)break/);
function sec(obls,titulos){let c=0,o=[];for(const t of titulos){let d=t.v;while(d>0.5&&c<obls.length){const a=Math.min(d,obls[c]);obls[c]-=a;d-=a;o.push([t.id,c+1,a]);if(obls[c]<=0.5)c++;else break;}}return{obls,o};}
const r=sec([10000000,20000000],[{id:"TDJ1",v:5000000},{id:"TDJ2",v:10000000}]);
assert.deepEqual(r.o,[["TDJ1",1,5000000],["TDJ2",1,5000000],["TDJ2",2,5000000]]);
const r2=sec([10000000,20000000],[{id:"TDJ1",v:10000000},{id:"TDJ2",v:5000000}]);
assert.deepEqual(r2.o,[["TDJ1",1,10000000],["TDJ2",2,5000000]]);
console.log("REGRESION TDJ 157 OK");
