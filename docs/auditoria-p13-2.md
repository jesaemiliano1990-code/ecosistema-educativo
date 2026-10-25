# docs/auditoria-p13-2.md · Auditoría de seguridad y accesibilidad (P13.2)

Archivos revisados: `auth.js`, `permisos.js`, `server.js`, `ganchos/` (todos), `almacen.js`, `ia.js`, `gamificacion.js`,
`rutas/quiz.js`, `rutas/mensajes.js`, `rutas/gamificacion.js`, `rutas/subidas.js` y, en el navegador, `plantilla.js`,
`hilo.js`, `mensajes.js`, `tema.js` y `editor-tema.js` (solo plantillas HTML). Todo lo marcado «Corregido» se probó con
los guiones (96 comprobaciones de regresión y 47 de las correcciones, en una copia aislada).

## Defectos de P13.1
| ID | Hallazgo | Estado |
|----|----------|--------|
| DEF-01 | Claves por defecto (`Demo12345`, `Profesor1*`…) abrían cualquier cuenta; correos alias fijos en el código | Corregido (`rutas/auth.js`) |
| DEF-02 | `POST /api/subidas` aceptaba archivos sin sesión | Corregido (`rutas/subidas.js`) |
| DEF-03 | «Tema revisado» sumaba 10 puntos en vez de 5 | Corregido (`reglas-gamificacion.json`: `sinBono`) |

## Hallazgos de la auditoría
| Prioridad | Archivo | Hallazgo | Estado |
|-----------|---------|----------|--------|
| Alta | `server.js` | `GET /api/:col/:id` devolvía registros sin aplicar el filtro de la lista (borradores de temas y noticias, unidades y temas de otras asignaturas, logros e intentos ajenos para docentes) | Corregido: se aplica `puedeVer` o, si no existe, `filtrarLista` |
| Alta | `ganchos/unidades, temas, glosario, canciones` | Un docente podía «robar» un recurso de otra asignatura cambiando su unidad o tema por uno propio (solo se comprobaba el destino) | Corregido: también se exige permiso sobre el origen |
| Alta | `ganchos/progreso-temas, lecturas-noticias` | Un estudiante podía editar un registro ajeno y quedarse como dueño; se guardaban campos arbitrarios | Corregido: el dueño no cambia y hay lista blanca de campos |
| Alta | `gamificacion.js` | Se podían inventar ids de simulación para sumar 30 puntos por cada uno | Corregido: la simulación debe existir, ser visible y del mismo tema |
| Alta | `tema.js` | Recursos con `javascript:` en la URL se convertían en enlaces (XSS guardado por un docente) | Corregido: solo http(s) y rutas de la plataforma |
| Media | `ganchos/noticias` | Cualquier docente editaba o borraba noticias ajenas | Corregido: solo el autor o un admin |
| Media | `ganchos/alertas` | Un docente podía crear alertas falsas por la API | Corregido: las crea solo el servidor |
| Media | `permisos.json` | La colección `prueba` era pública (lectura y escritura) | Corregido: solo admin |
| Media | `server.js` | Errores internos devolvían el mensaje técnico; faltaban cabeceras (`nosniff`, `X-Frame-Options`, `Referrer-Policy`) y se anunciaba `X-Powered-By` | Corregido |
| Media | `server.js` | `GET /api/<col>/<id>` revelaba qué ids existían en colecciones prohibidas (403 frente a 404) | Corregido: primero se valida el permiso de la colección |
| Media | `server.js` | Las respuestas de `/api/usuarios` por id y de PUT/POST incluían `claveHash` (solo admin) | Corregido |
| Media | `almacen.js` | Una línea dañada de un `.jsonl` (corte de energía) rompía el límite diario de IA | Corregido: se ignoran las líneas incompletas |
| Media | `rutas/auth.js` | La foto de perfil aceptaba cualquier texto (`javascript:`, `data:`) | Corregido: solo ruta propia o https |
| Baja | `gamificacion.js, rutas/quiz.js` | `detalle`, `nivel`, `duracionSeg` y respuestas de texto se guardaban sin límite | Corregido: se acotan |
| Alta (accesibilidad) | `plantilla.js` | Sin enlace «Saltar al contenido»; en celular el menú cerrado seguía recibiendo el foco del teclado y no devolvía el foco al cerrarse | Corregido: enlace de salto, `inert` del menú cerrado y manejo del foco |
| Media (accesibilidad) | `hilo.js` | `role="menu"` y `menuitem` sin navegación con flechas | Corregido: botones normales dentro de `<details>` |
| Baja (accesibilidad) | `mensajes.js, plantilla.js` | `aria-label` en `span` sin rol (los lectores lo ignoran) en los contadores | Corregido: `role="img"` |

## Aceptado o pendiente
- **El puntaje de actividades lo declara el navegador** (juegos y simulaciones, salvo el quiz y la evaluación de rol): un estudiante puede
  falsear un puntaje, con límites por hora y por día. Pasarlo al servidor exige rehacer cada juego; queda como mejora.
- **Bloqueo por correo tras 5 intentos fallidos**: cualquiera puede bloquear 15 minutos la cuenta de otra persona. Es un compromiso aceptado.
  Para producción conviene añadir límite por IP en el proxy.
- **Sin cabecera `Content-Security-Policy`**: la plataforma usa scripts de CDN y estilos en línea; se define con el despliegue (P13.3).
- **`datos/respaldos/` contiene copias de sesiones y hashes**: no se sirve por HTTP, pero debe quedar fuera del repositorio y con permisos restringidos.
- **Reutilización de ids** al borrar el último registro de una colección (`generarId` usa el máximo actual): sin efecto hoy; vigilar si se agregan referencias duraderas.
- **No revisados línea por línea**: `rutas/mensajes.js` (probada a fondo en P10.3), `editor-tema.js` (solo plantillas) y los módulos de juegos.
