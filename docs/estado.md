# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S07 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S06 · Servidor base, núcleo, design system UNEMI, usuarios y roles, contenidos (asignatura > unidad > tema), glosario, noticias, canciones, inicio, juegos (Ahorcado, Pareja, Sopa), gamificación, diplomas, paneles y alertas.
- P07.1 · Servicio de IA con Gemini (`ia.js`, `esquemas-ia.js`, `preparadores/generar-glosario.js`, `prompts/generar-glosario.txt`, `rutas/ia.js`). Clave solo en `.env`; límite diario por usuario; `consumo-ia.jsonl` sin textos.
- P07.2 · Botón "Generar con IA" en `editor-tema.html`: cantidad 5-20, tabla editable, repetidos desmarcados, aprobación con origen "ia".
- P07.3 · Crucigrama (`crucigrama.html/js/css`, `generarCrucigrama()`), 4+ palabras, pistas debajo de la cuadrícula; registrado en `catalogo-actividades.js`.
- Probado con Gemini real: `/api/ia/prueba`, generación de glosario y flujo completo en el navegador.

## Decisiones y cambios respecto a docs/contratos.md
- `ia.js` exporta además `probarConexion(usuario)`; `GET /api/ia/prueba` responde `{ respuesta }` (§B, §C actualizados).
- tutor y rol-simulacion devuelven `{ texto }`. `evaluar-rol` cuenta en `limiteTutorDiario`.
- Modelo en `.env`: `gemini-3.5-flash-lite` (estable y económico según la documentación al 2026-10-25).
- Proyecto bajo Git desde el sprint 7 (etiqueta `sprint-7`); `.env`, `datos/*.json` y respaldos no se versionan.

## Problemas conocidos
- Solo `generar-glosario` tiene preparador y plantilla; las demás tareas de IA (§C) se agregan en los sprints 8, 11 y 12.
- Datos semilla: el tema "Ventanas en Ecocardiografía" está en Biología con un glosario de genética.
- Los routers se montan en `/api` y también en la raíz (comportamiento heredado de `server.js`).
- La cuadrícula del crucigrama se desplaza de lado en pantallas angostas.

## Pendiente para el siguiente sprint
- Sprint 8: copiar `servidor/prompts/generar-preguntas.txt` (Anexo B.2) y seguir con P08.1 (banco de preguntas).
