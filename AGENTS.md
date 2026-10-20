# AGENTS.md — Política del repositorio

## Identidad
Un único sistema con dos módulos exclusivamente: **Liquidador DIAN** y **Liquidador TDJ**. No introducir otros módulos sin autorización.

## Comunicación
Español latinoamericano, concreto y claro. Explicar qué pasó, por qué, solución y evidencia.

## «Procede»
Seguir `.agents/skills/desarrollo-profesional-ia/SKILL.md` dentro del alcance expresamente autorizado.

## Reglas obligatorias
1. Inspeccionar código real, historial y dependencias; reproducir fallos antes de editar.
2. Correcciones mínimas y aisladas. Preservar toda función que ya opera.
3. No modificar cálculos, tasas, beneficios, UI, importadores, exportaciones o persistencia ajenos al alcance.
4. Crear y ejecutar pruebas pertinentes: unitarias, matemáticas, integración, regresión, seguridad, PDF y Excel cuando corresponda.
5. Corregir fallos dentro del alcance y repetir pruebas hasta validar o declarar bloqueo.
6. Incrementar y sincronizar versión y CHANGELOG en cada cambio de código aprobado; no alterar dependencias por rutina.
7. Verificar GitHub, Render y Supabase según impacto; no modificar Supabase si no es necesario.
8. Usar rama y pull request; proteger producción. Operaciones destructivas requieren autorización específica.
9. No afirmar que pruebas, despliegues o sincronizaciones fueron exitosos sin evidencia verificable.
10. Informe final: versión, archivos, pruebas, auditoría, GitHub, Render, Supabase y pendientes.

## Reglas de dominio
- La tasa o beneficio es por obligación; nunca sustituir silenciosamente un beneficio por tasa DIAN.
- Cada título conserva su trazabilidad, incluso con fechas iguales; evitar doble aplicación de excedentes.
- Validar matemáticamente con casos esperados independientes.
- UI, PDF y Excel deben ser consistentes.

## Skills
Consultar primero `.agents/skills/desarrollo-profesional-ia/SKILL.md` y luego las subskills pertinentes.
