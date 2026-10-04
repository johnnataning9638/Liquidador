import {extraerRegistrosTDJTexto,esDocumentoFuenteTDJ} from "../js/tdj-importador.js";
const datos=`No. Documento Fuente\tRepetición\tNombre Formato\tFecha Presentacion\tEstado\tClase Documento\tValor Pagado\n4911089297230\t1\tRecibo Oficial\t5/03/2026\tINICIAL\t\t4.137.000\n4911095388931\t1\tRecibo Oficial\t18/03/2026\tINICIAL\t\t3.579.000\n4911096796139\t1\tRecibo Oficial\t21/03/2026\tINICIAL\t\t2.093.000\n4911097894062\t1\tRecibo Oficial\t26/03/2026\tINICIAL\t\t1.482.000\n4911098513361\t1\tRecibo Oficial\t30/03/2026\tINICIAL\t\t3.047.000\n4911098761609\t1\tRecibo Oficial\t31/03/2026\tINICIAL\t\t10.924.000\n3004724916099\t1\tIVA\t3/04/2026\tVALIDA/ACTIVA\t\t\n4911099029075\t1\tRecibo Oficial\t4/04/2026\tINICIAL\t\t2.294.000`;
const r=extraerRegistrosTDJTexto(datos);
if(r.length!==7)throw new Error(`Se esperaban 7 registros con valor, llegaron ${r.length}`);
if(r.some(x=>x.tdj.length<10||x.tdj.length>15||x.tdj==='1'))throw new Error('Documento fuente inválido');
if(r[0].tdj!=="4911089297230"||r[0].fecha!=="2026-03-05"||r[0].valor!==4137000)throw new Error('Primer registro incorrecto');
if(esDocumentoFuenteTDJ('1')||esDocumentoFuenteTDJ('1234567890123456')||!esDocumentoFuenteTDJ('4911089297230'))throw new Error('Regla 10-15 incorrecta');
console.log('PASS TDJ: documento fuente 10-15 dígitos; repetición=1 excluida; sin duplicados.');

const sinEncabezado=`4911089297230\t1\tRecibo Oficial\t5/03/2026\tINICIAL\t\t4.137.000`;
const raw=extraerRegistrosTDJTexto(sinEncabezado);
if(raw.length!==1||raw[0].tdj!=="4911089297230"||raw[0].valor!==4137000)throw new Error("Formato sin encabezado incorrecto");
const tdjPequeno=`4911089297230\t1\tTDJ\t5/03/2026\t\t\t157`;
const small=extraerRegistrosTDJTexto(tdjPequeno);
if(small.length!==1||small[0].valor!==157)throw new Error("No se preservó valor TDJ pequeño");
if(esDocumentoFuenteTDJ("123456789")||!esDocumentoFuenteTDJ("1234567890")||!esDocumentoFuenteTDJ("123456789012345")||esDocumentoFuenteTDJ("1234567890123456"))throw new Error("Límites 10-15 incorrectos");
console.log("PASS TDJ extended: con/sin encabezado, repetición excluida y valor pequeño preservado.");
