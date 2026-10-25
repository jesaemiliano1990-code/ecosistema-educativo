import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

/**
 * Gancho para la colección 'progreso-temas'
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const setEst = new Set(misEstudiantes);
    return lista.filter(p => p && (setEst.has(p.usuarioId) || p.usuarioId === usuario.id));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(p => p && p.usuarioId === usuario.id);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  // Fija usuarioId = usuario.id
  const usuarioId = usuario ? usuario.id : datos.usuarioId;
  const temaId = datos.temaId || anterior?.temaId;

  if (!usuarioId) {
    const error = new Error('No se pudo identificar el usuario para registrar el progreso');
    error.estado = 401;
    throw error;
  }

  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Rechaza duplicados (usuarioId + temaId)
  const todos = await almacen.leer('progreso-temas');
  const existe = todos.find(p => p && p.usuarioId === usuarioId && p.temaId === temaId && (!anterior || p.id !== anterior.id));

  if (existe) {
    const error = new Error('Ya existe un registro de progreso para este tema y usuario');
    error.estado = 400;
    throw error;
  }

  return {
    ...datos,
    usuarioId,
    temaId
  };
}

export default {
  filtrarLista,
  antesDeGuardar
};
