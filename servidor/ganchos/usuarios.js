/**
 * Gancho para la colección 'usuarios'
 */

/**
 * Quita 'claveHash' de los elementos de la lista devuelta por la API.
 * @param {Array} lista - Lista de usuarios.
 * @param {Object|null} usuario - Usuario de la sesión.
 * @returns {Array} Lista con claveHash omitido.
 */
export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return [];
  return lista.map(u => {
    if (!u) return u;
    const { claveHash, ...resto } = u;
    return resto;
  });
}

/**
 * Ignora 'claveHash' y 'correo' antes de guardar cambios,
 * y evita que un administrador se quite el rol o se desactive a sí mismo.
 * @param {Object} datos - Datos enviados por el cliente.
 * @param {Object|null} usuario - Usuario de la sesión.
 * @param {Object|null} anterior - Registro previo en caso de actualización.
 * @returns {Object} Datos procesados.
 */
export function antesDeGuardar(datos, usuario, anterior) {
  const limpio = { ...datos };
  delete limpio.claveHash;
  delete limpio.correo;

  // Evitar que un admin se quite el rol o se desactive a sí mismo
  if (usuario && anterior && usuario.id === anterior.id) {
    if (limpio.rol !== undefined && limpio.rol !== anterior.rol) {
      const error = new Error('Un administrador no puede cambiar su propio rol');
      error.estado = 400;
      throw error;
    }
    if (limpio.activo !== undefined && limpio.activo === false && anterior.activo !== false) {
      const error = new Error('Un administrador no puede desactivar su propia cuenta');
      error.estado = 400;
      throw error;
    }
  }

  return limpio;
}

export default {
  filtrarLista,
  antesDeGuardar
};
