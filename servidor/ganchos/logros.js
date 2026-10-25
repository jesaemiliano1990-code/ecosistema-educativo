import { estudiantesDe } from '../acceso.js';

/**
 * Gancho para la colección 'logros'
 * Los docentes ven solo los logros de sus estudiantes asignados.
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const setEst = new Set(misEstudiantes);
    return lista.filter(l => l && (setEst.has(l.usuarioId) || l.usuarioId === usuario.id));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(l => l && l.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
