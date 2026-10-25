// publico/js/nucleo/bitacora.js
// Registro de eventos de usuario en la bitácora del sistema

import { llamar } from './api.js';

/**
 * Registra un evento en la bitácora del servidor.
 * @param {string} tipo - Tipo de evento (ej. "pagina", "actividad", "quiz_inicio").
 * @param {string} recurso - Recurso o ruta asociada (ej. location.pathname, id de actividad).
 * @returns {Promise<Object|null>}
 */
export async function registrarEvento(tipo, recurso) {
  try {
    return await llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (error) {
    // Falla silenciosa para no degradar la navegación del usuario
    console.warn('No se pudo registrar evento en bitácora:', error);
    return null;
  }
}

export default {
  registrarEvento
};
