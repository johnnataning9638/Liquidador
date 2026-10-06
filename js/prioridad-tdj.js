// PRIORIDAD DE PAGOS NORMALES FRENTE A TDJ — v16.33.112
// Esta capa NO modifica formulas de impuesto, intereses ni sancion.
// Solo ajusta el valor imputable de un TDJ anterior a pagos normales posteriores.

function esTDJ(p){
  return Boolean(String(p?.tdj||"").trim()) || p?.esTDJ===true;
}
function clavePago(p,i){return String(p?.id||("P-"+i));}
function excedentePagoNormal(resultado,id,fecha,valor){
  const d=(resultado?.detalle||[]).find(x=>x?.pago?.id===id)
    ||(resultado?.detalle||[]).find(x=>!esTDJ(x?.pago)&&String(x?.pago?.fecha||"")===String(fecha||"")&&Math.abs(Number(x?.pago?.valor||0)-Number(valor||0))<0.5);
  return Math.max(0,Number(d?.excedente||d?.aplicado?.excedente||0));
}

export function ajustarTDJParaPagosPosteriores(motor,datos,opciones={}){
  if(!motor||typeof motor.calcular!=="function")return datos;
  const originales=[...(datos?.pagos||[])].map((p,i)=>({...p,__ordenOriginal:i}));
  const tdjs=originales.filter(esTDJ).filter(p=>p.fecha&&Number(p.valor)>0);
  const normales=originales.filter(p=>!esTDJ(p)&&p.fecha&&Number(p.valor)>0);
  if(!tdjs.length||!normales.length)return datos;
  const ajustados=originales.map(p=>({...p}));
  const hayPosterior=t=>normales.some(p=>String(p.fecha)>String(t.fecha));
  if(!tdjs.some(hayPosterior))return datos;
  const simular=()=>{
    // La simulación de prioridad DEBE respetar las fechas reales.
    // Antes, el arreglo conservaba el TDJ después de un pago posterior y el
    // motor procesaba primero ese pago, haciendo parecer que no existía
    // excedente y evitando reducir el TDJ. Aquí el orden cronológico es
    // obligatorio: PAGO -> TDJ -> PAGO, según las fechas efectivas.
    const pagos=ordenarMovimientosCronologicos(
      ajustados.map((p,i)=>({...p,__ordenOriginal:Number(p.__ordenOriginal??i)}))
    );
    const maxFecha=pagos.map(p=>p.fecha).filter(Boolean).sort().at(-1)||datos.fechaCorte||"";
    return motor.calcular({...datos,pagos,fechaCorte:maxFecha});
  };
  const todosNormalesAplicados=r=>normales.every((p,i)=>excedentePagoNormal(r,clavePago(p,i),p.fecha,p.valor)<=0.5);

  for(let pasada=0;pasada<Math.max(4,tdjs.length*3);pasada++){
    let r;
    try{r=simular();}catch{return datos;}
    if(todosNormalesAplicados(r))break;
    let normalProblema=null;
    for(let i=0;i<normales.length;i++){
      const p=normales[i];
      if(excedentePagoNormal(r,clavePago(p,i),p.fecha,p.valor)>0.5){normalProblema=p;break;}
    }
    if(!normalProblema)break;
    const candidatos=ajustados.filter(p=>esTDJ(p)&&p.fecha&&String(p.fecha)<=String(normalProblema.fecha)&&Number(p.valor)>0 && (!opciones.soloTDJId || String(p.id)===String(opciones.soloTDJId)))
      .sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||Number(b.__ordenOriginal||0)-Number(a.__ordenOriginal||0));
    const t=candidatos[0];
    if(!t)break;
    const nominal=Math.max(0,Math.trunc(Number(t.__valorNominal??t.valor??0)));
    if(t.__valorNominal==null)t.__valorNominal=nominal;
    let hi=Math.max(0,Math.trunc(Number(t.valor||0)));
    let lo=0,mejor=0;
    const esFactible=v=>{
      const anterior=t.valor;
      t.valor=Math.max(0,Math.trunc(v));
      let rr=null;
      try{rr=simular();}catch{t.valor=anterior;return false;}
      const ok=todosNormalesAplicados(rr);
      t.valor=anterior;
      return ok;
    };
    if(esFactible(hi)){
      mejor=hi;
    }else if(!esFactible(0)){
      continue;
    }else{
      for(let k=0;k<32;k++){
        if(lo>hi)break;
        const mid=Math.floor((lo+hi)/2);
        if(esFactible(mid)){mejor=mid;lo=mid+1;}else hi=mid-1;
      }
    }
    t.valor=mejor;
    if(mejor===0)t.valor=0;
  }
  const pagosFinales=ajustados.map(p=>{
    const q={...p};
    delete q.__ordenOriginal;
    delete q.__valorNominal;
    return q;
  });
  return {...datos,pagos:pagosFinales};
}

export function ordenarMovimientosCronologicos(pagos=[]){
  return [...pagos].sort((a,b)=>String(a?.fecha||"9999-12-31").localeCompare(String(b?.fecha||"9999-12-31"))
    ||Number(a?.__ordenOriginal||a?.numero||0)-Number(b?.__ordenOriginal||b?.numero||0));
}