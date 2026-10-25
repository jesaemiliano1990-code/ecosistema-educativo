import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

/**
 * Gancho para la colección 'temas'
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const unidades = await almacen.leer('unidades');
  const unidadMap = new Map(unidades.map(u => [u.id, u]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));

  if (usuario.rol === 'docente') {
    return lista.filter(t => {
      if (!t || !t.unidadId) return false;
      const u = unidadMap.get(t.unidadId);
      return u && misIds.has(u.asignaturaId);
    });
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(t => {
      if (!t || !t.unidadId) return false;
      const u = unidadMap.get(t.unidadId);
      if (!u || !misIds.has(u.asignaturaId) || u.visible === false) return false;
      return t.estado === 'publicado';
    });
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos.unidadId || anterior?.unidadId;
  if (!unidadId) {
    const error = new Error('unidadId es requerido');
    error.estado = 400;
    throw error;
  }

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u && u.id === unidadId);
  const asignaturaId = unidad?.asignaturaId;

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar temas de esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
