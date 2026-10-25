// publico/js/modulos/actividades.js
// Controlador para la página general de actividades pedagógicas del ecosistema

import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import * as util from '../nucleo/util.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Actividades', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('temaId');

function iconoParaActividad(id) {
  switch (id) {
    case 'ahorcado': return '🔤';
    case 'canciones': return '🎵';
    case 'pareja': return '🃏';
    case 'sopa-letras': return '🔍';
    case 'crucigrama': return '✏️';
    case 'quiz': return '🧠';
    default: return '🎮';
  }
}

if (contenido) {
  const listaActividades = Array.isArray(ACTIVIDADES) ? ACTIVIDADES : [];

  const tarjetasHtml = listaActividades.map(act => {
    const enlace = temaId ? `${act.href}?temaId=${encodeURIComponent(temaId)}` : act.href;
    const icono = iconoParaActividad(act.id);

    return `
      <article class="tarjeta-catalogo-actividad" id="actividad-${ui.escapar(act.id)}">
        <div class="tarjeta-catalogo-actividad__icono" aria-hidden="true">${icono}</div>
        <div class="tarjeta-catalogo-actividad__cuerpo">
          <h2 class="tarjeta-catalogo-actividad__titulo">${ui.escapar(act.texto)}</h2>
          <p class="tarjeta-catalogo-actividad__descripcion">${ui.escapar(act.descripcion || '')}</p>
        </div>
        <div class="tarjeta-catalogo-actividad__pie">
          <a href="${ui.escapar(enlace)}" class="btn btn--primario">
            Jugar
          </a>
        </div>
      </article>
    `;
  }).join('\n');

  contenido.innerHTML = `
    <header class="actividades-encabezado">
      <h1 class="actividades-encabezado__titulo">Actividades Pedagógicas</h1>
      <p class="actividades-encabezado__subtitulo">
        Fortalece tu aprendizaje jugando, acumulando puntos y desbloqueando insignias académicas.
      </p>
    </header>

    <div class="grid-catalogo-actividades">
      ${tarjetasHtml}
    </div>
  `;
}
