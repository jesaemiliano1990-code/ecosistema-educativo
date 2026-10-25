import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

const DIR_SEMILLA = path.resolve('datos', 'semilla');
const DIR_DATOS = path.resolve('datos');

async function ejecutarSemilla() {
  const args = process.argv.slice(2);
  const forzar = args.includes('--forzar');

  if (forzar) {
    const rl = readline.createInterface({ input, output });
    try {
      const respuesta = await rl.question('¿Desea sobrescribir las colecciones existentes con los datos semilla? (s/n): ');
      if (!['s', 'si', 'y', 'yes'].includes(respuesta.trim().toLowerCase())) {
        console.log('Operación cancelada.');
        return;
      }
    } finally {
      rl.close();
    }
  }

  let archivos = [];
  try {
    const entradas = await fs.readdir(DIR_SEMILLA, { withFileTypes: true });
    archivos = entradas.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => e.name);
  } catch (error) {
    console.error(`Error al leer el directorio de semilla (${DIR_SEMILLA}):`, error.message);
    process.exit(1);
  }

  if (archivos.length === 0) {
    console.log('No se encontraron archivos .json en datos/semilla/.');
    return;
  }

  console.log(`=== Inicializando datos semilla ${forzar ? '(modo forzar)' : ''} ===\n`);

  for (const archivo of archivos) {
    const col = archivo.replace(/\.json$/, '');
    const rutaSemilla = path.join(DIR_SEMILLA, archivo);
    const rutaDestino = path.join(DIR_DATOS, archivo);

    let existe = false;
    try {
      await fs.access(rutaDestino);
      existe = true;
    } catch {
      existe = false;
    }

    if (existe && !forzar) {
      console.log(`[Omitido] ${archivo} ya existe en datos/. (Usa --forzar para sobrescribir)`);
      continue;
    }

    try {
      const raw = await fs.readFile(rutaSemilla, 'utf-8');
      let datos = JSON.parse(raw);

      if (col === 'usuarios' && Array.isArray(datos)) {
        const claveHash = await bcrypt.hash('Demo12345', 10);
        datos = datos.map(u => ({
          ...u,
          claveHash
        }));
      }

      await almacen.escribir(col, datos);
      console.log(`[Copiado] ${archivo}: ${datos.length} registros ${existe ? 'sobrescritos' : 'insertados'}.`);
    } catch (error) {
      console.error(`Error procesando ${archivo}:`, error.message);
    }
  }

  console.log('\n✔ Proceso de datos semilla completado.');
}

ejecutarSemilla().catch(err => {
  console.error('Error general en semilla:', err);
  process.exit(1);
});
