// servidor/ganchos/noticias.js
// Gancho para la colección 'noticias': autoría, fecha de publicación y filtrado por rol

import * as almacen from '../almacen.js';
import { asignaturaDeTema } from '../acceso.js';
import { notificar } from '../notificar.js';

/**
 * Hook previo al guardado (creación o actualización) de una noticia.
 * - Fija autorId al crear.
 * - Fija fechaPublicacion en formato ISO cuando el estado pasa a "publicado".
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!datos.titulo || !String(datos.titulo).trim()) {
    const error = new Error('El título de la noticia es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Creación: fijar autorId y fechaPublicacion si se publica de inmediato
  if (!anterior) {
    const autorId = usuario ? usuario.id : (datos.autorId || null);
    const estado = datos.estado || 'borrador';
    const fechaPublicacion = estado === 'publicado' ? new Date().toISOString() : null;

    return {
      ...datos,
      autorId,
      estado,
      fechaPublicacion
    };
  }

  // Actualización: conservar autor original y actualizar fechaPublicacion si pasa a publicado
  const autorId = anterior.autorId || (usuario ? usuario.id : null);
  const estado = datos.estado !== undefined ? datos.estado : anterior.estado;

  let fechaPublicacion = anterior.fechaPublicacion || null;
  if (estado === 'publicado' && anterior.estado !== 'publicado') {
    fechaPublicacion = new Date().toISOString();
  } else if (estado === 'borrador') {
    fechaPublicacion = null;
  }

  return {
    ...datos,
    autorId,
    estado,
    fechaPublicacion
  };
}

/**
 * Hook de filtrado de lista de noticias.
 * - Los estudiantes solo ven las noticias publicadas.
 * - Docentes y administradores ven todas (incluidos borradores para edición).
 * @param {Array} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  if (usuario.rol === 'admin' || usuario.rol === 'docente') {
    return lista;
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(n => n && n.estado === 'publicado');
  }

  return lista.filter(n => n && n.estado === 'publicado');
}

/**
 * Cuando una noticia pasa a "publicado", avisa a los estudiantes de la asignatura del tema relacionado
 * (o a todos los estudiantes si no tiene tema).
 */
export async function despuesDeGuardar(registro, usuario, anterior) {
  if (registro.estado !== 'publicado' || anterior?.estado === 'publicado') return;
  try {
    let ids;
    const asignaturaId = registro.temaId ? await asignaturaDeTema(registro.temaId) : null;
    if (asignaturaId) {
      const grupos = (await almacen.leer('distributivo')).filter(g => g && g.asignaturaId === asignaturaId);
      ids = new Set(grupos.flatMap(g => g.estudiantes || []));
    } else {
      ids = new Set((await almacen.leer('usuarios')).filter(u => u && u.rol === 'estudiante').map(u => u.id));
    }
    const activos = new Set((await almacen.leer('usuarios')).filter(u => u && u.activo !== false).map(u => u.id));
    for (const id of ids) {
      if (id === registro.autorId || !activos.has(id)) continue;
      await notificar(id, {
        tipo: 'noticia',
        mensaje: `Nueva noticia: ${registro.titulo}`,
        enlace: `/paginas/noticia.html?id=${encodeURIComponent(registro.id)}`
      });
    }
  } catch (error) {
    console.warn('Noticias: no se pudo avisar a los estudiantes:', error.message);
  }
}

export default {
  antesDeGuardar,
  despuesDeGuardar,
  filtrarLista
};
