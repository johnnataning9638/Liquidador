# Resumen final TDJ 16.33.249

Prueba unitaria y auditoría exacta del alcance:

```sh
node tests/resumen-sin-titulos-249.mjs
node tests/limpieza-239.mjs
```

Prueba de navegador con Playwright disponible en el entorno:

```sh
node tests/navegador-resumen-249.mjs
```

Copiar localmente los cuatro escenarios XLSX de entrada a `tests/fixtures/resumen-sin-titulos-249/`, o indicar otra carpeta mediante `FIXTURE_DIR`. Los archivos originales y las evidencias quedan excluidos de Git. No se publican datos de entrada, PDF ni Excel derivados.

Variables opcionales: `PLAYWRIGHT_MODULE` (módulo instalado), `CHROME_CHANNEL` (navegador disponible), `ARTIFACT_DIR` (carpeta local de evidencias). La prueba intercepta todos los recursos, bloquea conexiones externas y deshabilita la conexión de Supabase; no utiliza producción. No cambia dependencias del proyecto ni los flujos CI.

Casos: cuatro escenarios Art. 9/10, pago parcial, sin pagos, con título y SIMPLE. Exige un solo resumen final, consolidación de pagos y coincidencia de saldo/sanción con pantalla. SIMPLE entra a TDJ después de exportar su respaldo desde DIAN. También genera PDF y una imagen del resumen para inspección local.

Para reproducir el defecto en la base 16.33.248, ejecutar únicamente los cuatro archivos originales con `EXPECT_MISSING=1`, utilizando el código de esa base. No usar esa variable sobre la versión corregida.

El criterio de saldo TDJ se conserva: impuesto y sanción pendientes; los intereses se muestran por separado en el soporte. No se modifican cálculos, beneficios, tasas, IPC, importación, Excel ni persistencia.
