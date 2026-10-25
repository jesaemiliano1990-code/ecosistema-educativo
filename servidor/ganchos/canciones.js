import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Gancho para la colección 'canciones'
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const unidades = await almacen.leer('unidades');
  const unidadMap = new Map(unidades.map(u => [u.id, u.asignaturaId]));

  const temas = await almacen.leer('temas');
  const temaMap = new Map(temas.map(t => [t.id, unidadMap.get(t.unidadId)]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));

  return lista.filter(c => {
    if (!c || !c.temaId) return false;
    const asigId = temaMap.get(c.temaId);
    return asigId && misIds.has(asigId);
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const error = new Error('temaId es requerido');
    error.estado = 400;
    throw error;
  }

  if (!datos.titulo || !datos.titulo.trim()) {
    const error = new Error('El título de la canción es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.audio || !datos.audio.trim()) {
    const error = new Error('El archivo de audio es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.autoria || !datos.autoria.trim()) {
    const error = new Error('La autoría es obligatoria');
    error.estado = 400;
    throw error;
  }

  if (!datos.licencia || !datos.licencia.trim()) {
    const error = new Error('La licencia es obligatoria');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('No se encontró la asignatura del tema asociado');
    error.estado = 400;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para gestionar canciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
