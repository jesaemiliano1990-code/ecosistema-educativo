import { asignaturasDe } from '../acceso.js';

/**
 * Gancho para la colección 'asignaturas'
 * Cada usuario ve solo las asignaturas a las que pertenece (admin ve todas).
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));
  return lista.filter(item => item && misIds.has(item.id));
}

export default {
  filtrarLista
};
