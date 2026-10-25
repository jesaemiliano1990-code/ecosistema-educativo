import { leerConfig } from './almacen.js';

/**
 * Evalúa si un usuario tiene permiso para una acción sobre una colección/registro.
 * @param {Object|null} usuario - Usuario de la sesión ({ id, rol, ... }) o null si no autenticado.
 * @param {'leer'|'escribir'} accion - Tipo de acción.
 * @param {string} col - Nombre de la colección.
 * @param {Object|null} [registro=null] - Objeto a consultar o modificar.
 * @returns {Promise<boolean>}
 */
export async function puede(usuario, accion, col, registro = null) {
  if (!col || (accion !== 'leer' && accion !== 'escribir')) {
    return false;
  }

  const permisos = await leerConfig('permisos');
  const configCol = permisos[col];

  // Si la colección no está listada → false
  if (!configCol || !Array.isArray(configCol[accion])) {
    return false;
  }

  const permitidos = configCol[accion];

  for (const regla of permitidos) {
    if (regla === 'publico') {
      return true;
    }

    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (!usuario) {
      continue;
    }

    if (regla === 'sesion') {
      return true;
    }

    if (regla === 'propio') {
      // "propio" compara registro.usuarioId con usuario.id (y para usuarios, registro.id con usuario.id)
      if (registro) {
        if (registro.usuarioId && registro.usuarioId === usuario.id) {
          return true;
        }
        if (col === 'usuarios' && registro.id === usuario.id) {
          return true;
        }
      } else if (accion === 'leer') {
        // En listados sin registro específico, "propio" permite la lectura para que el gancho filtrarLista restrinja la lista
        return true;
      }
      continue;
    }

    if (regla === usuario.rol) {
      return true;
    }
  }

  return false;
}
