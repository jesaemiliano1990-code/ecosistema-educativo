# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S11 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S10 · Base, usuarios, contenidos, juegos, gamificación, paneles, alertas, IA (Gemini), quiz con diplomas, foros, agenda, notificaciones, mensajería y moderación (etiqueta `sprint-10`).
- P11.1 · Tutor en el servidor: tarea `tutor` de `/api/ia` con prompt socrático (Anexo B.3), historial de 10 mensajes de hasta 1.000 caracteres, respuesta de máx. 700; límite diario `limiteTutorDiario`; cada consulta suma en `consultas-tutor` (solo conteos).
- P11.2 · `tutor.html`: chat con preguntas guía del tema (o 3 sugerencias), indicador "El tutor está pensando...", aviso amable al llegar al límite diario, "Nueva conversación"; botón "Pregunta al tutor" en el tema (solo estudiantes) y entrada en Actividades.
- P11.3 · Avatar guía (`js/nucleo/avatar.js`): búho en SVG abajo a la derecha con globo de instrucciones en los 5 juegos y el tutor; estados reposo, hablando, pensando y celebrando (3 s al ganar insignia); voz opcional (silenciada por defecto, prefiere es-EC); se puede ocultar y las preferencias se guardan en `localStorage`; respeta `prefers-reduced-motion`.
- P11.4 · Panel docente: tarjeta "Uso del tutor" (`GET /api/resumen/tutor/:grupoId`) con los 5 temas más consultados y mensajes por estudiante, sin textos de conversaciones.
- Probado en copias aisladas y con Gemini real (glosario, preguntas guía y tutor).

## Decisiones y cambios respecto a docs/contratos.md
- Las conversaciones del tutor no se guardan: el historial vive en la memoria de la página.
- `almacen.js` ignora el BOM al leer JSON.
- La tarjeta del tutor en el panel docente se probó con datos simulados (el proyecto aún no tiene consultas reales).

## Problemas conocidos
- Encabezado en celular (375 px): el título "Ecosistema Educativo" queda amontonado junto a los íconos (ya existía).
- Sin regla de dueño en noticias: cualquier docente puede editar o borrar cualquier noticia.
- Nivel 1 del tema demo con 9 preguntas y niveles 2 a 5 vacíos; `estudiante1@demo.ec` tiene los 5 niveles aprobados.
- Tema demo "Ventanas en Ecocardiografía" con glosario de genética.
- El sondeo de mensajes es por consulta periódica (no hay websockets).
- Una sesión vencida en `localStorage` impide abrir `ingreso.html` hasta borrarla.

## Pendiente para el siguiente sprint
- Sprint 12: simulador de roles (P12.1 a P12.4). Copiar los prompts B.4 a B.6 a `servidor/prompts/`.
