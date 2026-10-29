# Sanciones mínimas 2006–2026

Consulta oficial: 28/10/2026. Se corrigen ocho importes de `datos/uvt.json`; los valores de UVT, los otros trece importes y las reglas de liquidación permanecen iguales. Ambos módulos cargan ese archivo; Supabase almacena tasas e IPC, no esta tabla.

| Año | Antes | DIAN |
| --- | ---: | ---: |
| 2006 | 200.000 | 201.000 |
| 2011 | 252.000 | 251.000 |
| 2012 | 261.000 | 260.000 |
| 2013 | 269.000 | 268.000 |
| 2020 | 357.000 | 356.000 |
| 2021 | 364.000 | 363.000 |
| 2022 | 381.000 | 380.000 |
| 2023 | 425.000 | 424.000 |

Desde 2007, la referencia general es 10 UVT, aproximadas al millar más cercano (Estatuto Tributario, artículos 639 y 868). El valor 2006 proviene del Decreto 4715/2005; no se obtiene multiplicando por diez la UVT base de 2006. Se conserva la selección del año y las excepciones de cada beneficio existentes en el motor.

## Fuentes

- [DIAN, tabla histórica, página 1](https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf): importes 2006–2013.
- [Estatuto Tributario, arts. 639 y 868](https://normograma.dian.gov.co/dian/compilacion/docs/estatuto_tributario.htm): diez UVT y aproximación.
- [Concepto DIAN 1/2018, nota 1](https://normograma.dian.gov.co/dian/compilacion/docs/concepto_tributario_dian_0000001_2018.htm): UVT 2014–2017; se aplica la conversión anterior.
- [DIAN, comunicado 195/2017](https://www.dian.gov.co/Prensa/HistoricoNovedades/195%20DIAN%20Fija%20UVT%20para%202018.pdf): UVT y sanción mínima 2018.
- [DIAN, comunicado 245/2018](https://www.dian.gov.co/Prensa/ComunicadosPrensa/245_DIAN_fija_valor_de_la_UVT_para_2019.pdf): UVT 2019.
- [Resolución DIAN 84/2019](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0084_2019.htm): UVT 2020 y conversión.
- [Resolución DIAN 111/2020, texto en SISJUR Bogotá](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=103587): UVT 2021 y conversión.
- [Resolución DIAN 140/2021](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0140_2021.htm): UVT 2022 y conversión.
- [Resolución DIAN 1264/2022](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_1264_2022.htm): UVT 2023 y conversión.
- [Resolución DIAN 187/2023](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0187_2023.htm): UVT 2024 y conversión.
- [Resolución DIAN 193/2024](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0193_2024.htm): UVT 2025 y conversión.
- [DIAN, comunicado 040/2026](https://www.dian.gov.co/Prensa/Paginas/NG-Comunicado-de-Prensa-040-2026.aspx): sanción mínima 2026, $524.000.

## Verificación y reversión

`node tests/sanciones-minimas-261.mjs` compara los 21 registros con la referencia independiente, el piso de beneficios en motores privado y oficial, el límite del saldo existente y el campo de interfaz. `node tests/navegador-sanciones-minimas-261.mjs` comprueba los datos cargados y el comportamiento de ambos módulos en navegador. Las regresiones integrales existentes comprueban cálculo, PDF, Excel y reimportación.

Para revertir, generar una reversión del commit de esta entrega mediante PR, reconstruir el sitio y verificar el despliegue. No hay migraciones ni escrituras de base de datos que revertir.
