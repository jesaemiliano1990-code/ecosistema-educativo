# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S12 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S11 · Base, usuarios, contenidos, juegos, gamificación, paneles, alertas, IA (Gemini), quiz, foros, agenda, mensajería, tutor socrático y avatar guía (etiqueta `sprint-11`).
- P12.1 · Simulador por escenarios: `simulaciones.html` (lista por tema) y `simulador.html?id=` (escenas, consecuencias, informe y `registrarIntento`; `?vista=previa` no registra). Semilla con "Un día en el laboratorio de Mendel" (6 escenas, 2 finales). Primera simulación completada otorga "En la práctica".
- P12.2 · `editor-simulacion.html`: datos generales, escenas con imagen y 2 a 4 opciones, validación al publicar (destinos, alcanzables, final, sin ciclos, consecuencias) con enlaces a la escena, mapa indentado y vista previa. El servidor repite las mismas reglas.
- P12.3 · "Generar borrador con IA" (tarea `generar-escenario`, 5 a 10 escenas): carga el resultado como borrador sin guardar y lo valida.
- P12.4 · Modo rol: editor de personaje, rúbrica (3 a 5 criterios) y turnos (4 a 12); chat con el personaje (`rol-simulacion`) y evaluación por criterios (`evaluar-rol`); el servidor ajusta los puntos a la rúbrica real.
- Probado en copias aisladas y con Gemini real (borrador, personaje que no sale de su papel, evaluación).

## Decisiones y cambios respecto a docs/contratos.md
- Puntos de cada opción: enteros de −10 a 10 (el servidor rechaza otros valores). Rúbrica: 1 a 20 puntos por criterio.
- `rol-comun.js` (en `servidor/`) comparte la validación de los preparadores de rol.
- `rol-simulacion` devuelve `{ texto }` (máx. 700 caracteres); `evaluar-rol` devuelve `{ criterios[{criterio, puntos, maximo, comentario}], puntaje, maximo, comentarioGeneral }`.
- Las consultas de rol cuentan contra `limiteTutorDiario` (una práctica de 8 turnos gasta 9).

## Problemas conocidos
- El puntaje de una simulación lo declara el navegador (igual que los otros juegos): un estudiante podría falsearlo.
- La semilla de simulaciones no se ha corrido en el proyecto real (el tema demo `tem_000001` ya no es el de genética).
- Encabezado en celular (375 px) amontonado; noticias sin regla de dueño; nivel 1 del tema demo con 9 preguntas y niveles 2 a 5 vacíos.
- Sesión vencida en `localStorage` bloquea `ingreso.html` hasta borrarla; el sondeo de mensajes tiene hasta 4 s de retraso.

## Pendiente para el siguiente sprint
- Sprint 13: pruebas, auditoría de seguridad y accesibilidad, despliegue y manuales (P13.1 a P13.4).
