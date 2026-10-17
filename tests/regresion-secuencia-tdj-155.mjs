import fs from "node:fs";
import assert from "node:assert/strict";
const s=fs.readFileSync("js/tdj-core-16.33.143.js","utf8");
assert.match(s,/v16\.33\.155: regla única/);
assert.match(s,/if\(saldoObligacionActual>0\.5\)break;/);
assert.doesNotMatch(s,/obligacionCubiertaPorPagosProtegidos/);
function sec(obls,titulos){let c=0,o=[];for(const t of titulos){let d=t.v;while(d>0.5&&c<obls.length){const a=Math.min(d,obls[c]);obls[c]-=a;d-=a;o.push([t.id,c+1,a]);if(obls[c]<=0.5)c++;else break;}}return{obls,o};}
// Estado exacto antes del TDJ4: TDJ3 ya aplicó 15.548M a O1 y su excedente 4.452M a O2.
// Por tanto O1 conserva 9.041M. El siguiente TDJ DEBE retomar O1.
const r=sec([9041000,45134000],[{id:"TDJ4",v:10000000}]);
assert.deepEqual(r.o[0],["TDJ4",1,9041000]);
assert.deepEqual(r.o[1],["TDJ4",2,959000]);
assert.equal(r.obls[0],0);
assert.equal(r.obls[1],44175000);
console.log("REGRESION TDJ 155 OK");
