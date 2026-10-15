import assert from 'node:assert/strict';
import { ajustarTDJParaPagosPosteriores, reiniciarSecuenciaTDJ } from '../js/prioridad-tdj.js';

// Motor de regresión: procesa cronológicamente y marca como excedente el
// componente que ya no puede ser absorbido por la obligación. El objetivo es
// comprobar la prioridad del pago real posterior frente al último TDJ necesario.
function motor(debt){
  return {
    calcular(datos){
      let saldo=debt;
      const detalle=[];
      for(const p of [...datos.pagos].sort((a,b)=>
        String(a.fecha).localeCompare(String(b.fecha)) ||
        Number(a.__ordenOriginal??a.numero??0)-Number(b.__ordenOriginal??b.numero??0)
      )){
        const aplicado=Math.min(saldo,Number(p.valor||0));
        const excedente=Math.max(0,Number(p.valor||0)-aplicado);
        saldo-=aplicado;
        detalle.push({pago:p,excedente,aplicado:{excedente}});
      }
      return {total:saldo,detalle};
    }
  };
}

const titulos=[
  {id:'T3',tdj:'T3',esTDJ:true,fecha:'2026-07-22',valor:3500080},
  {id:'T4',tdj:'T4',esTDJ:true,fecha:'2026-07-23',valor:7051615},
  {id:'T5',tdj:'T5',esTDJ:true,fecha:'2026-07-24',valor:2304453},
  {id:'T6',tdj:'T6',esTDJ:true,fecha:'2026-07-24',valor:3710536},
  {id:'T7',tdj:'T7',esTDJ:true,fecha:'2026-07-28',valor:299898},
  {id:'T8',tdj:'T8',esTDJ:true,fecha:'2026-07-31',valor:239045},
  {id:'T9',tdj:'T9',esTDJ:true,fecha:'2026-09-01',valor:5772},
  {id:'T10',tdj:'T10',esTDJ:true,fecha:'2026-09-14',valor:5585}
];
const pago11={id:'P11',fecha:'2026-10-01',valor:8193000};
const deuda=22531000;

reiniciarSecuenciaTDJ();
let anteriores=[];
const valores={};

for(const titulo of titulos){
  const datos={
    anio:2025,
    concepto:'VENTAS',
    periodo:'3',
    vencimientos:[{fecha:'2026-01-14',impuesto:deuda}],
    pagos:[...anteriores,titulo,pago11]
  };
  const salida=ajustarTDJParaPagosPosteriores(motor(deuda),datos,{soloTDJId:titulo.id});
  const valor=Number(salida.pagos.find(p=>p.id===titulo.id)?.valor||0);
  valores[titulo.id]=valor;
  anteriores=[...anteriores,{...titulo,valor}];
}

assert.equal(valores.T3,3500080,'TDJ 3 debe aplicarse completo.');
assert.equal(valores.T4,7051615,'TDJ 4 debe aplicarse completo.');
assert.equal(valores.T5,2304453,'TDJ 5 debe aplicarse completo.');
assert.equal(valores.T6,1481852,'TDJ 6 debe cubrir solo el saldo necesario frente al pago real 11.');
assert.equal(valores.T7,0,'TDJ 7 posterior debe quedar para endoso.');
assert.equal(valores.T8,0,'TDJ 8 posterior debe quedar para endoso.');
assert.equal(valores.T9,0,'TDJ 9 posterior debe quedar para endoso.');
assert.equal(valores.T10,0,'TDJ 10 posterior debe quedar para endoso.');

console.log('REGRESIÓN TDJ 16.33.130: OK — pago real prioritario, último TDJ parcial y TDJ posteriores para endoso.');
