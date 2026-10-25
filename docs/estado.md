# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S08 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S07 · Base, usuarios, contenidos, glosario, juegos (Ahorcado, Pareja, Sopa, Crucigrama), gamificación, paneles, alertas y servicio de IA con Gemini (ver etiqueta `sprint-7`).
- P08.1 · Banco de preguntas (`banco-preguntas.html`): 5 niveles de Bloom, tipos opción/vf/completar, creación manual y "Generar con IA" con aprobación (`ganchos/preguntas.js`, `preparadores/generar-preguntas.js`, `prompts/generar-preguntas.txt`). Aviso si hay menos de 20 aprobadas.
- P08.2 · Motor del quiz (`rutas/quiz.js`): estado por nivel, iniciar (sin respuestas), responder una sola vez, finalizar con 70 % de aprobación, puntos e insignias. Retoma el quiz abierto (menos de 2 h).
- P08.3 · Página del quiz (`quiz.html`): tarjetas de nivel, pregunta a pregunta, resultado, insignia y diploma por nivel (`pdf.js`). En `catalogo-actividades.js`.
- Probado con Gemini real (banco) y con una copia temporal de los datos (quiz, aprobado/reprobado y diploma).

## Decisiones y cambios respecto a docs/contratos.md
- `POST /api/intentos` rechaza `actividad: "quiz"` (403): el quiz solo se registra desde `/quiz/finalizar`.
- `server.js`: DELETE genérico llama al gancho opcional `antesDeEliminar` (lo usa `preguntas`).
- `quiz/iniciar` devuelve `respondidas`; `quiz/finalizar` devuelve `puntosTotales`; `quiz-sesiones` guarda porcentaje, aprobado, aciertos y fin (§B, §C, §D actualizados).

## Problemas conocidos
- El DELETE genérico no consulta ganchos en glosario, temas, unidades y otras: un docente de otra asignatura podría borrar sus registros. Pendiente de decidir.
- Solo hay 9 preguntas aprobadas en el nivel 1 del tema demo y ninguna en los niveles 2 a 5; con menos de 20 el quiz repite preguntas.
- `estudiante1@demo.ec` ya tiene los 5 niveles aprobados en los datos demo.
- Datos semilla: el tema "Ventanas en Ecocardiografía" (Biología) tiene un glosario de genética.
- Una sesión vencida guardada en el navegador impide abrir `ingreso.html` hasta borrar `localStorage`.

## Pendiente para el siguiente sprint
- Sprint 9: foros moderados y agenda con recordatorios (P09.1 a P09.3).
