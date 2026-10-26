# docs/render.md · Publicar en Render (paso a paso)

Render ejecuta el servidor Node del proyecto desde tu repositorio de GitHub y le da una dirección `https://....onrender.com`.

## Antes de empezar: elige el plan
| | Gratis | De pago (Starter) con disco |
|---|---|---|
| Costo | 0 | Desde unos 7 USD al mes + el disco (verifica en [render.com/pricing](https://render.com/pricing)) |
| Datos (usuarios, puntos, mensajes) | **Se borran** cuando el servicio se duerme, se reinicia o se actualiza | **Se conservan** en el disco |
| Archivos subidos (imágenes, audios) | Se borran | Se conservan |
| Velocidad | Se duerme tras 15 min sin visitas y tarda ~1 min en despertar | Siempre encendido |
| Uso recomendado | Demostración o prueba | Uso real con estudiantes |

En el plan gratis, cada vez que el servicio despierta se vuelve a cargar el contenido de la asignatura y a crear **tu cuenta de administrador**
(con el correo y la clave que definas). Los demás usuarios y su avance se pierden.

## Paso 1. Subir el proyecto a GitHub
Debe estar al día en tu repositorio (comandos `git add -A`, `git commit` y `git push`). El contenido inicial viaja en `datos/inicial/`.

## Paso 2. Crear la cuenta en Render
1. Entra a **render.com** y pulsa **Get Started**.
2. Elige **GitHub** para registrarte y autoriza el acceso al repositorio `ecosistema-educativo`.

## Paso 3. Crear el servicio
**Opción A, con el archivo `render.yaml` (más rápida):**
1. Pulsa **New +** y elige **Blueprint**.
2. Elige el repositorio `ecosistema-educativo` y pulsa **Connect**.
3. Render te pide valores para tres variables:
   - `ADMIN_CORREO`: el correo con el que entrarás como administrador.
   - `ADMIN_CLAVE`: una clave de al menos 8 caracteres con letras y números.
   - `IA_CLAVE`: la clave de Google AI Studio (déjala vacía si no usarás IA).
4. Pulsa **Apply** / **Deploy**.

**Opción B, a mano:**
1. **New +** → **Web Service** → elige el repositorio.
2. **Name**: `ecosistema-educativo`. **Language/Runtime**: `Node`. **Instance Type**: `Free`.
3. **Build Command**: `npm ci --omit=dev`  ·  **Start Command**: `npm run produccion`.
4. En **Environment Variables** agrega: `NODE_VERSION` = `22`, `ADMIN_CORREO`, `ADMIN_CLAVE` y, si quieres IA, `IA_PROVEEDOR` = `gemini`, `IA_MODELO` = `gemini-3.5-flash-lite` y `IA_CLAVE`.
5. Pulsa **Create Web Service**.

## Paso 4. Esperar y abrir
1. En la pestaña **Logs** verás el avance; termina con "Servidor iniciado" y el estado **Live**.
2. Abre la dirección que aparece arriba (algo como `https://ecosistema-educativo-xxxx.onrender.com`).
3. Entra con `ADMIN_CORREO` y `ADMIN_CLAVE`. La asignatura **Clínica de Simulación (Medicina Crítica)** ya está cargada con sus 7 temas.
4. Crea el grupo: **Distributivo** → **+ Asignar grupo**. Los docentes y estudiantes se registran solos en **Registrarse**, y tú les cambias el rol en **Usuarios**.

## Para conservar los datos (plan de pago)
1. En el servicio, pulsa **Settings** y cambia **Instance Type** a **Starter**.
2. Baja a **Disks** → **Add Disk**: nombre `datos`, **Mount Path** `/var/data`, tamaño `1 GB`.
3. En **Environment** agrega `DATOS_DIR` = `/var/data`.
4. Pulsa **Save, rebuild and deploy**.

Desde entonces, usuarios, avances, mensajes e imágenes subidas viven en el disco y sobreviven a reinicios y actualizaciones.
El contenido inicial solo se copia si el archivo no existe: lo que edites no se pisa. Haz respaldos periódicos (los Snapshots de disco de Render
o descargando los archivos).

## Actualizar la aplicación
Cada `git push` a `main` vuelve a desplegar el servicio automáticamente.

## Problemas frecuentes
| Síntoma | Qué revisar |
|---|---|
| Error "ADMIN_CLAVE debe tener al menos 8 caracteres" en los Logs | La clave necesita letras y números |
| "Ya existe una cuenta con ADMIN_CORREO y no es administradora" | Cambia `ADMIN_CORREO` por otro correo |
| La página tarda un minuto en abrir | Es el despertar del plan gratis |
| Perdí los usuarios | Es normal en el plan gratis; usa el plan de pago con disco |
| La IA no responde | Revisa `IA_CLAVE`, `IA_PROVEEDOR` e `IA_MODELO` en **Environment** |
