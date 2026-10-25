import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function validarClave(clave) {
  return typeof clave === 'string' && clave.length >= 8 && /[a-zA-Z]/.test(clave) && /[0-9]/.test(clave);
}

async function main() {
  const args = process.argv.slice(2);
  let nombre = '';
  let apellido = '';
  let correo = '';
  let clave = '';

  let rl = null;

  try {
    if (args.length >= 4) {
      // Admite argumentos de línea de comandos: node crear-admin.js <nombre> <apellido> <correo> <clave>
      [nombre, apellido, correo, clave] = args;
    } else {
      rl = readline.createInterface({ input, output });
      console.log('=== Crear Usuario Administrador ===\n');

      nombre = await rl.question('Nombre: ');
      apellido = await rl.question('Apellido: ');
      correo = await rl.question('Correo electrónico: ');
      clave = await rl.question('Contraseña (mínimo 8 caracteres, con letras y números): ');
    }

    nombre = (nombre || '').trim();
    apellido = (apellido || '').trim();
    const correoNorm = (correo || '').trim().toLowerCase();
    clave = (clave || '').trim();

    if (!nombre) {
      console.error('Error: El nombre es obligatorio.');
      process.exit(1);
    }

    if (!apellido) {
      console.error('Error: El apellido es obligatorio.');
      process.exit(1);
    }

    if (!validarCorreo(correoNorm)) {
      console.error('Error: El correo electrónico no es válido.');
      process.exit(1);
    }

    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.find(u => u && u.correo && u.correo.toLowerCase() === correoNorm);
    if (yaExiste) {
      console.error('Error: Ya existe un usuario registrado con ese correo.');
      process.exit(1);
    }

    if (!validarClave(clave)) {
      console.error('Error: La contraseña debe tener al menos 8 caracteres y contener letras y números.');
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const fecha = new Date().toISOString();

    const nuevoAdmin = {
      nombre,
      apellido,
      correo: correoNorm,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoAdmin);

    console.log('\n✔ Usuario administrador creado con éxito:');
    console.log(`  ID:       ${creado.id}`);
    console.log(`  Nombre:   ${creado.nombre} ${creado.apellido}`);
    console.log(`  Correo:   ${creado.correo}`);
    console.log(`  Rol:      ${creado.rol}`);
    console.log(`  Activo:   ${creado.activo}`);
  } catch (error) {
    console.error('Error inesperado al crear administrador:', error);
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

main();
