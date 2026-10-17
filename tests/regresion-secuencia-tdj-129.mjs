import assert from 'node:assert/strict';
import { ajustarTDJParaPagosPosteriores, reiniciarSecuenciaTDJ } from '../js/prioridad-tdj.js';

function mockMotor(debt){
  return {
    calcular(datos){
      const tdj=(datos.pagos||[]).filter(p=>p.esTDJ).reduce((s,p)=>s+Math.max(0,Number(p.valor||0)),0);
      const normales=(datos.pagos||[]).filter(p=>!p.esTDJ);
      const normalTotal=normales.reduce((s,p)=>s+Math.max(0,Number(p.valor||0)),0);
      const totalPagos=tdj+normalTotal;
      const total=Math.max(0,debt-totalPagos);
      const excedenteNormal=totalPagos>debt?Math.max(0,totalPagos-debt):0;
      return {total,detalle:(datos.pagos||[]).map(p=>({pago:p,excedente:!p.esTDJ?excedenteNormal:0,aplicado:{excedente:!p.esTDJ?excedenteNormal:0}}))};
    }
  };
}

const obligacion1={anio:2025,concepto:'VENTAS',periodo:'3',vencimientos:[{fecha:'2025-01-14',impuesto:100}]};
const obligacion2={anio:2026,concepto:'VENTAS',periodo:'1',vencimientos:[{fecha:'2026-05-13',impuesto:50}]};

// REGRESIÓN EXISTENTE: pago posterior debe quedar totalmente aplicado y el
// TDJ solo cubre el hueco que realmente corresponde.
reiniciarSecuenciaTDJ();
const base1={...obligacion1,pagos:[
  {id:'P1',fecha:'2026-07-01',valor:40,tdj:'',esTDJ:false},
  {id:'T1',fecha:'2026-06-01',valor:100,tdj:'TDJ-1',esTDJ:true}
]};
const r1=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
assert.equal(r1.pagos.find(p=>p.id==='T1').valor,60,'El TDJ debe aportar solo lo necesario frente al pago posterior.');

// Un título puede conservar todo su valor cuando la obligación actual aún
// necesita ese importe.
const base2={...obligacion2,pagos:[{id:'T1-O2',fecha:'2026-06-01',valor:40,tdj:'TDJ-1',esTDJ:true}]};
const r2=ajustarTDJParaPagosPosteriores(mockMotor(50),base2,{soloTDJId:'T1-O2'});
assert.equal(r2.pagos.find(p=>p.id==='T1-O2').valor,40,'El TDJ debe conservarse mientras exista saldo en la obligación.');

// REGRESIÓN CRÍTICA v16.33.148 — si una obligación ya quedó cerrada, un TDJ
// posterior de la misma fecha se pone en cero SOLO para esa obligación. La
// capa superior conserva el valor original de 'disponible' y continúa con la
// siguiente obligación.
reiniciarSecuenciaTDJ();
const cubierta={...obligacion1,pagos:[{id:'T1-CUBRE',fecha:'2026-06-30',valor:100,tdj:'TDJ-CUBRE',esTDJ:true}]};
const cierre=ajustarTDJParaPagosPosteriores(mockMotor(100),cubierta,{soloTDJId:'T1-CUBRE'});
assert.equal(cierre.pagos.find(p=>p.id==='T1-CUBRE').valor,100,'El primer TDJ debe cerrar la obligación.');
const segundoMismaFecha={...obligacion1,pagos:[{id:'T2-MISMA',fecha:'2026-06-30',valor:50,tdj:'TDJ-2',esTDJ:true}]};
const bloqueado=ajustarTDJParaPagosPosteriores(mockMotor(100),segundoMismaFecha,{soloTDJId:'T2-MISMA'});
assert.equal(bloqueado.pagos.find(p=>p.id==='T2-MISMA').valor,0,'El segundo TDJ de la misma fecha no debe reaplicarse a la obligación cerrada.');

// Si la primera obligación NO está cerrada, varios TDJ de la misma fecha sí
// deben continuar cubriendo la misma obligación hasta agotarla.
reiniciarSecuenciaTDJ();
const primeroParcial={...obligacion1,pagos:[{id:'T1-PARCIAL',fecha:'2026-06-30',valor:40,tdj:'TDJ-1',esTDJ:true}]};
const parcial=ajustarTDJParaPagosPosteriores(mockMotor(100),primeroParcial,{soloTDJId:'T1-PARCIAL'});
assert.equal(parcial.pagos.find(p=>p.id==='T1-PARCIAL').valor,40);
const segundoContinua={...obligacion1,pagos:[
  {id:'T1-PARCIAL',fecha:'2026-06-30',valor:40,tdj:'TDJ-1',esTDJ:true},
  {id:'T2-CONTINUA',fecha:'2026-06-30',valor:30,tdj:'TDJ-2',esTDJ:true}
]};
const continua=ajustarTDJParaPagosPosteriores(mockMotor(100),segundoContinua,{soloTDJId:'T2-CONTINUA'});
assert.equal(continua.pagos.find(p=>p.id==='T2-CONTINUA').valor,30,'Un segundo TDJ de la misma fecha debe continuar sobre la obligación que aún tiene saldo.');

// Un nuevo cálculo debe poder reiniciar la secuencia sin heredar el cursor.
reiniciarSecuenciaTDJ();
const primera=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
reiniciarSecuenciaTDJ();
const segunda=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
assert.equal(primera.pagos.find(p=>p.id==='T1').valor,60);
assert.equal(segunda.pagos.find(p=>p.id==='T1').valor,60,'El recálculo debe iniciar nuevamente desde la obligación 1.');

console.log('REGRESIÓN TDJ 16.33.148: OK — pagos posteriores sin excedente, cierre definitivo, títulos de misma fecha, continuidad mientras exista saldo y reinicio de secuencia.');
