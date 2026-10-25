# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S13 · Fecha: 2026-10-25 · Velocidad real: __ puntos · Versión 1.0 (Hito 5)

## Funciona
- S00-S12 · Base, usuarios, contenidos, juegos, gamificación, paneles, alertas, IA (Gemini), quiz, foros, agenda, mensajería, tutor, avatar y simulador (etiqueta `sprint-12`).
- P13.1 · `docs/guiones-prueba.md`: 55 casos (estudiante, docente, admin, transversales y 10 de seguridad) y primera ejecución de los de prioridad Alta automatizables.
- P13.2 · Auditoría (`docs/auditoria-p13-2.md`): corregidos DEF-01 (claves por defecto), DEF-02 (subidas sin sesión), DEF-03 (puntos de «tema revisado») y 16 hallazgos más (lectura por id, robo de recursos entre docentes, progreso ajeno, simulaciones inventadas, enlaces `javascript:`, cabeceras, accesibilidad del menú). 96 comprobaciones de regresión y 47 de correcciones en verde.
- P13.3 · Despliegue (`docs/despliegue.md`, `ecosystem.config.cjs`, `scripts/respaldar.sh`): Ubuntu, Node LTS, PM2 (una sola instancia), Nginx, HTTPS, ufw y respaldo diario con cron.
- P13.4 · Manuales de estudiante, docente y administrador (`docs/manual-*.md`).

## Decisiones y cambios respecto a docs/contratos.md
- `GET /api/<col>/<id>` aplica el mismo filtro que la lista (gancho `puedeVer` o, si no existe, `filtrarLista`).
- Las alertas las crea solo el servidor; las noticias solo las edita su autor o un admin; la colección `prueba` es solo de admin.
- La foto de perfil solo admite una ruta de la plataforma o `https`.
- En producción no se corre `npm run semilla` (crea usuarios demo): se copia solo `insignias.json` y se usa `npm run crear-admin`.

## Problemas conocidos
- El puntaje de juegos y simulaciones lo declara el navegador (solo el quiz y la evaluación de rol los calcula el servidor); hay límites por hora y por día.
- Sin `Content-Security-Policy` activa: la guía de despliegue la propone primero en modo «solo informar».
- Despliegue y manuales no probados en un servidor real ni con una persona ajena al proyecto; los guiones de prioridad Media y Baja, la prueba en celular real y la de IA no disponible siguen pendientes.
- Encabezado en celular (375 px) amontonado; nivel 1 del tema demo con 9 preguntas y niveles 2 a 5 vacíos; la semilla de simulaciones no se corrió en el proyecto real.
- Falta el correo de contacto en `privacidad.html`; sesión vencida en `localStorage` bloquea `ingreso.html` hasta borrarla.

## Pendiente para el siguiente sprint
- Aceptación con el Product Owner: ejecutar todos los guiones, desplegar en un servidor de prueba y validar los manuales con una persona nueva.
