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

  /**
   * IPC utilizado por el módulo Act.Sancion(LP-LO) del Excel de referencia.
   *
   * El Excel identifica cada fila por el año de inflación de la columna C
   * (2003...2025) y toma directamente el valor de esa fila. Por ello, para
   * reproducir el comportamiento operativo del módulo, aquí se prioriza
   * anioInflacion/anio y no aplicableDesde.
   */
  ipcPorAnio(anio){
    const objetivo=Number(anio);
    const directo=this.ipc.filter(x=>Number(x.anioInflacion??x.anio)===objetivo);
    if(directo.length)return directo[directo.length-1];

    // Compatibilidad si solo existe aplicableDesde.
    const candidatos=this.ipc.filter(x=>{
      const desde=fechaISO(x.aplicableDesde??x.aplicable_desde);
      return desde===`${objetivo+1}-01-01`;
    });
    return candidatos.length?candidatos[candidatos.length-1]:null;
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
   * Reproduce la mecánica de actualización observada en Act.Sancion(LP-LO)
   * del Liquidadiario V 2026.14.
   *
   * Importante: el Excel no actualiza una fracción de año durante el primer
   * tramo. La fracción se conserva en cero mientras el corte permanece en el
   * año inmediatamente posterior a la fecha de activación; la actualización
   * entra cuando el corte alcanza el siguiente tramo anual y este contiene
   * 365 días o más. Una vez aplicada, se conserva sobre el saldo vigente.
   */
  calcular(saldoInicial,fechaBase,fechaCorte){
    let saldo=Math.max(0,Number(saldoInicial||0));
    const base=fechaISO(fechaBase),corte=fechaISO(fechaCorte);
    const tramos=[];
    const advertencias=[];
    const original=saldo;

    if(!saldo||!base||!corte||corte<=base){
      return {saldoInicial:roundMil(original),valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaActivacion:null,fechaCorte:corte,tramos,advertencias};
    }

    // El módulo Act.Sancion(LP-LO) no prorratea el año corriente. La
    // actualización entra por vigencias anuales completas: para una sanción
    // cuya fecha de activación es 01/01/2025, un corte en cualquier fecha de
    // 2025 conserva la sanción original; desde 2026 se aplica el IPC 2024
    // correspondiente a la vigencia 2025 completa. Para cada año adicional
    // se incorpora la vigencia anual inmediatamente anterior.
    const activacion=this.sumarUnAnio(base);
    const anioActivacion=Number(activacion.slice(0,4));
    const anioCorte=Number(corte.slice(0,4));

    if(corte<activacion){
      return {saldoInicial:roundMil(original),valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaActivacion:activacion,fechaCorte:corte,tramos,advertencias};
    }

    // Solo se liquidan vigencias anuales ya cerradas antes del año del corte.
    for(let anio=anioActivacion; anio<anioCorte; anio++){
      const inicio=anio===anioActivacion?activacion:`${anio}-01-01`;
      const siguiente=`${anio+1}-01-01`;
      const dias=diasEntre(inicio,siguiente)-1;
      if(dias<=0)continue;

      const fila=this.ipcPorAnio(anio);
      const ipc=Number(fila?.inflacion??fila?.inflacionTotal3??0);
      const antes=saldo;
      let actualizacion=0;
      const disponible=ipc>0;

      if(disponible){
        actualizacion=roundMil(antes*(Math.pow(1+Math.round((ipc/365)*1e7)/1e7,dias)-1));
        saldo=roundMil(antes+actualizacion);
      }else{
        advertencias.push(`No existe IPC cargado para ${anio}; no se actualizó ese tramo de la sanción.`);
      }

      tramos.push({
        anio,
        desde:inicio,
        hasta:`${anio+1}-01-01`,
        dias,
        ipc,
        ipcPorcentaje:ipc*100,
        saldoInicial:antes,
        actualizacion,
        saldoFinal:saldo,
        disponible,
        aplicado:disponible
      });
    }

    return {
      saldoInicial:roundMil(original),
      valor:roundMil(saldo),
      actualizacion:roundMil(saldo-original),
      fechaBase:base,
      fechaActivacion:activacion,
      fechaCorte:corte,
      tramos,
      advertencias
    };
  }
}
