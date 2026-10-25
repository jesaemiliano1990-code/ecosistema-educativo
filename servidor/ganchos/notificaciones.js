/**
 * Gancho para la colección 'notificaciones'
 * Cada persona solo borra sus propias notificaciones (un admin puede borrar cualquiera).
 */

export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol !== 'admin' && registro.usuarioId !== usuario.id) {
    const error = new Error('No puedes eliminar las notificaciones de otra persona');
    error.estado = 403;
    throw error;
  }
}

export default {
  antesDeEliminar
};
