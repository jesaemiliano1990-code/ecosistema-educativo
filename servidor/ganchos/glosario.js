import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Gancho para la colección 'glosario'
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

  if (usuario.rol === 'docente') {
    return lista.filter(g => {
      if (!g || !g.temaId) return false;
      const asigId = temaMap.get(g.temaId);
      return asigId && misIds.has(asigId);
    });
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(g => {
      if (!g || !g.temaId) return false;
      const asigId = temaMap.get(g.temaId);
      return asigId && misIds.has(asigId) && g.estado === 'aprobado';
    });
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const error = new Error('temaId es requerido');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);

  if (!permitido) {
    const error = new Error('No tienes permiso para editar el glosario de esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

// Un docente solo borra términos del glosario de las asignaturas que dicta.
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol === 'admin') return; // también limpia términos huérfanos (sin tema)
  const asignaturaId = await asignaturaDeTema(registro.temaId);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) {
    const error = new Error('No tienes permiso para eliminar términos del glosario de esta asignatura');
    error.estado = 403;
    throw error;
  }
}

export default {
  filtrarLista,
  antesDeGuardar,
  antesDeEliminar
};
