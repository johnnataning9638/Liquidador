# Operación de parámetros 16.33.239

El frontend usa tasas_liquidador e ipc_liquidador de Supabase con respaldo local JSON. No llama directamente al actualizador ni a las fuentes institucionales.

El cron actualizar-parametros-dian-diario conserva 0 10 * * * (05:00 Colombia). pg_net encola la llamada y no certifica su éxito. El resultado real se revisa en parametros_actualizacion_log (acceso administrativo) y en net._http_response. El timeout de transporte es 90 segundos; cada fuente tiene tres intentos de 12 segundos como máximo y ambas se procesan independientemente.

TIM: SFC, consumo y ordinario, vigencia completa del mes colombiano actual. Se obtiene la TIM aplicando la misma regla existente de usura menos dos puntos. No se toma otra modalidad ni se adelanta una tasa futura.

IPC: cuadro oficial DANE de diciembre del año calendario anterior. Se identifica la columna de variación anual por año y se descarta la mensual. El factor entra a regir el 1 de enero siguiente. El lector no convierte el dato anual móvil de septiembre en cierre anual. Una publicación todavía ausente produce PENDIENTE_PUBLICACION y conserva los parámetros.

Un registro coincidente produce SIN_CAMBIO; una diferencia produce REVISION_MANUAL sin sobrescribir valores. Solo se insertan períodos nuevos verificados. dry_run=true consulta fuentes y registra diagnóstico, sin cambiar tasas ni IPC. Una fuente fallida no impide procesar la otra.

Despliegue: aplicar la migración de registro/índice/timeout, desplegar los dos archivos de supabase/functions/actualizar-parametros-dian con verify_jwt=true y comprobar dry-run antes de ejecutar la actualización real. La autenticación y horario del cron existente se conservan. No publicar credenciales ni contenido de cron.job en Git.

Publicación Render: build node scripts/preparar-sitio.mjs y directorio dist. El manifiesto enumera únicamente los recursos públicos. Tests, historial, funciones administrativas y migraciones se mantienen fuera del sitio.

Los módulos matemáticos se preservan contra el commit 627b181. La incidencia conocida de redistribución de sanción con cuatro a seis cuotas queda pendiente por decisión expresa; esta versión no la corrige ni modifica beneficios o liquidación oficial.
