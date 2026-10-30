# Tabla interna IBC verificada — 16.33.265

## Alcance

Se incorpora `datos/interes-bancario-corriente.json` con 25 registros mensuales de diciembre de 2019 a diciembre de 2021, modalidad consumo y ordinario. El archivo aportado se cotejó fila por fila con el certificado histórico de la Superintendencia Financiera de Colombia. Los dos archivos coinciden en tasa efectiva anual, fecha de certificación y vigencia: 25/25, cero diferencias. Se agregan resoluciones y trazabilidad oficial a los datos internos.

El IBC original se almacena sin dos puntos adicionales, descuentos ni reconstrucción desde la TIM. Los puntos básicos enteros evitan comparar aproximaciones binarias de porcentajes.

## Fuentes

- Página oficial SFC, enlace Histórico TIBC: https://www.superfinanciera.gov.co/publicaciones/10829/sala-de-prensacomunicados-de-prensa-interes-bancario-corriente-10829/
- Certificado descargado: https://www.superfinanciera.gov.co/loader.php?idFile=1069305&lFuncion=descargar&lServicio=Tools2&lTipo=descargas
- Copia exacta del certificado: `tests/fixtures/sfc-interes-20261029.xlsx`, hoja CERTIFICADO1, filas 368–402 (solo consumo y ordinario; se excluyen microcrédito y otras modalidades).
- SHA-256: `3d9756b0fcbaee6ead1a1e170be803d6973230fbfca29db6b15df59051d5170e`.
- Doctrina de referencia para artículo 45: https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_913636_2021.htm

El archivo XLSX oficial es una copia de evidencia, sin edición; sus nombres definidos heredados no se usan para calcular ni extraer tasas. La prueba usa los valores numéricos de las celdas del certificado.

## Relación con el comportamiento existente

No existía un JSON independiente de IBC: el motor contiene siete referencias IBC para el Decreto 688 y once tasas reducidas para artículo 45. Todas concilian con los datos certificados: siete valores IBC exactos y once resultados del 20% del IBC redondeado a dos decimales de porcentaje, conforme al comportamiento existente. Por ejemplo, febrero de 2021: IBC 17,54%; 20% = 3,508%, almacenado actualmente como 3,51%.

La implementación del artículo 45 ya existe en el motor compartido por DIAN y TDJ, con consulta por fecha de pago y factor de sanción 0,20. Esta incorporación no modifica su elegibilidad, vigencia, precisión, redondeo ni resultados; confirmar existencia no equivale a una auditoría jurídica integral de todos sus casos.

La nueva tabla queda incluida entre los recursos publicados y disponible para la siguiente integración. Los motores aún usan sus referencias existentes. No se activan en este cambio la regla automática Ley 2010/2019 ni la opción Decreto 688 al 50%; quedan fuera de esta solicitud de datos y verificación.

## Validación y reversión

`python3 tests/ibc-certificado-265.py` compara tabla contra certificado archivado y verifica cronología sin huecos, duplicados, porcentaje y puntos básicos, resoluciones, fechas y SHA-256. Verifica además igualdad exacta contra 16.33.264 de los tres motores y de TIM, beneficios, IPC y UVT; concilia las 18 referencias existentes. Las auditorías históricas neutralizan únicamente el incremento de identificación de versión.

No hay cambios en esquema, datos, funciones o tareas de Supabase. Reversión: revertir el commit mediante PR y desplegar la versión anterior; no hay cambios de base de datos que revertir. La publicación debe confirmarse con commit fusionado, despliegue Render LIVE y cotejo del JSON servido.
