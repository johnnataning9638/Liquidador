# Favorabilidad automática Ley 2010 — 16.33.267

Base: 7a1bf116454b2239d4163e3690e75bc06e5e5032 (16.33.266).

## Causa confirmada

El PDF abc recibido muestra capital 5.000.000, vencimiento 27/08/2019, pago 8.000.000 el 28/12/2019 y tipo TASA DIAN, con tasa 26,370%, intereses 444.000 y excedente 2.556.000. La reproducción del motor 266 coincide exactamente. La automatización Ley 2010 aún no estaba conectada: 265 incorporó los datos y 266 agregó exclusivamente el 50% manual del Decreto 688. El defecto no es solo de presentación.

## Corrección autorizada

Para pagos reales con TASA DIAN entre 27/12/2019 y 21/05/2020 se usa IBC certificado del mes + 200 puntos básicos, exclusivamente en los vencimientos anteriores al 27/12/2019. Se usa el vencimiento real de cada cuota, no el año gravable: el caso recibido tiene año 0 y concepto vacío. Se pasa ese contexto por las capas privada, base y oficial.

Cada cuota conserva su tasa: una obligación mixta no extiende la favorabilidad a cuotas no elegibles; el encabezado no presenta una tasa única falsa y el detalle identifica tasas por cuota. La selección manual de otros tratamientos tiene prioridad. Una fecha de corte sin pago no activa este beneficio.

Desde 22/05 hasta 30/11/2020 se conserva IBC general automático del Decreto 688 y se alinea la visualización TDJ, que antes podía mostrar TIM. La opción del 50% continúa siendo exclusivamente manual. Fuera de estos intervalos se conserva TIM y los tratamientos vigentes.

La tabla IBC y TIM originales, IPC, UVT, sanciones, proporcionalidad, prioridad de pagos, excedentes y Supabase permanecen sin modificación. Se conserva el cálculo histórico y el redondeo existente; solo se suministra la tasa correspondiente. Los datos almacenados no se sobrescriben.

## Evidencia

- Caso abc: 18,91% + 2 puntos porcentuales = 20,91%; 5.000.000 × 0,2091 × 123 / 365 = 352.319,18 aproximadamente; el redondeo existente produce 352.000 y excedente 2.648.000. Se conservan impuesto y pago.
- Seis meses contrastados con la tabla SFC interna; límites 26/12, 27/12, 21/05, 22/05, 30/11 y 01/12.
- Cuotas anteriores y posteriores al corte en la misma obligación; corte sin pago; tipo de tasa seleccionado sin sustitución.
- DIAN privada y oficial, pago TDJ y título TDJ: UI 20,910%, PDF con norma y 352.000, Excel y reimportación. El cambio de fecha al 22/05 muestra IBC 18,190%, sin seleccionar el 50%.
- Auditoría reversible contra 266 y baterías de regresión vigentes. Se actualizan referencias de caché para evitar cargar motores anteriores.

Fuentes: https://normograma.dian.gov.co/dian/compilacion/docs/ley_2010_2019.htm (artículo 120, parágrafo 2); https://normograma.dian.gov.co/dian/compilacion/docs/decreto_0688_2020.htm (artículo 1); certificado SFC archivado en tests/fixtures/sfc-interes-20261029.xlsx y tabla datos/interes-bancario-corriente.json.

La publicación exige PR fusionado, despliegue Render LIVE del commit y reproducción en producción. Reversión: revertir el commit mediante PR y desplegar la versión anterior, sin cambios de base de datos que revertir.
