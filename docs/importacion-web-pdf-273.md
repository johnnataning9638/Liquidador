# Importación web y PDF — 16.33.273

DIAN y TDJ tienen un botón azul claro «Importar web - PDF» en cada una de sus tres pestañas. Reutiliza los recuadros existentes; en Resultados DIAN se comparte el recuadro de obligación, conservando el mismo elemento y sus eventos.

## Uso

Arrastre o pegue un PDF del Generador de Cuotas DIAN (1116) en «Pegue aquí». El archivo queda pendiente hasta pulsar el botón nuevo. Se lee localmente, sin enviarlo a servidores ni guardarlo en el navegador. Al completar la importación se libera la referencia al archivo y se limpia el recuadro. El PDF original de Descargas permanece intacto. «Quitar PDF» lo retira manualmente. El botón «Importar» habitual, si hay PDF pendiente, solo lo retira; el texto conserva su importador anterior.

Sin PDF pendiente, el botón consulta la obligación abierta mediante el complemento descargable desde la misma pantalla. Descomprima el ZIP, abra Extensiones en Chrome/Edge, active Modo de desarrollador y elija Cargar descomprimida. En equipos administrados, TI debe autorizar su instalación. Recargue el liquidador tras instalarlo.

El navegador impide a una página leer libremente otra pestaña de distinto dominio. El complemento implementa esa conexión con permiso de scripting y acceso a muisca.dian.gov.co. Aunque el lector restringe su ejecución a la ruta de consulta, Chrome concede los permisos de host por origen. No solicita cookies, almacenamiento, descargas ni acceso general a las demás páginas. Solo admite pedidos desde las dos páginas oficiales del liquidador y un clic real en el botón. No consulta periódicamente ni hace solicitudes al servidor DIAN.

## Distribución y precedencia

- NIT, nombre, impuesto, año y período se dirigen a los datos de obligación, desde cualquier pestaña.
- Las cuotas del PDF reemplazan las cuotas destino. Sus fechas prevalecen incluso si luego se importa la web.
- Se importa la fecha de vencimiento de la fila SANCIÓN, su importe y su descripción como procedencia. El generador no identifica por sí solo la clasificación jurídica de la sanción ni liquidación privada/oficial; el usuario revisa esos campos.
- Solo sanción no crea capital ni cuota artificial. Ausencia de sanción en PDF no borra una sanción existente.
- La web aporta los recibos de Documentos Fuente: número, fecha y valor pagado. No se descargan soportes ni se confunden declaraciones con pagos. Los recibos se envían a Pagos, nunca a Títulos.
- Repetir un recibo con la misma fecha y valor lo omite; si difieren, se rechaza la importación para revisión.
- NIT, impuesto, año, período y número interno de obligación evitan mezclar fuentes. En TDJ se usa el destino elegido en Datos/Pagos, una coincidencia única o la única obligación disponible. Si hay ambigüedad, se solicita seleccionar el destino existente.

## Alcance y límites

No se calcula automáticamente, no se seleccionan beneficios ni se cambian motores, fórmulas, tasas, exportadores, importadores de texto/Excel o Supabase. Dos adaptadores añadidos al final de app.js y tdj-core vinculan el módulo independiente con sus campos y estado. Las pruebas de reversión verifican exactamente las adiciones autorizadas contra la versión 272.

PDF textual 1116: hasta 20 MB, 100 páginas y 200 cuotas. PDFs escaneados, cifrados, créditos, documentos generadores múltiples o varias filas de sanción con representación ambigua se rechazan con un mensaje; no se inventan importes ni fechas. Una lectura fallida no aplica datos y permite retirar o sustituir el archivo.

Debe haber una sola consulta DIAN abierta con Documentos Fuente visible. Se leen las filas presentes en el DOM. Si se detecta un botón Siguiente habilitado, se rechaza la lista parcial y se pide mostrar todos los documentos. No se navega automáticamente por páginas ni se inicia sesión. Cambios futuros de rótulos/columnas de DIAN pueden requerir adaptar el lector.

PDF.js 6.5.438 se incluye localmente, con licencia Apache-2.0 y hashes de procedencia. No se incluyen los PDF privados ni sus datos en el repositorio. Las pruebas públicas utilizan documentos y tablas sintéticos.

Reversión: retirar el PR o revertir su commit de fusión. Sin migraciones ni cambios de base de datos.
