import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=fs.readFileSync('js/app.js','utf8');
const start=app.indexOf('function habilitarSancion(){');
const fn=app.slice(start,app.indexOf('\nfunction pintarInforme(',start));
const ids=['valorSancion','fechaSancion','fechaSancionPicker'];
const fields=Object.fromEntries([...ids,'tieneSancion','beneficioSancion'].map(id=>[id,{value:id==='tieneSancion'?'':'dato conservado',disabled:false}]));
const ctx=vm.createContext({$:id=>fields[id],upper:v=>v.toUpperCase(),sincronizarTipoLiquidacionConSancion(){},actualizarSancionMinimaUI(){},capturarSancionUI(){}});
vm.runInContext(fn,ctx);
for(const selection of ['', 'NO', 'SI','NO','SI','']){
 fields.tieneSancion.value=selection;
 vm.runInContext('habilitarSancion()',ctx);
 for(const id of ids){assert.equal(fields[id].disabled,selection!=='SI',`${id}: ${selection||'vacío'}`);assert.equal(fields[id].value,'dato conservado');}
 assert.equal(fields.beneficioSancion.disabled,false,'Beneficio conserva su funcionamiento');
}
console.log('SANCIÓN 245 OK: bloqueo, calendario, alternancia y conservación de datos');
