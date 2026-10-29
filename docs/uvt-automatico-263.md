# UVT y sanción mínima automática

Versión 16.33.263. Fuente central: `public.uvt_liquidador`, un registro por año. La migración contiene 39 años, de 1988 a 2026: conserva exactamente los 21 valores 2006–2026 de la versión 262 y añade 18 años 1988–2005 de la tabla histórica DIAN. No se inventa UVT para esos 18 años.

## Referencias y cálculo

- [Tabla histórica DIAN](https://www.dian.gov.co/Prensa/HistoricoNovedades/Tabla_sancion_minima_2014.pdf): los 26 importes 1988–2013 se contrastaron con el PDF descargado. Su SHA-256 se conserva en la referencia de pruebas y en la tabla central.
- Las fuentes anuales 2014–2026 están enumeradas en `docs/sanciones-minimas-261.md`; se conservan sus UVT e importes verificados.
- Desde 2007: 10 UVT aproximadas al millar más cercano, ET arts. 639 y 868. Para 2006 se usa el importe publicado de $201.000 (Decreto 4715/2005), no diez veces la UVT base.
- [Fuente automática DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm): artículo 1.2.1 vigente de la Resolución Única. El lector exige artículo, valor en pesos, año de aplicación y enlace a la resolución definitiva que sustituye el artículo; conserva referencia y hash del documento al insertar el nuevo año. No acepta proyectos ni inventa valores de años aún no publicados.
- [Festivos nacionales: Ley 51/1983](https://apps.procuraduria.gov.co/normograma/compilacion/docs/ley_0051_1983.htm).

## Operación automática

Se conserva el cron `actualizar-parametros-dian-diario`, activo a las 10:00 UTC / 05:00 Colombia. TIM, IPC y UVT se procesan independientemente. Un fallo en una fuente queda registrado sin impedir las otras dos.

UVT se consulta en días hábiles de diciembre para precargar el año siguiente, durante los primeros diez días hábiles de enero para confirmarlo y, si falta el año actual, en días hábiles posteriores hasta obtenerlo. Se excluyen sábados, domingos y festivos nacionales, incluidos los móviles por Pascua. La fecha de Colombia se calcula explícitamente.

La fila precargada conserva `aplicable_desde=1 de enero`; el permiso público y el cliente no la aplican antes de esa fecha. Al llegar el año nuevo se obtiene de Supabase sin otro despliegue. Una coincidencia no escribe nada; una discrepancia marca `REVISION_MANUAL` y no sobrescribe la historia. Un documento que todavía corresponda al año anterior produce `PENDIENTE_PUBLICACION`.

El registro de ejecución incluye resultado UVT junto con TIM e IPC, en `parametros_actualizacion_log`. Una llamada HTTP encolada no demuestra éxito: hay que comprobar su respuesta en `net._http_response` y el registro final. El modo `dry_run` no inserta parámetros. `force_uvt` permite comprobar la fuente fuera de ventana; sólo el programador autorizado puede usarlo.

## Consumo y protección

DIAN y TDJ usan `js/uvt-parametros.js`: histórico JSON local, parámetros centrales vigentes y caché de la última lectura validada. Se validan año, redondeo, vigencia, duplicados y discrepancias con la historia local. Ante caída de red se conserva un valor conocido del mismo año; nunca se toma otro año como sustituto. Si falta el mínimo necesario para reducir una sanción, se bloquea esa liquidación con un mensaje específico. Los motores tributarios originales no cambian.

La tabla permite lectura pública vigente e inserción del servidor, sin permiso UPDATE para el actualizador. El control de autenticación es privado, con RLS y sin lectura pública. La función mantiene `verify_jwt=true` y además exige un token interno que el cron toma de Vault; no se incorpora ningún secreto a JavaScript público, Git ni los registros.

## Pruebas

- `tests/uvt-automatico-263.mjs`: 39 registros, PDF, redondeo, año objetivo, festivos, primera ventana hábil, reintentos, duplicados, discrepancias, dry-run y aislamiento de fuentes.
- `tests/uvt-cliente-263.mjs`: nueva UVT central, activación el 1 de enero, vigencias, errores y bloqueo de un mínimo faltante; autenticación interna.
- `tests/navegador-uvt-263.mjs`: 78 controles de interfaz, 39 por módulo.
- `tests/navegador-futura-263.mjs`: año 2027 con valor ficticio sólo en el navegador de pruebas, sin desplegar otra versión ni escribirlo en producción; recuperación desde caché ante una caída simulada.
- Regresiones históricas de motores, PDF, XLSX y reimportación. La integración en los dos consumidores es reversible mediante la referencia `cambios-uvt-263.json`, para preservar las auditorías anteriores.

## Límites y recuperación

La ejecución es automática mientras la DIAN mantenga una publicación reconocible y las reglas legales usadas sigan vigentes. Si cambia el formato o hay contradicciones, falla de forma visible en el registro y conserva los parámetros: no interpreta libremente textos ni sustituye la fuente por páginas de terceros.

Ante reversión del frontend, las tablas y la función siguen siendo compatibles con versiones que aún leen JSON. No se deben borrar los 39 registros. Si se revierte la función a la versión 239, el encabezado adicional del cron es compatible y su horario se conserva; la autenticación interna dejaría de aplicarse y debe revisarse antes de mantener esa reversión.
