// publico/js/modulos/simulaciones.js
// Lista de simulaciones agrupadas por tema; docentes y admin pueden crear y editar

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Simulaciones', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const puedeEditar = usuario?.rol === 'docente' || usuario?.rol === 'admin';

const MODOS = { escenarios: '🔀 Escenarios', rol: '🎭 Juego de rol' };

function tarjeta(s) {
  const id = encodeURIComponent(s.id);
  const borrador = s.estado !== 'publicado';
  return `
    <article class="tarjeta sim-tarjeta">
      <div class="sim-tarjeta__etiquetas">
        <span class="insignia">${MODOS[s.modo] || ui.escapar(s.modo)}</span>
        ${borrador ? '<span class="insignia insignia--acento">Borrador</span>' : ''}
      </div>
      <h3 class="tarjeta__titulo">${ui.escapar(s.titulo)}</h3>
      <div class="sim-tarjeta__acciones">
        ${borrador && !puedeEditar ? '' : `<a class="btn btn--primario btn--pequeno" href="/paginas/simulador.html?id=${id}${borrador ? '&vista=previa' : ''}">${borrador ? 'Previsualizar' : 'Iniciar'}</a>`}
        ${puedeEditar ? `<a class="btn btn--secundario btn--pequeno" href="/paginas/editor-simulacion.html?id=${id}">Editar</a>` : ''}
      </div>
    </article>`;
}

function pintar(simulaciones, temas) {
  const titulos = new Map(temas.map((t) => [t.id, t.titulo]));
  const grupos = new Map();
  for (const s of simulaciones) {
    if (!grupos.has(s.temaId)) grupos.set(s.temaId, []);
    grupos.get(s.temaId).push(s);
  }

  const cabecera = `
    <div class="sim-cabecera">
      <div>
        <h1 class="sim-cabecera__titulo">Simulaciones</h1>
        <p class="sim-cabecera__texto">Practica situaciones reales tomando decisiones y viendo sus consecuencias.</p>
      </div>
      ${puedeEditar ? '<a class="btn btn--primario" href="/paginas/editor-simulacion.html">➕ Nueva</a>' : ''}
    </div>`;

  if (!grupos.size) {
    contenido.innerHTML = `${cabecera}
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">🎭</div>
        <h2 class="vacio__titulo">Aún no hay simulaciones</h2>
        <p class="vacio__texto">${puedeEditar ? 'Crea la primera con el botón "Nueva".' : 'Tu docente publicará simulaciones pronto.'}</p>
      </div>`;
    return;
  }

  contenido.innerHTML = cabecera + [...grupos].map(([temaId, lista]) => `
    <section class="sim-grupo" aria-labelledby="sim-tema-${ui.escapar(temaId)}">
      <h2 class="sim-grupo__titulo" id="sim-tema-${ui.escapar(temaId)}">${ui.escapar(titulos.get(temaId) || 'Tema')}</h2>
      <div class="sim-rejilla">${lista.map(tarjeta).join('')}</div>
    </section>`).join('');
}

try {
  const [simulaciones, temas] = await Promise.all([api.listar('simulaciones'), api.listar('temas')]);
  pintar(simulaciones, temas);
} catch (error) {
  contenido.innerHTML = `<div class="vacio" role="alert"><div class="vacio__icono" aria-hidden="true">⚠️</div><h2 class="vacio__titulo">No se pudieron cargar las simulaciones</h2><p class="vacio__texto">${ui.escapar(error.message || 'Intenta de nuevo.')}</p></div>`;
}
