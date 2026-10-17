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

reiniciarSecuenciaTDJ();
const base1={...obligacion1,pagos:[
  {id:'P1',fecha:'2026-07-01',valor:40,tdj:'',esTDJ:false},
  {id:'T1',fecha:'2026-06-01',valor:100,tdj:'TDJ-1',esTDJ:true}
]};
const r1=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
assert.equal(r1.pagos.find(p=>p.id==='T1').valor,60,'El TDJ debe aportar solo lo necesario frente al pago posterior.');

const base2={...obligacion2,pagos:[{id:'T1-O2',fecha:'2026-06-01',valor:40,tdj:'TDJ-1',esTDJ:true}]};
const r2=ajustarTDJParaPagosPosteriores(mockMotor(50),base2,{soloTDJId:'T1-O2'});
assert.equal(r2.pagos.find(p=>p.id==='T1-O2').valor,40,'El excedente debe continuar a la obligación siguiente.');

// Primero se cubre realmente la obligación y luego se intenta aplicar un título
// adicional a la misma obligación: el título NO se destruye; conserva su valor
// para que la capa superior pueda continuar con la siguiente obligación.
reiniciarSecuenciaTDJ();
const cubierta={...obligacion1,pagos:[{id:'T1-CUBRE',fecha:'2026-06-01',valor:100,tdj:'TDJ-CUBRE',esTDJ:true}]};
const cierre=ajustarTDJParaPagosPosteriores(mockMotor(100),cubierta,{soloTDJId:'T1-CUBRE'});
assert.equal(cierre.pagos.find(p=>p.id==='T1-CUBRE').valor,100);
const posterior={...obligacion1,pagos:[{id:'T2',fecha:'2026-06-15',valor:25,tdj:'TDJ-2',esTDJ:true}]};
const bloqueado=ajustarTDJParaPagosPosteriores(mockMotor(100),posterior,{soloTDJId:'T2'});
assert.equal(bloqueado.pagos.find(p=>p.id==='T2').valor,25,'Un título posterior conserva su valor para poder avanzar a la obligación siguiente.');

// REGRESIÓN CRÍTICA v16.33.147 — dos títulos con la misma fecha.
// El primer título cierra la obligación actual. El segundo título NO puede ser
// anulado por el cursor; debe quedar disponible para que la capa superior lo
// lleve a la obligación siguiente.
reiniciarSecuenciaTDJ();
const t1MismaFecha={...obligacion1,pagos:[{id:'T1-MISMA',fecha:'2026-06-30',valor:100,tdj:'TDJ-1',esTDJ:true}]};
const rMisma1=ajustarTDJParaPagosPosteriores(mockMotor(100),t1MismaFecha,{soloTDJId:'T1-MISMA'});
assert.equal(rMisma1.pagos.find(p=>p.id==='T1-MISMA').valor,100);
const t2MismaFecha={...obligacion1,pagos:[{id:'T2-MISMA',fecha:'2026-06-30',valor:50,tdj:'TDJ-2',esTDJ:true}]};
const rMisma2=ajustarTDJParaPagosPosteriores(mockMotor(100),t2MismaFecha,{soloTDJId:'T2-MISMA'});
assert.equal(rMisma2.pagos.find(p=>p.id==='T2-MISMA').valor,50,'Un segundo TDJ de la misma fecha conserva el valor para continuar con la siguiente obligación.');

// Un nuevo cálculo no debe heredar el cursor de una ejecución anterior.
reiniciarSecuenciaTDJ();
const primera=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
const segunda=ajustarTDJParaPagosPosteriores(mockMotor(100),base1,{soloTDJId:'T1'});
assert.equal(primera.pagos.find(p=>p.id==='T1').valor,60);
assert.equal(segunda.pagos.find(p=>p.id==='T1').valor,60,'El recálculo debe iniciar nuevamente desde la obligación 1.');

console.log('REGRESIÓN TDJ 16.33.147: OK — prioridad secuencial, arrastre entre obligaciones, conservación del título bloqueado, títulos de misma fecha y reinicio de cálculo.');
