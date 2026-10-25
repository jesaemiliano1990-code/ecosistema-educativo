import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

/**
 * Gancho para la colección 'unidades'
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));

  if (usuario.rol === 'docente') {
    return lista.filter(u => u && misIds.has(u.asignaturaId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(u => u && misIds.has(u.asignaturaId) && u.visible !== false);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;
  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);

  if (!permitido) {
    const error = new Error('No tienes permiso para editar unidades de esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
