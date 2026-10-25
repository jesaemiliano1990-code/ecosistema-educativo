# Manual del administrador · Ecosistema Educativo

La administración organiza asignaturas y grupos, gestiona cuentas, atiende reportes y cuida el servicio. La instalación y los
respaldos están en `docs/despliegue.md`.

## Cómo crear la primera cuenta de administrador
1. En el servidor, dentro de la carpeta de la aplicación, ejecuta `npm run crear-admin`.
2. Escribe nombre, apellido, correo y una clave de al menos 8 caracteres con letras y números.
3. Ingresa con esa cuenta. Las demás personas se registran solas desde **Registrarse**; tú les asignas el rol.

## Cómo crear una asignatura
1. En el menú, entra a **Asignaturas**.
2. Pulsa **Nueva asignatura**, escribe el nombre, la descripción y el nivel, y guarda.

## Cómo armar un grupo (distributivo)
1. Entra a **Distributivo** y pulsa **+ Asignar grupo**.
2. Elige la asignatura, el docente, el paralelo y el periodo, y marca los estudiantes del grupo.
3. Guarda. Desde ese momento el docente y los estudiantes ven la asignatura. Para cambiar integrantes, edita el grupo.

## Cómo gestionar usuarios
1. Entra a **Usuarios** y usa el buscador o el filtro por rol.
2. Para cambiar un rol (por ejemplo, de estudiante a docente), usa la lista de la columna **Rol**.
3. Para suspender una cuenta, desmarca **Activo**. Esa persona no podrá ingresar y su sesión abierta deja de servir. Márcalo de nuevo para reactivarla.
4. Si alguien olvidó su clave, pulsa **Restablecer clave**: se muestra una clave temporal **una sola vez**. Entrégasela por un medio seguro y pídele que la cambie en **Mi perfil**.
5. No puedes quitarte tu propio rol, desactivarte ni eliminarte.

## Cómo atender los reportes
1. Entra a **Reportes**: aparecen los contenidos de foros y los mensajes que reportó la comunidad.
2. Lee el motivo y el contexto (en un mensaje se muestra la conversación cercana).
3. Elige una acción: **Ocultar contenido** o **Ocultar mensaje**, **Desactivar usuario** o **Descartar reporte**. Queda registrado quién resolvió y cómo.

## Cómo ajustar los límites del servicio
1. Abre el archivo `datos/config/ajustes.json` en el servidor.
2. Puedes cambiar `maxSubidaMB` (tamaño de archivos), `limiteIADiario` y `limiteTutorDiario` (consultas de IA por persona y día) y `chatEntreEstudiantes` (`true` o `false`).
3. Guarda el archivo. Si cambias `maxSubidaMB`, ajusta también `client_max_body_size` en Nginx.

## Cómo comprobar que la IA funciona
1. Con tu sesión de administrador abierta, visita `/api/ia/prueba` en el sitio.
2. Si responde, la conexión es correcta. Si muestra que la IA no está configurada, revisa `IA_CLAVE` e `IA_MODELO` en el archivo `.env` del servidor y reinicia con `pm2 reload ecosistema --update-env`.

## Cómo cuidar los datos
- Un respaldo diario se genera con `scripts/respaldar.sh` (ver `docs/despliegue.md`); verifica cada semana que existe y que hay una copia fuera del servidor.
- Antes de actualizar la aplicación, haz un respaldo manual.

## Preguntas frecuentes
1. **Una persona no puede ingresar.** Revisa que su cuenta esté **Activa**. Tras 5 intentos fallidos se bloquea 15 minutos; después puede intentar de nuevo.
2. **Un docente no ve a sus estudiantes.** Falta asignar el grupo en **Distributivo**.
3. **¿Puedo borrar un usuario?** Es mejor desactivarlo: así se conserva su historial de intentos y mensajes.
4. **Las funciones de IA no responden.** Mira primero `/api/ia/prueba` y los límites diarios en `ajustes.json`.
5. **¿Cómo recupero datos perdidos?** Restaura el último respaldo siguiendo `docs/despliegue.md` (sección de respaldo) con la aplicación detenida.
