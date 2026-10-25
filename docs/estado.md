# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S10 · Fecha: 2026-10-25 · Velocidad real: __ puntos

## Funciona
- S00-S09 · Base, usuarios, contenidos, juegos, gamificación, paneles, alertas, IA (Gemini), quiz con diplomas, foros, agenda, notificaciones y recordatorios (etiqueta `sprint-9`).
- P10.1 · Mensajería en el servidor (`rutas/mensajes.js`): contactos por rol y grupo, conversaciones únicas por pareja, mensajes de hasta 2.000 caracteres (50 por página, `desde=`/`antes=`), no leídos, difusión del docente, bloqueo y moderación. Máximo 30 mensajes por minuto.
- P10.2 · Pantalla de mensajes (`mensajes.html`): lista con buscador, chat con burbujas y días, sondeo cada 4 s (chat) y 15 s (lista), contador junto a "Mensajes" en el menú, una columna en celular.
- P10.3 · "Mensaje al curso", Bloquear/Desbloquear y Reportar en la pantalla; `admin-reportes.html` muestra el contexto de los mensajes reportados con Ocultar mensaje, Desactivar usuario y Descartar.
- Probado en copias aisladas con dos "ventanas": un mensaje llega a los 4,2 s; un mensaje oculto desaparece del chat abierto en unos 14 s.

## Decisiones y cambios respecto a docs/contratos.md
- Se puede escribir si no hay bloqueo, la otra persona está activa y alguna de las dos la tiene como contacto: un estudiante responde al admin pero no le inicia conversación.
- No se puede bloquear a un administrador. El bloqueado solo ve "no puedes enviar", sin saber por qué.
- `reportes` admite `tipo: "mensaje"` (`referenciaId` = "<convId>/<mensajeId>", `autorMensajeId`) y la resolución `usuario-desactivado`.
- Ocultar un mensaje recalcula el último mensaje de la conversación para no mostrar el texto oculto (§B, §C, §D actualizados).

## Problemas conocidos
- Encabezado en celular (375 px): el título "Ecosistema Educativo" queda amontonado junto a los íconos (ya existía).
- Sin regla de dueño en noticias: cualquier docente puede editar o borrar cualquier noticia.
- Nivel 1 del tema demo con 9 preguntas y niveles 2 a 5 vacíos; `estudiante1@demo.ec` tiene los 5 niveles aprobados.
- El sondeo de mensajes es por consulta periódica (no hay websockets): hay hasta 4 s de retraso.
- Una sesión vencida en `localStorage` impide abrir `ingreso.html` hasta borrarla.

## Pendiente para el siguiente sprint
- Sprint 11: tutor socrático con IA y avatar guía (P11.1 a P11.4). Copiar `servidor/prompts/tutor.txt` (Anexo B.3).
