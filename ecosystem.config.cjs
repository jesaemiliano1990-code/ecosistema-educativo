// Configuración de PM2 para el servidor de producción.
// IMPORTANTE: una sola instancia. Los datos son archivos JSON y no admiten varios procesos escribiendo a la vez.
module.exports = {
  apps: [
    {
      name: 'ecosistema',
      script: 'servidor/server.js',
      cwd: __dirname, // el servidor lee .env y datos/ desde esta carpeta
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '400M',
      time: true, // fecha y hora en cada línea del registro
      merge_logs: true,
      out_file: 'logs/salida.log',
      error_file: 'logs/errores.log',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
