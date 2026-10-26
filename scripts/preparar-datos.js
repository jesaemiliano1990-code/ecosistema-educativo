// Prepara la carpeta de datos antes de iniciar el servidor (útil en Render y en servidores nuevos):
//  1. copia la configuración y el contenido inicial si todavía no existen (nunca pisa datos existentes);
//  2. crea la cuenta de administrador si se definieron ADMIN_CORREO y ADMIN_CLAVE y aún no hay ninguna.
// Variables: DATOS_DIR (carpeta de datos, por defecto "datos"), ADMIN_CORREO, ADMIN_CLAVE, ADMIN_NOMBRE, ADMIN_APELLIDO.
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const origen = path.resolve('datos');
const destino = path.resolve(process.env.DATOS_DIR || 'datos');

async function existe(ruta) {
  try { await fs.access(ruta); return true; } catch { return false; }
}

async function copiarSiFalta(desde, hasta) {
  if (await existe(hasta)) return false;
  await fs.mkdir(path.dirname(hasta), { recursive: true });
  await fs.copyFile(desde, hasta);
  return true;
}

async function copiarCarpeta(sub, aSub) {
  const dir = path.join(origen, sub);
  if (!(await existe(dir))) return 0;
  let copiados = 0;
  for (const f of await fs.readdir(dir)) {
    if (!f.endsWith('.json')) continue;
    if (await copiarSiFalta(path.join(dir, f), path.join(destino, aSub, f))) copiados++;
  }
  return copiados;
}

async function leerUsuarios() {
  try {
    const texto = (await fs.readFile(path.join(destino, 'usuarios.json'), 'utf-8')).replace(/^﻿/, '');
    const lista = JSON.parse(texto);
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function main() {
  await fs.mkdir(destino, { recursive: true });
  const configuracion = await copiarCarpeta('config', 'config');
  const contenido = await copiarCarpeta('inicial', '');
  if (configuracion || contenido) console.log(`Datos preparados en ${destino}: ${configuracion} archivos de configuración y ${contenido} de contenido inicial.`);

  // Con una carpeta de datos propia (disco permanente), los archivos subidos también viven allí.
  if (destino !== origen) {
    const permanentes = path.join(destino, 'subidas');
    const publicas = path.resolve('publico', 'recursos', 'subidas');
    await fs.mkdir(permanentes, { recursive: true });
    try {
      const info = await fs.lstat(publicas).catch(() => null);
      if (!info) {
        await fs.mkdir(path.dirname(publicas), { recursive: true });
        await fs.symlink(permanentes, publicas, process.platform === 'win32' ? 'junction' : 'dir');
      } else if (!info.isSymbolicLink()) {
        console.warn('AVISO: publico/recursos/subidas ya existe y no es un enlace; las subidas no quedarán en el disco permanente.');
      }
    } catch (e) {
      console.warn('AVISO: no se pudo enlazar la carpeta de subidas al disco permanente:', e.message);
    }
  }

  const correo = (process.env.ADMIN_CORREO || '').trim().toLowerCase();
  const clave = process.env.ADMIN_CLAVE || '';
  if (!correo || !clave) return;

  const usuarios = await leerUsuarios();
  if (usuarios.some((u) => u && u.rol === 'admin')) return; // ya hay un administrador

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('ADMIN_CORREO no es un correo válido');
  if (clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) throw new Error('ADMIN_CLAVE debe tener al menos 8 caracteres con letras y números');
  if (usuarios.some((u) => u && (u.correo || '').toLowerCase() === correo)) throw new Error('Ya existe una cuenta con ADMIN_CORREO y no es administradora');

  const fecha = new Date().toISOString();
  const numero = usuarios.reduce((max, u) => Math.max(max, parseInt(String(u?.id || '').split('_')[1], 10) || 0), 0) + 1;
  usuarios.push({
    nombre: (process.env.ADMIN_NOMBRE || 'Administrador').trim(),
    apellido: (process.env.ADMIN_APELLIDO || 'General').trim(),
    correo,
    claveHash: await bcrypt.hash(clave, 10),
    rol: 'admin',
    activo: true,
    foto: null,
    consentimiento: { aceptado: true, fecha },
    id: `usu_${String(numero).padStart(6, '0')}`,
    fecha
  });
  const ruta = path.join(destino, 'usuarios.json');
  await fs.writeFile(`${ruta}.tmp`, JSON.stringify(usuarios, null, 2), 'utf-8');
  await fs.rename(`${ruta}.tmp`, ruta);
  console.log(`Cuenta de administrador creada: ${correo}`);
}

main().catch((error) => {
  console.error('No se pudieron preparar los datos:', error.message);
  process.exit(1);
});
