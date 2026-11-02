# Importación PDF — 16.33.274

DIAN y TDJ tienen un botón azul claro «Importar PDF» en sus tres pestañas. Funciona en un navegador moderno sin complementos ni instalaciones adicionales.

1. Arrastre o pegue el archivo PDF del Generador de Cuotas DIAN (1116) en el recuadro «Pegue aquí» existente.
2. Pulse «Importar PDF». El sistema distribuye identificación, concepto, año, período, cuotas y sanción en sus campos, desde cualquiera de las pestañas.
3. Revise los datos y pulse Calcular cuando corresponda.

Sin archivo adjunto, el botón pide un PDF y conserva los datos. Los PDF se leen en el equipo, sin subirlos ni guardarlos. Al completar la importación se limpia el recuadro y se libera el adjunto. «Quitar PDF» lo retira manualmente. El archivo original de Descargas se conserva.

«Importar» habitual mantiene su función de texto. Si hay un PDF pendiente, únicamente lo retira sin importarlo. Los pagos se capturan mediante sus importadores habituales; el Generador de Cuotas aporta impuesto y sanción, no recibos de pago. El PDF conserva los pagos que ya estén registrados.

Las cuotas reconocidas reemplazan las del destino. Se usa la fecha de vencimiento de la fila SANCIÓN y su importe. Un documento con solo sanción no crea capital ni cuotas artificiales. La ausencia de sanción no borra una sanción ya capturada. La clasificación jurídica de la sanción y el tipo de liquidación requieren revisión del usuario cuando el documento no los identifica.

Se valida NIT, concepto, año, período y número interno de obligación. TDJ utiliza el destino elegido en Datos/Pagos, una coincidencia única o la única obligación disponible. Desde Títulos se conserva el destino elegido; selecciones contradictorias se rechazan sin modificar datos.

Se admiten PDF textuales 1116 de hasta 20 MB, 100 páginas y 200 cuotas. Documentos escaneados, protegidos, con créditos o filas ambiguas requieren revisión. Una lectura fallida conserva los datos y permite retirar o sustituir el archivo.

La versión 274 retira la conexión a la web DIAN, el complemento, su descarga y sus mensajes. Se conserva el lector PDF de la versión 273 y sus adaptadores. Motores, fórmulas, tasas, beneficios, importadores de texto/Excel, exportadores y Supabase permanecen intactos.
