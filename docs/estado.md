# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S00 · Fecha: 2026-10-23 · Velocidad real: __ puntos

## Funciona
- P00.1-4 · Servidor base, núcleo navegador, design system CSS y plantilla común (`server.js`, `api.js`, `tokens.css`, `plantilla.js`, `index.html`).
- P01.1 · Autenticación, sesiones y bitácora en servidor (`auth.js`, `rutas/auth.js`, `ganchos/usuarios.js`, `crear-admin.js`, `permisos.json`).
- P01.2 · Registro, ingreso, privacidad y sesión en navegador (`sesion.js`, `bitacora.js`, `plantilla.js`, `registro.html`, `ingreso.html`, `privacidad.html`).
- P01.3 · Perfil (`perfil.html`), administración de usuarios (`admin-usuarios.html`), subida de imágenes (`subidas.js`) y menú actualizado.
- P02.1 · Colecciones académicas, control de acceso por grupo (`acceso.js`), permisos, ganchos (`asignaturas`, `distributivo`, `unidades`, `temas`, `glosario`, `progreso-temas`) y subidas por rol.
- P02.2 · Datos de prueba semilla en `datos/semilla/` y script `servidor/semilla.js` con soporte para `--forzar` y hash bcrypt de contraseñas.
- P02.3 · Asignaturas y distributivo para admin (`admin-asignaturas.html`, `distributivo.html`, tarjetas, modales, eliminación protegida y menú).
- P02.4 · Editor de contenidos (`editor-contenidos.html`, selector de asignaturas propias, unidades y temas con orden, visibilidad, estados y menú).
- P02.5 · Ficha del tema y glosario (`editor-tema.html`, formulario pedagógico, listas, subida de recursos, glosario con métricas, indicador de juegos y botón IA deshabilitado).
- P02.6 · Vista del estudiante y avance (`catalogo-actividades.js`, `asignaturas.html` con avance, `asignatura.html`, `tema.html` con multimedia, progreso y menú).
- P03.1 · Cartelera de noticias y lecturas (`permisos.json`, ganchos, `editor-noticia.html`, `noticias.html` paginado, `noticia.html` y badge en menú).
- P03.2 · Canciones educativas y reproductor LRC (`permisos.json`, `ganchos/canciones.js`, `editor-cancion.html`, `canciones.html`, `menu.js`, `catalogo-actividades.js`).
- P03.3 · Página de inicio (`index.html`, `inicio.js`, `inicio.css`, vistas sin y con sesión, banner de continuación, avance por asignatura y noticias).
- P04.1-4 · Gamificación, catálogo, Ahorcado y Pareja (`gamificacion.js`, `ahorcado.html`, `pareja.html`, menú).
- P05.1-3 · Gamificación y diplomas; P06.1-5 · Analítica, paneles y alertas tempranas (`alertas.js`, `panel-docente.html`).
- Carga automática de rutas y ganchos. Respaldo diario automático (14 versiones).

## Decisiones y cambios respecto a docs/contratos.md
- Ninguno. Se implementó la firma y comportamiento exactos de §A, §B, §C, §D y §E.

## Problemas conocidos
- Ninguno.

## Pendiente para el siguiente sprint
- Siguiente módulo según backlog (P07.1).
