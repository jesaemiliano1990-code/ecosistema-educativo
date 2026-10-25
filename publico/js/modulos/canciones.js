// publico/js/modulos/canciones.js
// Catálogo de canciones educativas con reproductor de audio propio y sincronización LRC

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Canciones Educativas', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const temaIdParam = util.parametro('temaId');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

// Función para parsear letra sincronizada LRC [mm:ss.xx]
export function parsearLrc(textoLrc) {
  if (!textoLrc || typeof textoLrc !== 'string') return [];
  const lineas = textoLrc.split(/\r?\n/);
  const resultado = [];
  const regexTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const linea of lineas) {
    const coincidencias = [...linea.matchAll(regexTimestamp)];
    if (coincidencias.length === 0) continue;

    const texto = linea.replace(regexTimestamp, '').trim();

    for (const match of coincidencias) {
      const minutos = parseInt(match[1], 10);
      const segundos = parseInt(match[2], 10);
      let ms = 0;
      if (match[3]) {
        ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      }
      const tiempoSeg = minutos * 60 + segundos + (ms / 1000);
      resultado.push({
        tiempo: tiempoSeg,
        texto: texto
      });
    }
  }

  resultado.sort((a, b) => a.tiempo - b.tiempo);
  return resultado;
}

// Formateador de segundos a mm:ss
function formatearTiempo(segundos) {
  if (isNaN(segundos) || !isFinite(segundos) || segundos < 0) return '00:00';
  const mins = Math.floor(segundos / 60);
  const segs = Math.floor(segundos % 60);
  return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
}

if (contenido) {
  contenido.innerHTML = `
    <div class="canciones-pagina">
      <!-- Encabezado con título y acción para docentes/admin -->
      <header class="canciones-pagina__encabezado">
        <div class="canciones-pagina__titulos">
          <h1>🎵 Canciones Educativas</h1>
          <p>Aprende conceptos pedagógicos con música, rimas y letras sincronizadas.</p>
        </div>
        ${esDocenteOAdmin ? `
          <a href="/paginas/editor-cancion.html${temaIdParam ? '?temaId=' + temaIdParam : ''}" class="btn btn--primario" id="btnNuevaCancion">
            + Nueva canción
          </a>
        ` : ''}
      </header>

      <!-- Barra de Filtros -->
      <section class="canciones-filtros" aria-label="Filtros de canciones">
        <div class="canciones-filtros__grupo">
          <label for="filtroAsignatura">Asignatura:</label>
          <select id="filtroAsignatura">
            <option value="">Todas mis asignaturas</option>
          </select>
        </div>

        <div class="canciones-filtros__grupo">
          <label for="filtroTema">Tema pedagógico:</label>
          <select id="filtroTema">
            <option value="">Todos los temas</option>
          </select>
        </div>
      </section>

      <!-- Grid Principal: Lista y Reproductor con Letra -->
      <div class="canciones-grid">
        <!-- Columna 1: Lista de Canciones -->
        <section class="canciones-lista" id="listaCanciones" aria-label="Lista de canciones">
          <div class="canciones-lista__vacia tarjeta">
            <p>Cargando canciones...</p>
          </div>
        </section>

        <!-- Columna 2: Reproductor propio y Letra / LRC -->
        <aside class="reproductor-seccion">
          <!-- Tarjeta del Reproductor -->
          <div class="reproductor-card" id="reproductorCard" tabindex="0" aria-label="Reproductor de audio">
            <!-- Elemento de audio nativo oculto -->
            <audio id="audioElement" preload="metadata"></audio>

            <div class="reproductor-card__cabecera">
              <div class="reproductor-disco" id="reproductorDisco" aria-hidden="true">
                💿
              </div>
              <div class="reproductor-card__titulos">
                <h2 class="reproductor-card__titulo" id="repTitulo">Selecciona una canción</h2>
                <p class="reproductor-card__subtitulo" id="repSubtitulo">Elige un tema del catálogo para comenzar</p>
              </div>
            </div>

            <!-- Progreso y tiempos -->
            <div class="reproductor-card__progreso-box">
              <input
                type="range"
                id="barraProgreso"
                class="reproductor__barra-rango"
                min="0"
                max="100"
                value="0"
                step="0.1"
                aria-label="Barra de progreso de audio"
              >
              <div class="reproductor-card__tiempos">
                <span id="tiempoActual">00:00</span>
                <span id="tiempoTotal">00:00</span>
              </div>
            </div>

            <!-- Controles de Reproducción -->
            <div class="reproductor-card__controles">
              <button type="button" class="reproductor-btn-sec" id="btnRetroceder" title="Retroceder 5 segundos" aria-label="Retroceder 5 segundos">
                ⏪ 5s
              </button>
              <button type="button" class="reproductor-btn-play" id="btnPlayPause" title="Reproducir o pausar" aria-label="Reproducir">
                ▶
              </button>
              <button type="button" class="reproductor-btn-sec" id="btnAdelantar" title="Adelantar 5 segundos" aria-label="Adelantar 5 segundos">
                5s ⏩
              </button>
            </div>

            <!-- Fila de Volumen -->
            <div class="reproductor-card__volumen-fila">
              <button type="button" class="reproductor-btn-vol" id="btnMute" title="Silenciar o activar sonido" aria-label="Silenciar">
                🔊
              </button>
              <input
                type="range"
                id="barraVolumen"
                class="reproductor__barra-volumen"
                min="0"
                max="1"
                step="0.05"
                value="1"
                aria-label="Control de volumen"
              >
            </div>
          </div>

          <!-- Panel de Letra -->
          <div class="panel-letra">
            <div class="panel-letra__cabecera">
              <h2>📜 Letra</h2>
              <span id="badgeTipoLetra" class="insignia insignia--secundario" style="display: none;"></span>
            </div>
            <div class="panel-letra__cuerpo" id="panelLetraCuerpo">
              <div class="panel-letra__sin-letra">
                Selecciona una canción para visualizar la letra o seguirla sincronizada con la música.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Referencias a elementos
  const filtroAsignatura = document.getElementById('filtroAsignatura');
  const filtroTema = document.getElementById('filtroTema');
  const listaCanciones = document.getElementById('listaCanciones');
  const btnNuevaCancion = document.getElementById('btnNuevaCancion');

  // Reproductor
  const audio = document.getElementById('audioElement');
  const reproductorDisco = document.getElementById('reproductorDisco');
  const repTitulo = document.getElementById('repTitulo');
  const repSubtitulo = document.getElementById('repSubtitulo');
  const barraProgreso = document.getElementById('barraProgreso');
  const tiempoActual = document.getElementById('tiempoActual');
  const tiempoTotal = document.getElementById('tiempoTotal');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnRetroceder = document.getElementById('btnRetroceder');
  const btnAdelantar = document.getElementById('btnAdelantar');
  const btnMute = document.getElementById('btnMute');
  const barraVolumen = document.getElementById('barraVolumen');

  // Letra
  const badgeTipoLetra = document.getElementById('badgeTipoLetra');
  const panelLetraCuerpo = document.getElementById('panelLetraCuerpo');

  // Estado local
  let todasCanciones = [];
  let todasAsignaturas = [];
  let todasUnidades = [];
  let todosTemas = [];
  let cancionActual = null;
  let lineasLrc = [];
  let indiceLineaActiva = -1;
  let ultimoVolumen = 1;

  // Carga inicial
  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [canciones, temas, unidades, asignaturas] = await Promise.all([
        api.listar('canciones'),
        api.listar('temas'),
        api.listar('unidades'),
        api.listar('asignaturas')
      ]);

      todasCanciones = Array.isArray(canciones) ? canciones : [];
      todosTemas = Array.isArray(temas) ? temas : [];
      todasUnidades = Array.isArray(unidades) ? unidades : [];
      todasAsignaturas = Array.isArray(asignaturas) ? asignaturas : [];

      poblarSelectores();
      aplicarFiltrosYRenderizar();
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar canciones.', 'error');
      listaCanciones.innerHTML = `
        <div class="tarjeta canciones-lista__vacia">
          <p>No fue posible cargar el catálogo de canciones.</p>
        </div>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  function poblarSelectores() {
    // 1. Asignaturas
    filtroAsignatura.innerHTML = '<option value="">Todas mis asignaturas</option>';
    todasAsignaturas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nombre;
      filtroAsignatura.appendChild(opt);
    });

    // Si viene temaIdParam en la URL, determinar asignatura correspondiente
    if (temaIdParam) {
      const tParam = todosTemas.find(t => t.id === temaIdParam);
      if (tParam) {
        const uParam = todasUnidades.find(u => u.id === tParam.unidadId);
        if (uParam && uParam.asignaturaId) {
          filtroAsignatura.value = uParam.asignaturaId;
        }
      }
    }

    actualizarOpcionesTemas();

    if (temaIdParam) {
      filtroTema.value = temaIdParam;
      actualizarEnlaceNuevaCancion();
    }
  }

  function actualizarOpcionesTemas() {
    const asigSeleccionada = filtroAsignatura.value;
    filtroTema.innerHTML = '<option value="">Todos los temas</option>';

    // Unidades de la asignatura seleccionada
    const unidadesValidas = asigSeleccionada
      ? new Set(todasUnidades.filter(u => u.asignaturaId === asigSeleccionada).map(u => u.id))
      : null;

    todosTemas.forEach(t => {
      if (!unidadesValidas || unidadesValidas.has(t.unidadId)) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.titulo;
        filtroTema.appendChild(opt);
      }
    });

    actualizarEnlaceNuevaCancion();
  }

  function actualizarEnlaceNuevaCancion() {
    if (!btnNuevaCancion) return;
    const tVal = filtroTema.value;
    btnNuevaCancion.href = `/paginas/editor-cancion.html${tVal ? '?temaId=' + encodeURIComponent(tVal) : ''}`;
  }

  // Filtrado de canciones
  function obtenerCancionesFiltradas() {
    const asigId = filtroAsignatura.value;
    const temaId = filtroTema.value;

    const unidadMap = new Map(todasUnidades.map(u => [u.id, u.asignaturaId]));
    const temaAsigMap = new Map(todosTemas.map(t => [t.id, unidadMap.get(t.unidadId)]));

    return todasCanciones.filter(c => {
      if (!c) return false;
      if (temaId && c.temaId !== temaId) return false;
      if (asigId && temaAsigMap.get(c.temaId) !== asigId) return false;
      return true;
    });
  }

  function aplicarFiltrosYRenderizar() {
    const filtradas = obtenerCancionesFiltradas();
    renderizarListaCanciones(filtradas);
  }

  function renderizarListaCanciones(canciones) {
    if (canciones.length === 0) {
      listaCanciones.innerHTML = `
        <div class="tarjeta canciones-lista__vacia">
          <h3>No hay canciones disponibles</h3>
          <p>No se encontraron canciones para el tema o asignatura seleccionada.</p>
          ${esDocenteOAdmin ? `
            <a href="/paginas/editor-cancion.html${filtroTema.value ? '?temaId=' + filtroTema.value : ''}" class="btn btn--secundario">
              + Agregar primera canción
            </a>
          ` : ''}
        </div>
      `;
      return;
    }

    const temaMap = new Map(todosTemas.map(t => [t.id, t.titulo]));

    listaCanciones.innerHTML = canciones.map(c => {
      const temaNombre = temaMap.get(c.temaId) || 'Tema educativo';
      const esLaActual = cancionActual && cancionActual.id === c.id;
      const estaSonando = esLaActual && !audio.paused;

      return `
        <article class="tarjeta-cancion ${esLaActual ? 'tarjeta-cancion--activa' : ''}" data-id="${c.id}">
          <div class="tarjeta-cancion__info">
            <button
              type="button"
              class="tarjeta-cancion__icono-btn btn-reproducir-cancion"
              data-id="${c.id}"
              aria-label="${estaSonando ? 'Pausar ' + ui.escapar(c.titulo) : 'Reproducir ' + ui.escapar(c.titulo)}"
            >
              ${estaSonando ? '⏸' : '▶'}
            </button>
            <div class="tarjeta-cancion__textos">
              <h3 class="tarjeta-cancion__titulo">${ui.escapar(c.titulo)}</h3>
              <div class="tarjeta-cancion__metas">
                <span>📖 ${ui.escapar(temaNombre)}</span>
                <span>•</span>
                <span>👤 ${ui.escapar(c.autoria || 'Autor desconocido')}</span>
                <span class="insignia insignia--info">${ui.escapar(c.licencia || 'Licencia estándar')}</span>
                ${c.lrc ? '<span class="insignia insignia--exito">LRC Sincronizada</span>' : ''}
              </div>
            </div>
          </div>
          <div class="tarjeta-cancion__acciones">
            ${esDocenteOAdmin ? `
              <a href="/paginas/editor-cancion.html?id=${c.id}" class="btn btn--secundario" title="Editar canción">
                ✏️ Editar
              </a>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    // Eventos de reproducción en la lista
    listaCanciones.querySelectorAll('.btn-reproducir-cancion').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-id');
        const c = todasCanciones.find(item => item.id === cid);
        if (!c) return;

        if (cancionActual && cancionActual.id === c.id) {
          togglePlayPause();
        } else {
          cargarCancion(c, true);
        }
      });
    });
  }

  // Cargar canción en el reproductor
  function cargarCancion(cancion, reproducirAuto = false) {
    cancionActual = cancion;
    audio.src = cancion.audio;
    audio.load();

    const temaMap = new Map(todosTemas.map(t => [t.id, t.titulo]));
    const nombreTema = temaMap.get(cancion.temaId) || 'Tema pedagógico';

    repTitulo.textContent = cancion.titulo;
    repSubtitulo.textContent = `${cancion.autoria || 'Autoría'} · ${nombreTema}`;

    barraProgreso.value = 0;
    tiempoActual.textContent = '00:00';
    tiempoTotal.textContent = '00:00';

    // Montar letra
    lineasLrc = [];
    indiceLineaActiva = -1;

    if (cancion.lrc && cancion.lrc.trim()) {
      badgeTipoLetra.textContent = 'Sincronizada (LRC)';
      badgeTipoLetra.className = 'insignia insignia--exito';
      badgeTipoLetra.style.display = 'inline-flex';

      lineasLrc = parsearLrc(cancion.lrc);
      if (lineasLrc.length > 0) {
        panelLetraCuerpo.innerHTML = lineasLrc.map((item, idx) => `
          <div class="reproductor__linea-lrc" data-idx="${idx}" data-tiempo="${item.tiempo}">
            ${ui.escapar(item.texto || '...')}
          </div>
        `).join('');

        // Clic en línea LRC para saltar a ese tiempo
        panelLetraCuerpo.querySelectorAll('.reproductor__linea-lrc').forEach(el => {
          el.addEventListener('click', () => {
            const t = parseFloat(el.getAttribute('data-tiempo'));
            if (!isNaN(t)) {
              audio.currentTime = t;
              if (audio.paused) audio.play();
            }
          });
        });
      } else {
        // Fallback a texto si no se extrajeron marcas
        panelLetraCuerpo.innerHTML = `<div class="panel-letra__estatica">${ui.escapar(cancion.letra || cancion.lrc)}</div>`;
      }
    } else if (cancion.letra && cancion.letra.trim()) {
      badgeTipoLetra.textContent = 'Letra completa';
      badgeTipoLetra.className = 'insignia insignia--secundario';
      badgeTipoLetra.style.display = 'inline-flex';
      panelLetraCuerpo.innerHTML = `<div class="panel-letra__estatica">${ui.escapar(cancion.letra)}</div>`;
    } else {
      badgeTipoLetra.style.display = 'none';
      panelLetraCuerpo.innerHTML = `<div class="panel-letra__sin-letra">Esta canción no tiene letra registrada.</div>`;
    }

    aplicarFiltrosYRenderizar();

    if (reproducirAuto) {
      audio.play().catch(e => console.warn('Autoplay bloqueado:', e));
    }
  }

  // Reproducir o pausar
  function togglePlayPause() {
    if (!cancionActual) {
      const filtradas = obtenerCancionesFiltradas();
      if (filtradas.length > 0) {
        cargarCancion(filtradas[0], true);
      }
      return;
    }

    if (audio.paused) {
      audio.play().catch(e => console.warn('Error al reproducir audio:', e));
    } else {
      audio.pause();
    }
  }

  // Eventos de controles
  btnPlayPause.addEventListener('click', togglePlayPause);

  btnRetroceder.addEventListener('click', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  btnAdelantar.addEventListener('click', () => {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  });

  // Barra de progreso operable con teclado y mouse
  barraProgreso.addEventListener('input', () => {
    if (audio.duration) {
      audio.currentTime = (barraProgreso.value / 100) * audio.duration;
    }
  });

  // Volumen
  barraVolumen.addEventListener('input', () => {
    audio.volume = parseFloat(barraVolumen.value);
    audio.muted = (audio.volume === 0);
    btnMute.textContent = audio.muted ? '🔇' : '🔊';
  });

  btnMute.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = ultimoVolumen || 1;
      barraVolumen.value = audio.volume;
      btnMute.textContent = '🔊';
    } else {
      ultimoVolumen = audio.volume;
      audio.muted = true;
      barraVolumen.value = 0;
      btnMute.textContent = '🔇';
    }
  });

  // Eventos del elemento HTML5 Audio
  audio.addEventListener('play', () => {
    btnPlayPause.textContent = '⏸';
    btnPlayPause.setAttribute('aria-label', 'Pausar');
    reproductorDisco.classList.add('reproductor-disco--reproduciendo');
    aplicarFiltrosYRenderizar();
  });

  audio.addEventListener('pause', () => {
    btnPlayPause.textContent = '▶';
    btnPlayPause.setAttribute('aria-label', 'Reproducir');
    reproductorDisco.classList.remove('reproductor-disco--reproduciendo');
    aplicarFiltrosYRenderizar();
  });

  audio.addEventListener('loadedmetadata', () => {
    tiempoTotal.textContent = formatearTiempo(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      barraProgreso.value = (audio.currentTime / audio.duration) * 100;
    }
    tiempoActual.textContent = formatearTiempo(audio.currentTime);

    // Sincronización LRC
    if (lineasLrc.length > 0) {
      const tiempoCur = audio.currentTime;
      let nuevoIndice = -1;
      for (let i = 0; i < lineasLrc.length; i++) {
        if (lineasLrc[i].tiempo <= tiempoCur) {
          nuevoIndice = i;
        } else {
          break;
        }
      }

      if (nuevoIndice !== indiceLineaActiva) {
        indiceLineaActiva = nuevoIndice;
        const lineasDom = panelLetraCuerpo.querySelectorAll('.reproductor__linea-lrc');
        lineasDom.forEach((el, idx) => {
          if (idx === nuevoIndice) {
            el.classList.add('reproductor__linea-lrc--activa');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            el.classList.remove('reproductor__linea-lrc--activa');
          }
        });
      }
    }
  });

  audio.addEventListener('ended', () => {
    btnPlayPause.textContent = '▶';
    reproductorDisco.classList.remove('reproductor-disco--reproduciendo');
    barraProgreso.value = 0;
    aplicarFiltrosYRenderizar();
  });

  // Accesibilidad por teclado: atajos globales cuando no se está en inputs
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      audio.volume = Math.min(1, audio.volume + 0.05);
      barraVolumen.value = audio.volume;
      btnMute.textContent = '🔊';
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      audio.volume = Math.max(0, audio.volume - 0.05);
      barraVolumen.value = audio.volume;
      if (audio.volume === 0) btnMute.textContent = '🔇';
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      btnMute.click();
    }
  });

  // Eventos de filtros
  filtroAsignatura.addEventListener('change', () => {
    actualizarOpcionesTemas();
    aplicarFiltrosYRenderizar();
  });

  filtroTema.addEventListener('change', () => {
    actualizarEnlaceNuevaCancion();
    aplicarFiltrosYRenderizar();
  });

  cargarDatos();
}
