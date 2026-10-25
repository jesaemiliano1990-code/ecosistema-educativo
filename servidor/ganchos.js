import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ganchosPorCol = new Map();
let cargado = false;
let cargandoPromesa = null;

export async function cargarGanchos() {
  if (cargandoPromesa) return cargandoPromesa;
  if (cargado) return;

  cargandoPromesa = (async () => {
    const dirGanchos = path.resolve('servidor', 'ganchos');
    try {
      const archivos = await fs.readdir(dirGanchos, { withFileTypes: true });
      for (const archivo of archivos) {
        if (archivo.isFile() && archivo.name.endsWith('.js') && !archivo.name.startsWith('.')) {
          const col = path.basename(archivo.name, '.js');
          const rutaCompleta = path.join(dirGanchos, archivo.name);
          const urlModulo = pathToFileURL(rutaCompleta).href;
          const modulo = await import(urlModulo);
          ganchosPorCol.set(col, modulo.default || modulo);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error al cargar ganchos:', error);
      }
    } finally {
      cargado = true;
      cargandoPromesa = null;
    }
  })();

  return cargandoPromesa;
}

// Carga automática inicial
await cargarGanchos();

/**
 * Aplica un gancho sobre una colección. Devuelve el primer argumento si no existe.
 * @param {string} col - Nombre de la colección.
 * @param {string} nombre - Nombre del gancho ('filtrarLista', 'antesDeGuardar', 'despuesDeGuardar').
 * @param  {...any} args - Argumentos para la función del gancho.
 */
export async function aplicar(col, nombre, ...args) {
  if (!cargado) {
    await cargarGanchos();
  }

  const ganchoCol = ganchosPorCol.get(col);
  if (ganchoCol && typeof ganchoCol[nombre] === 'function') {
    return await ganchoCol[nombre](...args);
  }

  return args[0];
}
