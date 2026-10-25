import { gruposDe } from '../acceso.js';

/**
 * Gancho para la colección 'distributivo'
 * Cada usuario ve solo los grupos a los que pertenece (admin ve todos).
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  return await gruposDe(usuario);
}

export default {
  filtrarLista
};
