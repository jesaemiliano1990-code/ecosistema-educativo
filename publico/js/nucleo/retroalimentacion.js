// publico/js/nucleo/retroalimentacion.js
// Componentes de retroalimentación pedagógica y resumen interactivo de actividades

import * as ui from './ui.js';

/**
 * Muestra o genera un panel accesible de retroalimentación inmediata
 * @param {Object} params - { correcto, explicacion, sugerencia, enlaceTema, contenedor }
 * @returns {HTMLElement} Elemento .retro generado
 */
export function mostrarRetro({ correcto = false, explicacion = '', sugerencia = '', enlaceTema = '', contenedor = null } = {}) {
  const panel = document.createElement('div');
  panel.className = `retro retro--${correcto ? 'correcto' : 'incorrecto'}`;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');

  panel.innerHTML = `
    <div class="retro__encabezado">
      <span class="retro__icono" aria-hidden="true">${correcto ? '✅' : '❌'}</span>
      <strong class="retro__titulo">${correcto ? '¡Respuesta Correcta!' : 'Respuesta Incorrecta'}</strong>
    </div>

    ${explicacion ? `<p class="retro__explicacion">${ui.escapar(explicacion)}</p>` : ''}
    ${sugerencia ? `<div class="retro__sugerencia"><strong>💡 Sugerencia:</strong> ${ui.escapar(sugerencia)}</div>` : ''}

    ${enlaceTema ? `
      <div class="retro__acciones">
        <a href="${ui.escapar(enlaceTema)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno retro__enlace">
          📖 Repasar el tema
        </a>
      </div>
    ` : ''}
  `;

  if (contenedor) {
    const target = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
    if (target) {
      target.innerHTML = '';
      target.appendChild(panel);
    }
  }

  return panel;
}

/**
 * Muestra un modal de resumen de actividad pedagógica y resuelve "repetir" o "salir"
 * @param {Object} params - { titulo, aciertos, errores, recomendaciones, enlaceTema }
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({ titulo = 'Resumen de la Actividad', aciertos = 0, errores = 0, recomendaciones = '', enlaceTema = '' } = {}) {
  const div = document.createElement('div');
  div.className = 'resumen-retro';

  div.innerHTML = `
    <div class="resumen-retro__stats">
      <div class="resumen-retro__stat resumen-retro__stat--aciertos">
        <span class="resumen-retro__stat-num">${Number(aciertos) || 0}</span>
        <span class="resumen-retro__stat-label">Aciertos</span>
      </div>
      <div class="resumen-retro__stat resumen-retro__stat--errores">
        <span class="resumen-retro__stat-num">${Number(errores) || 0}</span>
        <span class="resumen-retro__stat-label">Errores</span>
      </div>
    </div>

    ${recomendaciones ? `
      <div class="resumen-retro__recomendaciones">
        <h4>💡 Recomendaciones:</h4>
        ${Array.isArray(recomendaciones)
          ? `<ul>${recomendaciones.map(r => `<li>${ui.escapar(r)}</li>`).join('')}</ul>`
          : `<p>${ui.escapar(recomendaciones)}</p>`}
      </div>
    ` : ''}

    ${enlaceTema ? `
      <div class="resumen-retro__repasar">
        <a href="${ui.escapar(enlaceTema)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--bloque">
          📖 Repasar el tema
        </a>
      </div>
    ` : ''}
  `;

  const acciones = [
    { texto: '📖 Repasar el tema', valor: 'repasar', clase: 'btn--secundario' },
    { texto: '🔄 Jugar de nuevo', valor: 'repetir', clase: 'btn--primario' }
  ];

  const resultado = await ui.modal({
    titulo,
    contenido: div,
    acciones
  });

  if (resultado === 'repasar') {
    if (enlaceTema) {
      window.location.href = enlaceTema;
    }
    return 'salir';
  }

  return resultado === 'repetir' ? 'repetir' : 'salir';
}

export default {
  mostrarRetro,
  mostrarResumen
};
