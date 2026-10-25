/**
 * servidor/notificar.js
 * Módulo de envío y registro de notificaciones a usuarios
 */

import * as almacen from './almacen.js';

/**
 * Registra una notificación para un usuario
 * @param {string} usuarioId - ID del destinatario
 * @param {Object} datos - { tipo, mensaje, enlace }
 * @returns {Promise<Object>} Notificación creada
 */
export async function notificar(usuarioId, { tipo = 'info', mensaje, enlace = null } = {}) {
  if (!usuarioId || !mensaje) return null;

  const reg = {
    usuarioId,
    tipo,
    mensaje,
    enlace: enlace || null,
    leida: false
  };

  return await almacen.agregar('notificaciones', reg);
}

export default {
  notificar
};
