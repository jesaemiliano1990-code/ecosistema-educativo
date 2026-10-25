// publico/js/nucleo/gamificacion.js
// Cliente de gamificación: registro de intentos, celebración de logros y consulta de insignias

import * as api from './api.js';
import * as ui from './ui.js';
import { hayAvatar, cambiarEstado, estadoAvatar } from './avatar.js';

/**
 * Registra un intento de actividad pedagógica, procesa los logros y muestra las celebraciones
 * @param {Object} datos - { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(datos = {}) {
  const resultado = await api.llamar('POST', '/api/intentos', datos);
  await mostrarLogros(resultado);
  return resultado;
}

/**
 * Muestra notificaciones de puntos ganados, modales de celebración por insignias nuevas y actualiza el contador
 * @param {Object} resultado - { puntosGanados, puntosTotales, insigniasNuevas }
 */
export async function mostrarLogros(resultado) {
  if (!resultado || typeof resultado !== 'object') return;

  // 1. Notificación de puntos ganados si son mayores a 0
  if (typeof resultado.puntosGanados === 'number' && resultado.puntosGanados > 0) {
    ui.aviso(`¡Ganaste +${resultado.puntosGanados} punto${resultado.puntosGanados === 1 ? '' : 's'}! 🎉`, 'exito');
  }

  // 2. Actualizar #puntos-usuario en el encabezado
  actualizarPuntosUsuario(resultado.puntosTotales);

  // 3. Modal de celebración por cada insignia nueva
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    // El avatar celebra durante 3 segundos (si la página lo tiene), mientras se muestran las insignias.
    if (hayAvatar()) {
      cambiarEstado('celebrando');
      setTimeout(() => { if (estadoAvatar() === 'celebrando') cambiarEstado('reposo'); }, 3000);
    }
    for (const ins of resultado.insigniasNuevas) {
      if (!ins) continue;
      const contenedor = document.createElement('div');
      contenedor.className = 'celebracion';
      contenedor.innerHTML = `
        <div class="celebracion__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏆')}</div>
        <h3 class="celebracion__titulo">¡Insignia Desbloqueada!</h3>
        <p class="celebracion__nombre">${ui.escapar(ins.nombre || ins.id)}</p>
        ${ins.descripcion ? `<p class="celebracion__desc">${ui.escapar(ins.descripcion)}</p>` : ''}
      `;

      await ui.modal({
        titulo: '¡Felicitaciones!',
        contenido: contenedor,
        acciones: [{ texto: '¡Continuar!', valor: true, clase: 'btn--primario' }]
      });
    }
  }
}

/**
 * Actualiza el elemento #puntos-usuario en la interfaz
 * @param {number} puntos
 */
export function actualizarPuntosUsuario(puntos) {
  if (typeof puntos !== 'number') return;
  const elem = document.getElementById('puntos-usuario');
  if (elem) {
    elem.textContent = `⭐ ${puntos} pts`;
  }
}

/**
 * Obtiene el resumen de logros de un usuario
 * @param {string} usuarioId - "yo" para el usuario en sesión o un ID específico
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  try {
    const res = await api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
    return res || { puntos: 0, insignias: [], nivelQuiz: {} };
  } catch (error) {
    console.warn('Error al obtener logros del usuario:', error);
    return { puntos: 0, insignias: [], nivelQuiz: {} };
  }
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe,
  actualizarPuntosUsuario
};
