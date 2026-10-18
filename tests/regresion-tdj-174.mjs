import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ajustarTDJParaPagosPosteriores,
  reiniciarSecuenciaTDJ
} from '../js/prioridad-tdj-v132.js';

function motorStub(totalInicial) {
  return {
    calcular(datos) {
      const tdjs=(datos.pagos||[]).filter(p=>String(p.tdj||'').trim());
      const normales=(datos.pagos||[]).filter(p=>!String(p.tdj||'').trim());
      const sumaTDJ=tdjs.reduce((s,p)=>s+Math.max(0,Number(p.valor||0)),0);
      const sumaNormales=normales.reduce((s,p)=>s+Math.max(0,Number(p.valor||0)),0);
      const total=Math.max(0,totalInicial-sumaTDJ-sumaNormales);
      return {total,detalle:normales.map(p=>({pago:p,excedente:0,aplicado:{total:Number(p.valor||0)}}))};
    }
  };
}

const obligacion1={anio:2025,concepto:'VENTAS',periodo:'3',vencimientos:[{fecha:'2026-01-14',impuesto:10000000}]};
const obligacion2={...obligacion1,numero:2,periodo:'4'};

// El contrato base DIAN/TDJ de secuencia debe conservarse: el segundo título
// de la misma fecha no puede regresar a una obligación ya cerrada y sí puede
// continuar íntegramente hacia la segunda obligación.
reiniciarSecuenciaTDJ();
const t1={id:'T174-1',tdj:'TDJ-1',fecha:'2026-07-24',valor:10000000};
const t2={id:'T174-2',tdj:'TDJ-2',fecha:'2026-07-24',valor:10000000};
const r1=ajustarTDJParaPagosPosteriores(motorStub(10000000),{...obligacion1,pagos:[t1]},{soloTDJId:t1.id});
assert.equal(r1.pagos.find(p=>p.id===t1.id).valor,10000000);
const r2=ajustarTDJParaPagosPosteriores(motorStub(10000000),{...obligacion1,pagos:[t1,t2]},{soloTDJId:t2.id});
assert.equal(r2.pagos.find(p=>p.id===t2.id).valor,0);
const r2o2=ajustarTDJParaPagosPosteriores(motorStub(20000000),{...obligacion2,pagos:[t2]},{soloTDJId:t2.id});
assert.equal(r2o2.pagos.find(p=>p.id===t2.id).valor,10000000);

// Contrato de exportación: el parche debe conservar el bloque canónico y
// separar valor original, aplicado, endoso y destino, sin tocar motores.
const exportSource=fs.readFileSync(new URL('../js/export-tdj-recovery-16.33.174.js',import.meta.url),'utf8');
assert.match(exportSource,/TÍTULOS \/ TDJ — TÍTULOS REGISTRADOS/);
assert.match(exportSource,/VALOR ORIGINAL/);
assert.match(exportSource,/APLICADO/);
assert.match(exportSource,/ENDOSO/);
assert.match(exportSource,/DISPONIBLE PARA SIGUIENTE OBLIGACIÓN \/ ENDOSO/);

const bridgeSource=fs.readFileSync(new URL('../js/tdj-tasa-bridge-16.33.174.js',import.meta.url),'utf8');
assert.match(bridgeSource,/remanentePrevioMismaFecha/);
assert.match(bridgeSource,/actual\.valor=0/);
assert.match(bridgeSource,/<=\$1\.000/);

console.log('REGRESION TDJ/EXCEL 16.33.174: OK');
