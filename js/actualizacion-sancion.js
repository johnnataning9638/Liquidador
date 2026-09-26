import {fechaISO,roundMil,diasEntre} from "./utilidades.js?v=16.33.23";

/**
 * Actualización independiente de sanciones (Art. 867-1 E.T.)
 *
 * La sanción original nunca se reconstruye. Este módulo recibe el saldo
 * vigente, determina el período de actualización según la fecha base y
 * devuelve el nuevo saldo junto con la trazabilidad de cada tramo.
 *
 * REAJUSTE: reproduce la mecánica del módulo Act.Sancion(LP-LO) del Excel
 * DIAN: primer tramo desde la fecha inicial de cobro hasta el día anterior al
 * 1 de enero de aplicación; tramos posteriores de año calendario completo,
 * con capitalización diaria y redondeo de la tasa diaria a 7 decimales.
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
  calcular(saldoInicial,fechaBase,fechaCorte,{aniosExcluir=[]}={}){
    let saldo=Math.max(0,Number(saldoInicial||0));
    const base=fechaISO(fechaBase),corte=fechaISO(fechaCorte);
    const tramos=[];
    const advertencias=[];
    const original=saldo;
    const excluidos=new Set((Array.isArray(aniosExcluir)?aniosExcluir:[]).map(Number));

    if(!saldo||!base||!corte||corte<=base){
      return {saldoInicial:roundMil(original),valor:roundMil(saldo),actualizacion:0,fechaBase:base,fechaActivacion:null,fechaPrimeraActualizacion:null,fechaCorte:corte,tramos,advertencias};
    }

    /*
     * ART. 867-1 E.T. — LIQUIDACIÓN PRIVADA
     *
     * La sanción debe llevar más de un año de vencida. Una vez cumplido ese
     * año, la actualización no se hace en la fecha de aniversario ni se
     * prorratea por días. La primera actualización se practica el 1 de enero
     * del año siguiente al año en que se completó el año de vencimiento y,
     * desde allí, se actualiza anual y acumulativamente con el 100 % del IPC
     * del año inmediatamente anterior.
     *
     * Ejemplo: sanción presentada el 15/06/2023 -> cumple un año el
     * 15/06/2024 -> primera actualización 01/01/2025 con IPC 2024 completo.
     * Una segunda actualización, si continúa impaga, será el 01/01/2026 con
     * IPC 2025, aplicada sobre el saldo ya actualizado.
     *
     * El parámetro aniosExcluir contiene AÑOS DE APLICACIÓN (2025, 2026,...),
     * no años de inflación. Esto permite procesar varios pagos sin volver a
     * aplicar una misma actualización anual.
     */
    const activacion=this.sumarUnAnio(base); // fecha en que se completa el año
    const anioCumplimiento=Number(activacion.slice(0,4));
    const primerAnioActualizacion=anioCumplimiento+1;
    const anioCorte=Number(corte.slice(0,4));
    const fechaPrimeraActualizacion=`${primerAnioActualizacion}-01-01`;

    if(corte<fechaPrimeraActualizacion){
      return {
        saldoInicial:roundMil(original),
        valor:roundMil(saldo),
        actualizacion:0,
        fechaBase:base,
        fechaActivacion:activacion,
        fechaPrimeraActualizacion,
        fechaCorte:corte,
        tramos,
        advertencias
      };
    }

    // Cada año de aplicación cerrado corresponde al IPC del año anterior.
    for(let anioAplicacion=primerAnioActualizacion; anioAplicacion<=anioCorte; anioAplicacion++){
      if(excluidos.has(anioAplicacion)) continue;

      const fechaAplicacion=`${anioAplicacion}-01-01`;
      if(fechaAplicacion>corte) continue;

      const anioInflacion=anioAplicacion-1;
      const fila=this.ipcPorAnio(anioInflacion);
      const ipc=Number(fila?.inflacion??fila?.inflacionTotal3??0);
      const antes=saldo;
      let actualizacion=0;
      const disponible=ipc>0;

      // El módulo Act.Sancion(LP-LO) del Excel DIAN aplica la actualización
      // mediante capitalización diaria: K * ((1 + REDONDEO(i/365,7))^n - 1).
      // El primer tramo no es un año completo: va desde la fecha inicial de
      // cobro hasta el día anterior al 1 de enero en que se aplica el IPC.
      // Los tramos posteriores abarcan exactamente de 1 de enero a 1 de enero,
      // por lo que pueden tener 365 o 366 días.
      const diasPrimerTramo = Math.max(0, diasEntre(activacion, fechaAplicacion)-1);
      const fechaInicioTramo = anioAplicacion===primerAnioActualizacion
        ? activacion
        : `${anioAplicacion-1}-01-01`;
      const dias = anioAplicacion===primerAnioActualizacion
        ? diasPrimerTramo
        : diasEntre(fechaInicioTramo, fechaAplicacion);
      const fechaFinTramo = anioAplicacion===primerAnioActualizacion
        ? `${anioAplicacion}-01-01`
        : fechaAplicacion;

      if(disponible && dias>0){
        const tasaDiariaRedondeada=Math.round((ipc/365)*10000000)/10000000;
        actualizacion=roundMil(antes*(Math.pow(1+tasaDiariaRedondeada,dias)-1));
        saldo=roundMil(antes+actualizacion);
      }else if(!disponible){
        advertencias.push(`No existe IPC cargado para ${anioInflacion}; no se actualizó la sanción en ${anioAplicacion}.`);
      }

      tramos.push({
        anio:anioAplicacion,
        anioAplicacion,
        anioInflacion,
        desde:fechaInicioTramo,
        hasta:fechaFinTramo,
        dias,
        ipc,
        ipcPorcentaje:ipc*100,
        saldoInicial:antes,
        actualizacion,
        saldoFinal:saldo,
        disponible,
        aplicado:disponible && dias>0
      });
    }

    return {
      saldoInicial:roundMil(original),
      valor:roundMil(saldo),
      actualizacion:roundMil(saldo-original),
      fechaBase:base,
      fechaActivacion:activacion,
      fechaPrimeraActualizacion,
      fechaCorte:corte,
      tramos,
      advertencias
    };
  }
}
