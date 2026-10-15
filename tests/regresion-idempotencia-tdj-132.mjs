import assert from "node:assert/strict";
import {ajustarTDJParaPagosPosteriores} from "../js/prioridad-tdj-v132.js";

const pagosBase=[
  {id:"T1",tdj:"T1",esTDJ:true,fecha:"2026-07-22",valor:40},
  {id:"T2",tdj:"T2",esTDJ:true,fecha:"2026-07-23",valor:40},
  {id:"T3",tdj:"T3",esTDJ:true,fecha:"2026-07-24",valor:30},
  {id:"P1",recibo:"P1",fecha:"2026-10-01",valor:20}
];

function motorMock(){
  return {
    calcular(datos){
      const orden=[...(datos.pagos||[])].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
      let saldo=100;
      const detalle=orden.map(p=>{
        const aplicado=Math.min(Number(p.valor||0),saldo);
        saldo-=aplicado;
        return {
          pago:{...p},
          aplicado:{total:aplicado,impuesto:aplicado,intereses:0,sancion:0,excedente:0},
          excedente:Math.max(0,Number(p.valor||0)-aplicado)
        };
      });
      return {total:saldo,detalle};
    }
  };
}

const datos=()=>({anio:2026,concepto:"RENTA",periodo:"1",vencimientos:[{id:"V1",numero:1,fecha:"2026-06-01",impuesto:100}],fechaCorte:"2026-10-01",pagos:pagosBase.map(p=>({...p}))});
const motor=motorMock();

const primera=ajustarTDJParaPagosPosteriores(motor,datos());
const segunda=ajustarTDJParaPagosPosteriores(motor,datos());
const vigesima=Array.from({length:18},()=>ajustarTDJParaPagosPosteriores(motor,datos()));

assert.deepEqual(segunda,primera,"El segundo cálculo con los mismos datos debe ser idéntico al primero.");
for(const [i,r] of vigesima.entries()){
  assert.deepEqual(r,primera,`El cálculo repetido #${i+3} cambió respecto del primero.`);
}

const valores=primera.pagos.map(p=>[p.id,p.valor]);
assert.deepEqual(valores,[
  ["T1",40],
  ["T2",40],
  ["T3",20],
  ["P1",20]
]);

const pagoReal=primera.pagos.find(p=>p.id==="P1");
assert.equal(pagoReal.valor,20);
console.log("OK: 20 ejecuciones consecutivas producen exactamente el mismo resultado.");
console.log("OK: T1=40, T2=40, T3=20 y pago real=20 en todas las ejecuciones.");
