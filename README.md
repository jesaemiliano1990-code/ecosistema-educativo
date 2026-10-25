# Ecosistema Educativo Digital

Plataforma web educativa modular con almacenamiento seguro en archivos locales y arquitectura orientada a servicios.

## Requisitos
- **Node.js**: Versión 20 o superior (LTS recomendada).
- **NPM**: Incluido con Node.js.

## Instalación y puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.ejemplo .env
   # En Windows PowerShell:
   # Copy-Item .env.ejemplo .env
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```

El servidor quedará disponible en `http://localhost:3000`.

## Scripts disponibles
- `npm start`: Inicia el servidor de Express en `servidor/server.js`.
- `npm run semilla`: Ejecuta la carga de datos iniciales (`servidor/semilla.js`).
- `npm run crear-admin`: Crea un usuario administrador (`servidor/crear-admin.js`).

## Despliegue en producción
Guía completa para Ubuntu (Node.js, PM2, Nginx, HTTPS, cortafuegos y respaldo diario): [docs/despliegue.md](docs/despliegue.md).
