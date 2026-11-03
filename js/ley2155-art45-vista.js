// Fuente visual de la tabla de Art. 45 que ya está parametrizada en el motor.
// Febrero–diciembre de 2021, tasa final al 20% del IBC; valores en porcentaje EA.
const TASAS_REDUCIDAS_2021=Object.freeze([3.51,3.48,3.46,3.44,3.44,3.44,3.45,3.44,3.42,3.45,3.49]);
export function tasaArt45Reducida2021(fecha){
 const f=String(fecha||"").slice(0,10);
 if(!/^2021-\d{2}-\d{2}$/.test(f))return null;
 const mes=Number(f.slice(5,7));
 return mes>=2&&mes<=12?TASAS_REDUCIDAS_2021[mes-2]/100:null;
}
