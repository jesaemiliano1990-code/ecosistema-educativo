# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S09 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S08 · Base, usuarios, contenidos, glosario, juegos, gamificación, paneles, alertas, servicio de IA (Gemini), banco de preguntas y quiz por niveles con diplomas (etiqueta `sprint-8`).
- P06.4 (pendiente del S06, completada) · Centro de notificaciones: campana con contador y panel (`notificaciones.js`), sondeo de 60 s, rutas `rutas/notificaciones.js`, aviso al publicar noticias. Antes no existía.
- P09.1 · Foros (`foros.html`, `hilo.html`, `admin-reportes.html`): hilos y respuestas por asignatura, moderación, reportes, notificación al autor, 2 puntos por respuesta (máx. 5 al día).
- P09.2 · Agenda (`agenda.html`): FullCalendar 6.1.22 (mes, semana, lista), eventos personales y de grupo, ✓ en fechas límite completadas, "Mi semana".
- P09.3 · Recordatorios (`rutas/agenda.js`) con aviso del navegador opcional, y regla de alertas `vencidas` en `alertas.js`.
- Probado en copias temporales de los datos y en el navegador (escritorio y celular); aviso real en 93 s con un evento a 61 min.

## Decisiones y cambios respecto a docs/contratos.md
- Ganchos nuevos y opcionales en `server.js`: `puedeVer` (lectura por id), `despuesDeEliminar`. `antesDeEliminar` protege el DELETE en 11 colecciones.
- `notificaciones` solo se escribe desde el servidor; los docentes escriben a sus estudiantes con `POST /api/notificaciones`.
- Los intentos de `foro` no cuentan en promedios ni alertas y no reciben el bono de "sin errores" (`sinBono`).
- Un aviso de agenda por evento (el más cercano); reportes con campo `coleccion`; alertas `vencidas` con `eventoId` (§D, §C, §E actualizados).

## Problemas conocidos
- Encabezado en celular (375 px): el título "Ecosistema Educativo" queda amontonado junto a los íconos; la campana ya no empuja "Salir".
- Sin regla de dueño en noticias: cualquier docente puede editar o borrar cualquier noticia.
- Nivel 1 del tema demo con 9 preguntas y niveles 2 a 5 vacíos; `estudiante1@demo.ec` tiene los 5 niveles aprobados.
- Datos semilla: el tema "Ventanas en Ecocardiografía" (Biología) tiene un glosario de genética.
- Una sesión vencida en `localStorage` impide abrir `ingreso.html` hasta borrarla.

## Pendiente para el siguiente sprint
- Sprint 10: mensajería instantánea (P10.1 a P10.3). Los reportes de mensajes reutilizarán `reportes` (hoy solo `tipo: "foro"`).
