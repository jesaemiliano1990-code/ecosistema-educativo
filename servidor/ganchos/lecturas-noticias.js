// servidor/ganchos/lecturas-noticias.js
// Gancho para la colección 'lecturas-noticias': fija usuarioId y evita registros duplicados

import * as almacen from '../almacen.js';

/**
 * Hook previo al guardado de una lectura de noticia.
 * - Fija usuarioId a partir del usuario en sesión.
 * - Rechaza registros duplicados para la combinación usuarioId + noticiaId.
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  const usuarioId = usuario ? usuario.id : datos.usuarioId;
  const noticiaId = datos.noticiaId || anterior?.noticiaId;

  if (!usuarioId) {
    const error = new Error('No se pudo identificar el usuario para registrar la lectura');
    error.estado = 401;
    throw error;
  }

  if (!noticiaId) {
    const error = new Error('El campo noticiaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Evitar duplicados para la misma noticia y usuario
  const todasLecturas = await almacen.leer('lecturas-noticias');
  const existe = todasLecturas.find(l => 
    l && l.usuarioId === usuarioId && l.noticiaId === noticiaId && (!anterior || l.id !== anterior.id)
  );

  if (existe) {
    const error = new Error('Ya existe un registro de lectura para esta noticia y usuario');
    error.estado = 400;
    throw error;
  }

  return {
    ...datos,
    usuarioId,
    noticiaId
  };
}

/**
 * Hook de filtrado de lista de lecturas de noticias.
 * - Cada usuario ve únicamente sus propias lecturas (salvo admin).
 * @param {Array} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  return lista.filter(l => l && l.usuarioId === usuario.id);
}

/**
 * Las marcas de lectura solo las borra su dueño (o un admin).
 */
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol !== 'admin' && registro.usuarioId !== usuario.id) {
    const error = new Error('No puedes eliminar la lectura de otra persona');
    error.estado = 403;
    throw error;
  }
}

export default {
  antesDeGuardar,
  filtrarLista,
  antesDeEliminar
};
