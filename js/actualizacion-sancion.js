import {fechaISO,roundMil,diasEntre} from "./utilidades.js";

/**
 * Actualización independiente de sanciones (Art. 867-1 E.T.)
 *
 * La sanción original nunca se reconstruye. Este módulo recibe el saldo
 * vigente, determina el período de actualización según la fecha base y
 * devuelve el nuevo saldo junto con la trazabilidad de cada tramo.
 *
 * Para Liquidación Privada, la fecha base que entrega el formulario es la
 * fecha de presentación de la declaración. Para Liquidación Oficial y
 * Sanción Independiente, la fecha base es la fecha de ejecutoria.
 *
 * La mecánica de tramos reproduce la estructura observada en el Excel de
 * referencia: una vez transcurrido un año desde la fecha base, se recorren
 * los días de cada vigencia; cada tramo usa el IPC de la vigencia y se aplica
 * sobre el saldo anterior. Si falta el IPC de una vigencia, no se inventa:
 * el tramo queda pendiente y se registra una advertencia.
 */
export class ActualizadorSancion{
  constructor({ipc=[]}={}){ this.ipc=Array.isArray(ipc)?ipc:[]; }

  ipcPorAnio(anio){
    return this.ipc.find(x=>Number(x.anioInflacion??x.anio)===Number(anio))||null;
  }

  aniosEntre(inicio,fin){
    const a=Number(String(inicio).slice(0,4));
    const b=Number(String(fin).slice(0,4));
    const out=[];
    for(let y=a;y<=b;y++)out.push(y);
    return out;
  }

  sumarUnAnio(iso){
    const [y,m,d]=String(iso).split("-").map(Number);
    const ultimo=new Date(Date.UTC(y+1,m,0)).getUTCDate();
    return `${y+1}-${String(m).padStart(2,"0")}-${String(Math.min(d,ultimo)).padStart(2,"0")}`;
  }

  /**
   * Calcula la actualización acumulativa desde la fecha de aniversario
   * (fecha base + 1 año) hasta la fecha de corte.
   */
  calcular(saldoInicial,fechaBase,fechaCorte){
    let saldo=Math.max(0,Number(saldoInicial||0));
    const base=fechaISO(fechaBase),corte=fechaISO(fechaCorte);
    const tramos=[];
    const advertencias=[];
    if(!saldo||!base||!corte||corte<=base){
      return {saldoInicial:saldo,valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaActivacion:null,tramos,advertencias};
    }

    const aniversario=this.sumarUnAnio(base);
    if(corte<aniversario){
      return {saldoInicial:saldo,valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaActivacion:aniversario,tramos,advertencias};
    }

    let desde=aniversario;
    const limite=corte;
    const anioInicio=Number(desde.slice(0,4));
    const anioFin=Number(limite.slice(0,4));

    for(let anio=anioInicio;anio<=anioFin;anio++){
      const inicioTramo=anio===anioInicio?desde:`${anio}-01-01`;
      const finTramo=anio===anioFin?limite:`${anio}-12-31`;
      if(finTramo<inicioTramo)continue;
      const dias=diasEntre(inicioTramo,finTramo);
      if(dias<=0)continue;
      const fila=this.ipcPorAnio(anio);
      const ipc=Number(fila?.inflacion??fila?.inflacionTotal3??0);
      const antes=saldo;
      let actualizacion=0;
      let disponible=true;
      if(ipc>0){
        actualizacion=roundMil(antes*(Math.pow(1+ipc/365,dias)-1));
        saldo=roundMil(antes+actualizacion);
      }else{
        disponible=false;
        advertencias.push(`No existe IPC cargado para ${anio}; no se actualizó ese tramo de la sanción.`);
      }
      tramos.push({anio,desde:inicioTramo,hasta:finTramo,dias,ipc,ipcPorcentaje:ipc*100,saldoInicial:antes,actualizacion,saldoFinal:saldo,disponible});
    }

    return {
      saldoInicial:roundMil(saldoInicial),
      valor:roundMil(saldo),
      actualizacion:roundMil(saldo-Math.max(0,Number(saldoInicial||0))),
      fechaBase:base,
      fechaActivacion:aniversario,
      tramos,
      advertencias
    };
  }
}
