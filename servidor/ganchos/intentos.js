import { estudiantesDe } from '../acceso.js';

/**
 * Gancho para la colección 'intentos'
 * Los docentes ven solo los intentos de sus estudiantes asignados.
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const setEst = new Set(misEstudiantes);
    return lista.filter(i => i && (setEst.has(i.usuarioId) || i.usuarioId === usuario.id));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(i => i && i.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
