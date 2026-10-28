# docs/despliegue.md · Puesta en producción (Ubuntu 22.04 o 24.04)

Guía paso a paso para publicar el Ecosistema Educativo en un VPS o máquina virtual con Ubuntu, con HTTPS y respaldo diario.
Cada bloque de comandos se copia y se pega en la terminal del servidor.

> **Antes de empezar, reemplaza estos datos en toda la guía**
> - `ejemplo.edu.ec` → tu dominio real.
> - `<URL_DEL_REPOSITORIO>` → la dirección de tu repositorio privado (p. ej. `git@github.com:institucion/ecosistema.git`).
> - `TU_IP` → la dirección IP pública del servidor.

**Qué necesitas:** un servidor Ubuntu con al menos 1 GB de memoria y 10 GB de disco, un dominio cuyo registro **A** apunte a `TU_IP`
(si usas `www`, crea también ese registro) y acceso por SSH.

**Importante sobre el diseño:** los datos son archivos JSON dentro de `datos/`. Por eso la aplicación debe correr
**como un solo proceso** (no uses el modo "cluster" de PM2 ni varias réplicas) y los respaldos son imprescindibles.

---

## 1. Primer ingreso y usuario sin privilegios de root

Conéctate como `root` (o con el usuario que te dio el proveedor) y crea un usuario para la aplicación:

```bash
ssh root@TU_IP
adduser ecosistema                # te pedirá una contraseña larga; el resto de datos puedes dejarlos vacíos
usermod -aG sudo ecosistema       # solo para instalar; la aplicación NO corre como root
```

Copia tu llave SSH al nuevo usuario (desde **tu computador**) y comprueba que puedes entrar:

```bash
ssh-copy-id ecosistema@TU_IP
ssh ecosistema@TU_IP
```

Cuando entres bien con `ecosistema`, desactiva el ingreso directo de root:

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Actualiza el sistema y fija la zona horaria de Ecuador (los respaldos y el "día" del tutor la usan):

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone America/Guayaquil
```

## 2. Instalar Node.js (LTS) y Git

```bash
sudo apt install -y curl git ca-certificates
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # debe mostrar v20 o superior (la aplicación exige Node 20+)
npm -v
```

## 3. Descargar la aplicación

```bash
cd ~
git clone <URL_DEL_REPOSITORIO> app
cd app
```

Si el repositorio es privado, agrega antes una llave de despliegue (*deploy key*) en la configuración del repositorio.
Sin repositorio, puedes copiar la carpeta desde tu computador (sin `node_modules`, `datos` ni `.env`):

```bash
# ejecutar en TU computador, no en el servidor
rsync -av --exclude node_modules --exclude datos --exclude .env --exclude .git ./ ecosistema@TU_IP:~/app/
```

## 4. Instalar dependencias

```bash
cd ~/app
npm ci --omit=dev
```

## 5. Configurar el archivo `.env`

```bash
cp .env.ejemplo .env
nano .env
chmod 600 .env
```

Contenido mínimo (guarda con `Ctrl+O`, `Enter` y sal con `Ctrl+X`):

```
PUERTO=3000
IA_PROVEEDOR=gemini
IA_CLAVE=pega_aqui_tu_clave_de_Google_AI_Studio
IA_MODELO=gemini-3.5-flash-lite
```

Sin `IA_CLAVE`, la plataforma funciona igual; solo las funciones de IA muestran un aviso. **Nunca subas `.env` al repositorio.**

## 6. Datos iniciales y cuenta de administrador

Los datos reales **no** vienen en el repositorio. Crea la carpeta de datos con el catálogo de insignias y el administrador.
**No ejecutes `npm run semilla`**: esa orden crea usuarios de demostración con una clave conocida.

```bash
mkdir -p datos
cp datos/semilla/insignias.json datos/insignias.json
npm run crear-admin
```

Escribe nombre, apellido, correo y una clave de al menos 8 caracteres con letras y números. Esa será la primera cuenta
para ingresar; desde allí se crean asignaturas, distributivos y usuarios.

Prueba rápida (Ctrl+C para detener):

```bash
npm start
```

## 7. PM2: mantener la aplicación encendida

```bash
sudo npm install -g pm2
cd ~/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ecosistema --hp /home/ecosistema
```

El último comando imprime una línea que empieza con `sudo env PATH=...`: **cópiala y ejecútala**. Así PM2 levanta la
aplicación solo cuando el servidor se reinicia. Después:

```bash
pm2 save
pm2 status                         # "ecosistema" debe estar en "online"
pm2 logs ecosistema --lines 50     # registros en ~/app/logs/
pm2 install pm2-logrotate          # evita que los registros crezcan sin fin
```

`ecosystem.config.cjs` ya incluye reinicio automático ante fallos (`autorestart`), reinicio si supera 400 MB de memoria y
registros con fecha en `logs/salida.log` y `logs/errores.log`.

## 8. Nginx como proxy inverso

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/ecosistema
```

Pega esta configuración (cambia `ejemplo.edu.ec`). El tamaño máximo de subida es `maxSubidaMB` de `datos/config/ajustes.json`
(15 MB por defecto) más un margen; si lo cambias allí, cámbialo también en `client_max_body_size`.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ejemplo.edu.ec www.ejemplo.edu.ec;

    # Subidas: maxSubidaMB (15) + margen
    client_max_body_size 17m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Cabeceras de seguridad (la política de contenido se activa primero en modo "solo informar")
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; frame-src https://www.youtube.com https://player.vimeo.com; connect-src 'self'; object-src 'none'; base-uri 'self'" always;

    # Nunca servir archivos ocultos
    location ~ /\. { deny all; }

    # Estilos y scripts: caché de 1 hora (así una actualización llega pronto)
    location ~ ^/(css|js)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_hide_header Cache-Control;
        expires 1h;
        add_header Cache-Control "public";
    }

    # Archivos subidos (nombres aleatorios que no cambian): caché de 30 días
    location /recursos/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_hide_header Cache-Control;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;   # las respuestas de IA pueden tardar
    }
}
```

> Nota: al repetir `add_header` dentro de un `location`, Nginx deja de heredar los del bloque `server`. Por eso las cabeceras
> de seguridad llegan en las páginas, pero no en `/css`, `/js` ni `/recursos` (que son archivos estáticos). La aplicación también
> envía `nosniff`, `X-Frame-Options` y `Referrer-Policy` por su cuenta.

Actívala y reinicia Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/ecosistema /etc/nginx/sites-enabled/ecosistema
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                  # debe decir "syntax is ok"
sudo systemctl reload nginx
```

Abre `http://ejemplo.edu.ec` en el navegador: debe cargar la página de inicio.

## 9. HTTPS con Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ejemplo.edu.ec -d www.ejemplo.edu.ec
```

Responde con tu correo, acepta los términos y elige redirigir todo el tráfico a HTTPS. La renovación es automática; compruébala:

```bash
sudo certbot renew --dry-run
```

Cuando confirmes que el sitio abre bien en `https://ejemplo.edu.ec`, activa HSTS (obliga al navegador a usar siempre HTTPS):
agrega dentro del bloque `server` que escucha en `443` la línea
`add_header Strict-Transport-Security "max-age=31536000" always;`, luego `sudo nginx -t && sudo systemctl reload nginx`.

**Política de contenido:** deja `Content-Security-Policy-Report-Only` durante una semana. Revisa la consola del navegador
(F12) en las pantallas principales; si no aparecen avisos de bloqueo, cambia `Content-Security-Policy-Report-Only` por
`Content-Security-Policy` para aplicarla.

## 10. Cortafuegos (ufw)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

El puerto 3000 **no** se abre: solo Nginx habla con la aplicación. Verifica desde tu computador que
`http://TU_IP:3000` no responde.

## 11. Respaldo diario con cron

El script `scripts/respaldar.sh` crea `~/respaldos/datos-AAAA-MM-DD.tar.gz`, borra los de más de 14 días y, si configuras un
destino, los copia **fuera del servidor**.

```bash
cd ~/app
chmod +x scripts/respaldar.sh
./scripts/respaldar.sh            # prueba manual: debe crear el .tar.gz
ls -lh ~/respaldos
```

Programa el respaldo diario a las 02:30:

```bash
crontab -e
```

Agrega al final (si tienes un servidor o almacenamiento de respaldo, completa `DESTINO_REMOTO`):

```
30 2 * * * DESTINO_REMOTO="usuario@otro-servidor:/respaldos/ecosistema/" /home/ecosistema/app/scripts/respaldar.sh >> /home/ecosistema/respaldos/respaldo.log 2>&1
```

Para la copia remota, el servidor necesita entrar por SSH sin contraseña al destino: `ssh-keygen -t ed25519` y `ssh-copy-id usuario@otro-servidor`.
Sin `DESTINO_REMOTO`, el respaldo solo existe en el mismo servidor y **no protege contra la pérdida del servidor**:
descárgalo periódicamente a otro lugar.

Guarda también, en un lugar seguro y aparte, una copia del archivo `.env` (no va en los respaldos).

**Restaurar un respaldo** (con la aplicación detenida):

```bash
pm2 stop ecosistema
cd ~/app
mv datos datos-antes-de-restaurar
tar -xzf ~/respaldos/datos-AAAA-MM-DD.tar.gz        # recrea la carpeta datos/
pm2 start ecosistema
```

## 12. Cómo actualizar la aplicación

```bash
cd ~/app
./scripts/respaldar.sh            # siempre respalda antes de actualizar
git pull
npm ci --omit=dev
pm2 reload ecosistema
pm2 logs ecosistema --lines 30    # revisa que no haya errores
```

Si algo falla, vuelve a la versión anterior con `git log --oneline`, `git checkout <commit_anterior>`, `npm ci --omit=dev` y
`pm2 reload ecosistema`.

## 13. Lista de comprobación final

- [ ] `https://ejemplo.edu.ec` abre con candado y `http://` redirige a `https://`.
- [ ] Ingresas con la cuenta de administrador creada en el paso 6 y **no existen** cuentas de demostración.
- [ ] `https://ejemplo.edu.ec/api/ia/prueba` (con sesión de administrador) responde, o muestra un aviso claro si no hay clave de IA.
- [ ] Creaste una asignatura, un distributivo con un docente y un estudiante, y ambos pudieron ingresar.
- [ ] Una subida de imagen funciona y la imagen se ve (confirma `client_max_body_size`).
- [ ] `sudo reboot` y, al volver, `pm2 status` muestra `ecosistema` en `online` sin intervención.
- [ ] `./scripts/respaldar.sh` genera el `.tar.gz` y, al día siguiente, el cron generó el respaldo (`ls ~/respaldos`).
- [ ] Existe una copia de los respaldos **fuera del servidor** y la probaste restaurando en otra carpeta.
- [ ] `sudo ufw status` muestra solo 22, 80 y 443; `http://TU_IP:3000` no responde desde fuera.
- [ ] `curl -I https://ejemplo.edu.ec` muestra `X-Content-Type-Options` y `Strict-Transport-Security`.
- [ ] Revisaste con la institución el texto de la política de privacidad (`publico/paginas/privacidad.html`) y el correo de contacto que muestra (hoy: jesaemiliano19901@gmail.com; cámbialo en `publico/js/modulos/privacidad.js` si la institución usa otro).
- [ ] Guardaste el `.env` y las claves en un gestor de contraseñas; el acceso por SSH es solo con llave.

## 14. Problemas frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| 502 Bad Gateway | `pm2 status` y `pm2 logs ecosistema`; la aplicación no está en línea |
| "Error al subir" con archivos grandes | `client_max_body_size` en Nginx y `maxSubidaMB` en `datos/config/ajustes.json` |
| Certbot falla | El registro A del dominio aún no apunta al servidor, o el puerto 80 está cerrado |
| Las funciones de IA muestran aviso | `IA_CLAVE` e `IA_MODELO` en `.env`; luego `pm2 reload ecosistema --update-env` |
| Cambié `.env` y no se nota | `pm2 reload ecosistema --update-env` |
| Disco lleno | `du -sh ~/app/datos ~/app/logs ~/respaldos`; revisa `pm2-logrotate` y la retención de respaldos |
