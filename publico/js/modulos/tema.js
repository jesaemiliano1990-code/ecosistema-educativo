// publico/js/modulos/tema.js
// Vista pedagógica de un tema para estudiantes y docentes con marcado de avance y recursos multimedia

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Tema de Aprendizaje', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

if (!temaId) {
  ui.aviso('No se especificó el tema a consultar.', 'error');
  if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Tema no especificado</h2>
        <p class="vacio__texto">Por favor selecciona un tema válido desde tu asignatura.</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario">Ir a Mis Asignaturas</a>
      </div>
    `;
  }
} else if (contenido) {
  contenido.innerHTML = `
    <div class="vista-tema">
      <!-- Migas de pan -->
      <nav aria-label="Migas de pan" class="migas-pan">
        <ol id="migasPanLista">
          <li><a href="/paginas/asignaturas.html">Mis Asignaturas</a></li>
          <li><span id="migaAsignatura">Asignatura</span></li>
          <li><span id="migaUnidad">Unidad</span></li>
          <li aria-current="page"><span id="migaTema">Tema</span></li>
        </ol>
      </nav>

      <!-- Encabezado del tema y botón de revisión -->
      <article class="tarjeta tema-header-card">
        <div class="tema-header-card__top">
          <div>
            <h1 class="tema-header-card__titulo" id="tituloTema">Cargando tema...</h1>
            <div class="tema-header-card__meta" style="margin-top: var(--espacio-xs);">
              <span class="insignia insignia--info" id="badgeDificultad">Dificultad</span>
              <span class="insignia" id="badgeEstadoRevisado">Verificando estado...</span>
            </div>
          </div>
          <div id="contenedorBotonRevisado">
            <button type="button" class="btn btn--primario" id="btnMarcarRevisado">
              Marcar como revisado
            </button>
          </div>
        </div>
      </article>

      <!-- Objetivos de aprendizaje -->
      <section class="tarjeta" id="seccionObjetivos" style="display: none;">
        <h2 class="tarjeta__titulo">🎯 Objetivos de Aprendizaje</h2>
        <ul class="lista-objetivos-estudio" id="listaObjetivos"></ul>
      </section>

      <!-- Resumen conceptual -->
      <section class="tarjeta" id="seccionResumen">
        <h2 class="tarjeta__titulo">📖 Resumen Conceptual</h2>
        <div class="contenido-resumen" id="cuerpoResumen"></div>
      </section>

      <!-- Ejemplos prácticos -->
      <section class="tarjeta" id="seccionEjemplos" style="display: none;">
        <h2 class="tarjeta__titulo">💡 Ejemplos Prácticos</h2>
        <div class="lista-ejemplos-estudio" id="listaEjemplos"></div>
      </section>

      <!-- Recursos multimedia -->
      <section class="tarjeta" id="seccionRecursos" style="display: none;">
        <h2 class="tarjeta__titulo">📚 Recursos y Material de Apoyo</h2>
        <div class="grid-recursos" id="gridRecursos"></div>
      </section>

      <!-- Bloque Practica este tema -->
      <section class="tarjeta practica-bloque" id="seccionPractica">
        <h2 class="tarjeta__titulo">🎮 Practica este Tema</h2>
        <div id="contenedorActividades"></div>
      </section>
    </div>
  `;

  const migaAsignatura = document.getElementById('migaAsignatura');
  const migaUnidad = document.getElementById('migaUnidad');
  const migaTema = document.getElementById('migaTema');

  const tituloTema = document.getElementById('tituloTema');
  const badgeDificultad = document.getElementById('badgeDificultad');
  const badgeEstadoRevisado = document.getElementById('badgeEstadoRevisado');
  const btnMarcarRevisado = document.getElementById('btnMarcarRevisado');

  const seccionObjetivos = document.getElementById('seccionObjetivos');
  const listaObjetivos = document.getElementById('listaObjetivos');

  const seccionResumen = document.getElementById('seccionResumen');
  const cuerpoResumen = document.getElementById('cuerpoResumen');

  const seccionEjemplos = document.getElementById('seccionEjemplos');
  const listaEjemplos = document.getElementById('listaEjemplos');

  const seccionRecursos = document.getElementById('seccionRecursos');
  const gridRecursos = document.getElementById('gridRecursos');

  const contenedorActividades = document.getElementById('contenedorActividades');

  // Función para incrustar recursos: YouTube/Vimeo en iframes, PDF en enlaces, imágenes con alt
  function renderizarRecurso(rec) {
    const url = rec.url || '';
    const titulo = rec.titulo || 'Recurso educativo';
    const tipo = rec.tipo || '';

    // Detección de video YouTube (múltiples formatos de URL)
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
    // Detección de video Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);

    if (tipo === 'video' || ytMatch || vimeoMatch) {
      if (ytMatch) {
        return `
          <article class="recurso-item">
            <h3>${ui.escapar(titulo)}</h3>
            <div class="video-contenedor">
              <iframe src="https://www.youtube.com/embed/${encodeURIComponent(ytMatch[1])}" 
                      title="${ui.escapar(titulo)}" 
                      frameborder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowfullscreen 
                      loading="lazy"></iframe>
            </div>
          </article>
        `;
      }
      if (vimeoMatch) {
        return `
          <article class="recurso-item">
            <h3>${ui.escapar(titulo)}</h3>
            <div class="video-contenedor">
              <iframe src="https://player.vimeo.com/video/${encodeURIComponent(vimeoMatch[1])}" 
                      title="${ui.escapar(titulo)}" 
                      frameborder="0" 
                      allow="autoplay; fullscreen; picture-in-picture" 
                      allowfullscreen 
                      loading="lazy"></iframe>
            </div>
          </article>
        `;
      }
      return `
        <article class="recurso-item">
          <h3>${ui.escapar(titulo)}</h3>
          <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario">
            🎬 Ver video
          </a>
        </article>
      `;
    }

    if (tipo === 'pdf' || url.toLowerCase().endsWith('.pdf')) {
      return `
        <article class="recurso-item">
          <h3>${ui.escapar(titulo)}</h3>
          <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario">
            📄 Descargar o abrir documento PDF
          </a>
        </article>
      `;
    }

    if (tipo === 'imagen' || /\.(jpe?g|png|webp|gif|svg)$/i.test(url)) {
      return `
        <figure class="recurso-item recurso-imagen">
          <img src="${ui.escapar(url)}" alt="${ui.escapar(titulo)}" loading="lazy">
          <figcaption>${ui.escapar(titulo)}</figcaption>
        </figure>
      `;
    }

    // Enlace genérico
    return `
      <article class="recurso-item">
        <h3>${ui.escapar(titulo)}</h3>
        <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto">
          🔗 Visitar enlace de apoyo
        </a>
      </article>
    `;
  }

  async function cargarTema() {
    ui.cargando(true);
    try {
      const [tema, progreso] = await Promise.all([
        api.obtener('temas', temaId),
        api.listar('progreso-temas', { temaId })
      ]);

      // Guardar en localStorage "ultimoTema" = { id, titulo }
      try {
        localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));
      } catch {
        // En caso de que el almacenamiento local no esté accesible
      }

      // Cargar jerarquía para migas de pan
      let unidad = null;
      let asignatura = null;
      if (tema.unidadId) {
        try {
          unidad = await api.obtener('unidades', tema.unidadId);
          if (unidad && unidad.asignaturaId) {
            asignatura = await api.obtener('asignaturas', unidad.asignaturaId);
          }
        } catch {
          // Si no se pueden obtener, se mantienen las migas básicas
        }
      }

      // Renderizar migas de pan
      if (asignatura) {
        migaAsignatura.innerHTML = `<a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${ui.escapar(asignatura.nombre)}</a>`;
      }
      if (unidad) {
        migaUnidad.textContent = unidad.titulo;
      }
      migaTema.textContent = tema.titulo;

      // Encabezado
      tituloTema.textContent = tema.titulo || 'Tema';
      badgeDificultad.textContent = `Dificultad: ${tema.dificultad || 'media'}`;

      // Verificar si ya está revisado por el usuario actual
      const usuario = usuarioActual();
      const yaRevisado = Array.isArray(progreso) && progreso.some(p => p && p.temaId === temaId && (!usuario || !p.usuarioId || p.usuarioId === usuario.id));
      actualizarEstadoRevisado(yaRevisado);

      // Objetivos
      if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
        listaObjetivos.innerHTML = tema.objetivos.map(obj => `<li>${ui.escapar(obj)}</li>`).join('');
        seccionObjetivos.style.display = 'block';
      } else {
        seccionObjetivos.style.display = 'none';
      }

      // Resumen conceptual con util.formatoBasico
      const resumenHtml = util.formatoBasico(tema.resumen || '');
      cuerpoResumen.innerHTML = resumenHtml || '<p><em>Sin resumen disponible.</em></p>';

      // Ejemplos
      if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
        listaEjemplos.innerHTML = tema.ejemplos.map(ej => `
          <div class="ejemplo-item">${ui.escapar(ej)}</div>
        `).join('');
        seccionEjemplos.style.display = 'block';
      } else {
        seccionEjemplos.style.display = 'none';
      }

      // Recursos
      if (Array.isArray(tema.recursos) && tema.recursos.length > 0) {
        gridRecursos.innerHTML = tema.recursos.map(renderizarRecurso).join('');
        seccionRecursos.style.display = 'block';
      } else {
        seccionRecursos.style.display = 'none';
      }

      // Bloque "Practica este tema" con ACTIVIDADES (href + "?temaId=" + id)
      if (Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0) {
        contenedorActividades.innerHTML = `
          <div class="grid-actividades-tema">
            ${ACTIVIDADES.map(act => `
              <article class="tarjeta-actividad">
                <div>
                  <h3>${ui.escapar(act.texto)}</h3>
                  <p>${ui.escapar(act.descripcion || '')}</p>
                </div>
                <a href="${ui.escapar(act.href)}?temaId=${encodeURIComponent(temaId)}" class="btn btn--primario btn--pequeno">
                  Jugar actividad →
                </a>
              </article>
            `).join('')}
          </div>
        `;
      } else {
        contenedorActividades.innerHTML = `
          <p class="campo__ayuda">No hay actividades de gamificación o práctica configuradas actualmente para este tema.</p>
        `;
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar el tema.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function actualizarEstadoRevisado(revisado) {
    if (revisado) {
      badgeEstadoRevisado.className = 'insignia insignia--exito';
      badgeEstadoRevisado.textContent = 'Revisado ✓';
      btnMarcarRevisado.className = 'btn btn--exito';
      btnMarcarRevisado.disabled = true;
      btnMarcarRevisado.textContent = 'Revisado ✓';
    } else {
      badgeEstadoRevisado.className = 'insignia insignia--advertencia';
      badgeEstadoRevisado.textContent = 'Pendiente';
      btnMarcarRevisado.className = 'btn btn--primario';
      btnMarcarRevisado.disabled = false;
      btnMarcarRevisado.textContent = 'Marcar como revisado';
    }
  }

  btnMarcarRevisado.addEventListener('click', async () => {
    ui.cargando(true);
    try {
      await api.crear('progreso-temas', { temaId });
      actualizarEstadoRevisado(true);
      ui.aviso('¡Tema completado y registrado como revisado!', 'exito');
      // Tarea P04.2: Registrar intento de gamificación y mostrar logros obtenidos
      try {
        await registrarIntento({ actividad: 'tema-revisado', temaId, puntaje: 1, maximo: 1 });
      } catch (errGamif) {
        console.warn('Error al registrar intento de gamificación:', errGamif);
      }
    } catch (error) {
      if (error.message && (error.message.includes('Ya existe') || error.message.includes('duplicado') || error.estado === 400)) {
        actualizarEstadoRevisado(true);
        ui.aviso('El tema ya se encuentra registrado como revisado.', 'info');
      } else {
        ui.aviso(error.message || 'Error al marcar el tema como revisado.', 'error');
      }
    } finally {
      ui.cargando(false);
    }
  });

  cargarTema();
}
