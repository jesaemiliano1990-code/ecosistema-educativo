// publico/js/modulos/sopa-letras.js
// Juego pedagógico Sopa de Letras con selección táctil/ratón mediante Pointer Events, definiciones y gamificación

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';

if (typeof window !== 'undefined') {
  await montarPlantilla({ titulo: 'Sopa de Letras', roles: ['estudiante', 'docente'] });
}

const CONFIG_DIFICULTAD = {
  facil: {
    nombre: 'Fácil (10×10, 8 palabras)',
    tamano: 10,
    maxPalabras: 8,
    direcciones: [[1, 0], [0, 1]] // Horizontal y vertical
  },
  media: {
    nombre: 'Media (12×12, 10 palabras)',
    tamano: 12,
    maxPalabras: 10,
    direcciones: [[1, 0], [0, 1], [1, 1], [1, -1]] // Horizontal, vertical y diagonales
  },
  dificil: {
    nombre: 'Difícil (15×15, 12 palabras)',
    tamano: 15,
    maxPalabras: 12,
    // 8 direcciones: horizontal, vertical, diagonales e invertidas
    direcciones: [
      [1, 0], [-1, 0],
      [0, 1], [0, -1],
      [1, 1], [-1, -1],
      [1, -1], [-1, 1]
    ]
  }
};

/**
 * Función pura exportada para generar la sopa de letras
 * @param {Array<string|Object>} palabras - Lista de palabras candidatas
 * @param {number} tamano - Tamaño N de la cuadrícula (N×N)
 * @param {Array<Array<number>>} direcciones - Direcciones [dx, dy] permitidas
 * @returns {{ grilla: Array<Array<string>>, ubicaciones: Array<Object> }}
 */
export function generarSopa(palabras = [], tamano = 10, direcciones = [[1, 0], [0, 1]]) {
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(''));
  const ubicaciones = [];

  // 1. Normalizar y filtrar palabras de una sola palabra con longitud válida
  const palabrasLimpias = palabras
    .map(p => (typeof p === 'string' ? p : p?.palabra || p?.termino || ''))
    .map(p => util.normalizar(p))
    .filter(p => p.length >= 3 && p.length <= tamano && !/\s/.test(p));

  // Eliminar duplicados si los hubiera
  const unicas = Array.from(new Set(palabrasLimpias));

  // 2. Ordenar de la más larga a la más corta
  const ordenadas = [...unicas].sort((a, b) => b.length - a.length);

  // 3. Colocar palabras con hasta 200 intentos por palabra
  for (const palabra of ordenadas) {
    const L = palabra.length;
    let colocada = false;

    for (let intento = 0; intento < 200; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const dx = Array.isArray(dir) ? dir[0] : (dir?.dx ?? 1);
      const dy = Array.isArray(dir) ? dir[1] : (dir?.dy ?? 0);

      let minFila = 0, maxFila = tamano - 1;
      let minCol = 0, maxCol = tamano - 1;

      if (dy > 0) maxFila = tamano - L;
      else if (dy < 0) minFila = L - 1;

      if (dx > 0) maxCol = tamano - L;
      else if (dx < 0) minCol = L - 1;

      if (minFila > maxFila || minCol > maxCol) continue;

      const fInicio = minFila + Math.floor(Math.random() * (maxFila - minFila + 1));
      const cInicio = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));

      // Verificar que quepa y permita cruces con letras idénticas
      let cabe = true;
      const celdas = [];

      for (let i = 0; i < L; i++) {
        const r = fInicio + i * dy;
        const c = cInicio + i * dx;

        if (r < 0 || r >= tamano || c < 0 || c >= tamano) {
          cabe = false;
          break;
        }

        const actual = grilla[r][c];
        const letra = palabra[i];

        if (actual !== '' && actual !== letra) {
          cabe = false;
          break;
        }

        celdas.push({ fila: r, col: c, letra });
      }

      if (cabe) {
        for (const celda of celdas) {
          grilla[celda.fila][celda.col] = celda.letra;
        }

        ubicaciones.push({
          palabra,
          filaInicio: fInicio,
          colInicio: cInicio,
          filaFin: fInicio + (L - 1) * dy,
          colFin: cInicio + (L - 1) * dx,
          dx,
          dy,
          celdas,
          encontrada: false
        });

        colocada = true;
        break;
      }
    }
  }

  // 4. Rellenar celdas vacías con letras aleatorias A-Z y Ñ
  const ALFABETO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  for (let r = 0; r < tamano; r++) {
    for (let c = 0; c < tamano; c++) {
      if (!grilla[r][c]) {
        grilla[r][c] = ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

// Variables de estado del módulo
const contenido = typeof document !== 'undefined' ? document.getElementById('contenido') : null;
let temaActual = null;
let terminosGlosario = [];
let dificultadClave = 'facil';

let grillaActual = [];
let ubicacionesActuales = [];
let partidaTerminada = false;
let inicioJuego = 0;
let tiempoSegundos = 0;
let cronometroInterval = null;

// Variables de Pointer Events
let isSelecting = false;
let startFila = -1;
let startCol = -1;
let celdasSeleccionadas = [];

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function actualizarCronometro() {
  const elem = document.getElementById('cronometroSopa');
  if (elem) {
    elem.textContent = formatearTiempo(tiempoSegundos);
  }
}

function actualizarMarcador() {
  const elem = document.getElementById('marcadorEncontradas');
  if (elem) {
    const encontradas = ubicacionesActuales.filter(u => u.encontrada).length;
    elem.textContent = `${encontradas} / ${ubicacionesActuales.length}`;
  }
}

function generarVistaHtml() {
  const conf = CONFIG_DIFICULTAD[dificultadClave] || CONFIG_DIFICULTAD.facil;
  const encontradas = ubicacionesActuales.filter(u => u.encontrada).length;

  return `
    <div class="sopa-vista">
      <!-- Cabecera -->
      <div class="sopa-cabecera">
        <div class="sopa-cabecera__info">
          <h1 class="sopa-cabecera__titulo">Sopa de Letras</h1>
          <p class="sopa-cabecera__tema">
            Tema: <strong>${ui.escapar(temaActual.titulo)}</strong>
          </p>
        </div>
        <div class="sopa-cabecera__acciones">
          <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">
            🔍 Cambiar tema
          </button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto btn--pequeno">
            📖 Ver tema
          </a>
        </div>
      </div>

      <!-- Barra de control y estadísticas -->
      <div class="sopa-marcador">
        <div class="sopa-marcador__dificultad">
          <label for="selDificultadSopa">Dificultad:</label>
          <select id="selDificultadSopa" aria-label="Seleccionar dificultad de la sopa de letras">
            <option value="facil" ${dificultadClave === 'facil' ? 'selected' : ''}>Fácil (10×10, 8 pal.)</option>
            <option value="media" ${dificultadClave === 'media' ? 'selected' : ''}>Media (12×12, 10 pal.)</option>
            <option value="dificil" ${dificultadClave === 'dificil' ? 'selected' : ''}>Difícil (15×15, 12 pal.)</option>
          </select>
          <button type="button" id="btnReiniciarSopa" class="btn btn--secundario btn--pequeno" title="Nueva sopa de letras">
            🔄 Nueva sopa
          </button>
          <button type="button" id="btnRendirseSopa" class="btn btn--peligro btn--pequeno" ${partidaTerminada ? 'disabled' : ''} title="Revelar palabras no encontradas">
            🏳️ Rendirse
          </button>
        </div>

        <div class="sopa-marcador__stats" aria-live="polite">
          <div class="sopa-stat">
            <span class="sopa-stat__valor" id="cronometroSopa">${formatearTiempo(tiempoSegundos)}</span>
            <span class="sopa-stat__etiqueta">Tiempo</span>
          </div>
          <div class="sopa-stat">
            <span class="sopa-stat__valor" id="marcadorEncontradas">${encontradas} / ${ubicacionesActuales.length}</span>
            <span class="sopa-stat__etiqueta">Encontradas</span>
          </div>
        </div>
      </div>

      <!-- Tablero central: Grilla y Palabras -->
      <div class="sopa-tablero">
        <!-- Grilla de letras con Pointer Events y touch-action: none -->
        <div class="sopa-grilla-contenedor">
          <div class="sopa-grilla"
               id="sopaGrilla"
               style="--grilla-tamano: ${conf.tamano}; touch-action: none;"
               role="grid"
               aria-label="Cuadrícula interactiva de sopa de letras de ${conf.tamano} por ${conf.tamano}">
            ${grillaActual.map((fila, r) => fila.map((letra, c) => `
              <div class="sopa-celda"
                   data-fila="${r}"
                   data-col="${c}"
                   role="gridcell"
                   aria-label="Fila ${r + 1}, Columna ${c + 1}: ${letra}">
                ${ui.escapar(letra)}
              </div>
            `).join('')).join('')}
          </div>
        </div>

        <!-- Panel lateral: Lista de palabras -->
        <aside class="sopa-panel-palabras" aria-label="Palabras a encontrar">
          <h2 class="sopa-panel-palabras__titulo">
            <span>Palabras ocultas</span>
            <span class="insignia insignia--info">${ubicacionesActuales.length}</span>
          </h2>
          <ul class="sopa-lista-palabras" id="listaPalabrasSopa">
            ${ubicacionesActuales.map(u => {
              const tachada = u.encontrada ? 'sopa-palabra-item--tachada' : '';
              const revelada = u.revelada && !u.encontrada ? 'sopa-palabra-item--revelada' : '';
              return `
                <li class="sopa-palabra-item ${tachada} ${revelada}" id="item-${ui.escapar(u.palabra)}">
                  ${u.encontrada ? '✓ ' : ''}${ui.escapar(u.palabra)}
                </li>
              `;
            }).join('')}
          </ul>
        </aside>
      </div>

      <!-- Panel de retroalimentación pedagógica inmediata -->
      <div class="sopa-retroalimentacion" id="contenedorRetro"></div>
    </div>
  `;
}

function resaltarCeldasSeleccionadas() {
  // Limpiar resaltado previo
  document.querySelectorAll('.sopa-celda--seleccionando').forEach(el => {
    el.classList.remove('sopa-celda--seleccionando');
  });

  // Aplicar a las celdas en la línea actual
  for (const c of celdasSeleccionadas) {
    const el = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
    if (el) {
      el.classList.add('sopa-celda--seleccionando');
    }
  }
}

function limpiarResaltadoSeleccion() {
  document.querySelectorAll('.sopa-celda--seleccionando').forEach(el => {
    el.classList.remove('sopa-celda--seleccionando');
  });
  celdasSeleccionadas = [];
}

function verificarPalabraSeleccionada() {
  if (celdasSeleccionadas.length < 2) return;

  const texto = celdasSeleccionadas.map(c => grillaActual[c.fila][c.col]).join('');
  const textoInverso = texto.split('').reverse().join('');

  // Buscar coincidencia en ubicaciones pendientes
  const match = ubicacionesActuales.find(u => {
    if (u.encontrada) return false;
    const coincideTexto = (u.palabra === texto || u.palabra === textoInverso);
    if (!coincideTexto) return false;
    if (u.celdas.length !== celdasSeleccionadas.length) return false;

    // Verificar extremos de celda
    const inicio = celdasSeleccionadas[0];
    const fin = celdasSeleccionadas[celdasSeleccionadas.length - 1];

    const directo = (u.filaInicio === inicio.fila && u.colInicio === inicio.col && u.filaFin === fin.fila && u.colFin === fin.col);
    const inverso = (u.filaInicio === fin.fila && u.colInicio === fin.col && u.filaFin === inicio.fila && u.colFin === inicio.col);

    return directo || inverso;
  });

  if (match) {
    match.encontrada = true;

    // Marcar celdas permanentemente en la grilla
    for (const c of match.celdas) {
      const el = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
      if (el) {
        el.classList.add('sopa-celda--encontrada');
      }
    }

    // Tachar en la lista
    const itemEl = document.getElementById(`item-${match.palabra}`);
    if (itemEl) {
      itemEl.classList.add('sopa-palabra-item--tachada');
      itemEl.textContent = `✓ ${match.palabra}`;
    }

    actualizarMarcador();
    ui.aviso(`¡Encontraste "${match.palabra}"! 🎉`, 'exito');

    // Desplegar retroalimentación pedagógica con la definición del término
    const termObj = terminosGlosario.find(t => util.normalizar(t.termino) === match.palabra);
    if (termObj) {
      mostrarRetro({
        correcto: true,
        explicacion: `¡Correcto! ${termObj.termino}: ${termObj.definicion}`,
        sugerencia: termObj.retroalimentacion || '',
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
        contenedor: '#contenedorRetro'
      });
    }

    // Verificar si encontró todas
    if (ubicacionesActuales.every(u => u.encontrada)) {
      finalizarPartida(true);
    }
  }
}

async function finalizarPartida(completada = true) {
  partidaTerminada = true;
  if (cronometroInterval) {
    clearInterval(cronometroInterval);
    cronometroInterval = null;
  }

  const btnRendirse = document.getElementById('btnRendirseSopa');
  if (btnRendirse) btnRendirse.disabled = true;

  const total = ubicacionesActuales.length;
  const encontradas = ubicacionesActuales.filter(u => u.encontrada).length;
  const errores = total - encontradas;
  const duracionSeg = Math.max(1, Math.round((Date.now() - inicioJuego) / 1000));

  // 1. Registrar intento en el motor de gamificación
  try {
    await registrarIntento({
      actividad: 'sopa-letras',
      temaId: temaActual.id,
      puntaje: encontradas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.warn('Error al registrar intento de sopa de letras:', err);
  }

  // 2. Mostrar modal de resumen
  const recomendacion = completada && errores === 0
    ? '¡Excelente! Encontraste todos los términos con gran rapidez y precisión.'
    : `Encontraste ${encontradas} de ${total} conceptos. Sigue ejercitando la lectura de términos clave.`;

  const decision = await mostrarResumen({
    titulo: completada && errores === 0 ? '¡Sopa de Letras Completada! 🏆' : 'Fin de la Partida',
    aciertos: encontradas,
    errores,
    recomendaciones: [recomendacion, `Tiempo empleado: ${formatearTiempo(duracionSeg)}`],
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
  });

  if (decision === 'repetir') {
    iniciarPartida();
  }
}

function iniciarPartida() {
  if (cronometroInterval) {
    clearInterval(cronometroInterval);
    cronometroInterval = null;
  }

  const conf = CONFIG_DIFICULTAD[dificultadClave] || CONFIG_DIFICULTAD.facil;

  // Filtrar palabras válidas del glosario
  const palabrasCandidatas = terminosGlosario
    .map(t => util.normalizar(t.termino))
    .filter(t => t.length >= 3 && t.length <= conf.tamano && !/\s/.test(t));

  // Seleccionar hasta maxPalabras barajadas
  const seleccion = util.barajar(palabrasCandidatas).slice(0, conf.maxPalabras);

  // Generar cuadrícula con la función pura exportada
  const resultado = generarSopa(seleccion, conf.tamano, conf.direcciones);
  grillaActual = resultado.grilla;
  ubicacionesActuales = resultado.ubicaciones;

  partidaTerminada = false;
  tiempoSegundos = 0;
  inicioJuego = Date.now();

  // Iniciar cronómetro
  cronometroInterval = setInterval(() => {
    tiempoSegundos++;
    actualizarCronometro();
  }, 1000);

  if (contenido) {
    contenido.innerHTML = generarVistaHtml();
    asignarEventos();
  }
}

function asignarEventos() {
  const grillaEl = document.getElementById('sopaGrilla');

  if (grillaEl) {
    grillaEl.addEventListener('pointerdown', (e) => {
      if (partidaTerminada) return;
      const celda = e.target.closest('.sopa-celda');
      if (!celda) return;

      e.preventDefault();
      try {
        grillaEl.setPointerCapture(e.pointerId);
      } catch {}

      isSelecting = true;
      startFila = parseInt(celda.dataset.fila, 10);
      startCol = parseInt(celda.dataset.col, 10);
      celdasSeleccionadas = [{ fila: startFila, col: startCol }];
      resaltarCeldasSeleccionadas();
    });

    grillaEl.addEventListener('pointermove', (e) => {
      if (!isSelecting || partidaTerminada) return;
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const celda = elem ? elem.closest('.sopa-celda') : null;
      if (!celda) return;

      const currFila = parseInt(celda.dataset.fila, 10);
      const currCol = parseInt(celda.dataset.col, 10);

      const dFila = currFila - startFila;
      const dCol = currCol - startCol;
      const absFila = Math.abs(dFila);
      const absCol = Math.abs(dCol);

      let esLineaRecta = false;
      let stepF = 0;
      let stepC = 0;
      let pasos = 0;

      if (dFila === 0 && dCol !== 0) {
        esLineaRecta = true;
        stepF = 0;
        stepC = Math.sign(dCol);
        pasos = absCol;
      } else if (dCol === 0 && dFila !== 0) {
        esLineaRecta = true;
        stepF = Math.sign(dFila);
        stepC = 0;
        pasos = absFila;
      } else if (absFila === absCol && absFila !== 0) {
        esLineaRecta = true;
        stepF = Math.sign(dFila);
        stepC = Math.sign(dCol);
        pasos = absFila;
      } else if (dFila === 0 && dCol === 0) {
        esLineaRecta = true;
        pasos = 0;
      }

      if (esLineaRecta) {
        const nuevaSeleccion = [];
        for (let i = 0; i <= pasos; i++) {
          nuevaSeleccion.push({
            fila: startFila + i * stepF,
            col: startCol + i * stepC
          });
        }
        celdasSeleccionadas = nuevaSeleccion;
        resaltarCeldasSeleccionadas();
      }
    });

    const finalizarSeleccion = (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      try {
        if (grillaEl.hasPointerCapture && grillaEl.hasPointerCapture(e.pointerId)) {
          grillaEl.releasePointerCapture(e.pointerId);
        }
      } catch {}

      verificarPalabraSeleccionada();
      limpiarResaltadoSeleccion();
    };

    grillaEl.addEventListener('pointerup', finalizarSeleccion);
    grillaEl.addEventListener('pointercancel', finalizarSeleccion);
  }

  // Selector de dificultad
  const selDif = document.getElementById('selDificultadSopa');
  if (selDif) {
    selDif.addEventListener('change', () => {
      dificultadClave = selDif.value;
      iniciarPartida();
    });
  }

  // Botón Reiniciar
  const btnReiniciar = document.getElementById('btnReiniciarSopa');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      iniciarPartida();
    });
  }

  // Botón Rendirse
  const btnRendirse = document.getElementById('btnRendirseSopa');
  if (btnRendirse) {
    btnRendirse.addEventListener('click', async () => {
      if (partidaTerminada) return;
      const conf = await ui.confirmar('¿Estás seguro de que deseas rendirte y revelar las palabras restantes?');
      if (!conf) return;

      // Revelar palabras no encontradas
      for (const u of ubicacionesActuales) {
        if (!u.encontrada) {
          u.revelada = true;
          for (const c of u.celdas) {
            const el = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
            if (el && !el.classList.contains('sopa-celda--encontrada')) {
              el.classList.add('sopa-celda--revelada');
            }
          }
          const itemEl = document.getElementById(`item-${u.palabra}`);
          if (itemEl && !itemEl.classList.contains('sopa-palabra-item--tachada')) {
            itemEl.classList.add('sopa-palabra-item--revelada');
          }
        }
      }

      await finalizarPartida(false);
    });
  }

  // Botón Cambiar tema
  const btnCambiarTema = document.getElementById('btnCambiarTema');
  if (btnCambiarTema) {
    btnCambiarTema.addEventListener('click', async () => {
      const nuevoTema = await obtenerTemaActividad();
      if (nuevoTema) {
        cargarJuegoParaTema(nuevoTema);
      }
    });
  }
}

async function cargarJuegoParaTema(tema) {
  if (!tema || !tema.id) return;
  temaActual = tema;

  ui.cargando(true);
  try {
    const glosario = await api.listar('glosario', { temaId: tema.id });
    terminosGlosario = (Array.isArray(glosario) ? glosario : []).filter(t => {
      if (!t || !t.termino) return false;
      const norm = util.normalizar(t.termino);
      return norm.length >= 3 && !/\s/.test(norm);
    });

    if (terminosGlosario.length < 3) {
      if (contenido) {
        contenido.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">🔍</div>
            <h2 class="vacio__titulo">Términos insuficientes</h2>
            <p class="vacio__texto">
              El tema <strong>${ui.escapar(tema.titulo)}</strong> cuenta con ${terminosGlosario.length} término(s) de una sola palabra. Se requieren al menos 3 palabras para generar la sopa de letras.
            </p>
            <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
              <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">
                Repasar el tema
              </a>
              <button type="button" id="btnElegirOtroTemaVacio" class="btn btn--secundario">
                Elegir otro tema
              </button>
            </div>
          </div>
        `;
        const btnVacio = document.getElementById('btnElegirOtroTemaVacio');
        if (btnVacio) {
          btnVacio.addEventListener('click', async () => {
            const t = await obtenerTemaActividad();
            if (t) cargarJuegoParaTema(t);
          });
        }
      }
      return;
    }

    iniciarPartida();
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar los términos del glosario.', 'error');
  } finally {
    ui.cargando(false);
  }
}

// Carga inicial
if (typeof window !== 'undefined') {
  (async () => {
    const tema = await obtenerTemaActividad();
  if (tema) {
    await cargarJuegoParaTema(tema);
  } else if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">🔍</div>
        <h2 class="vacio__titulo">Selecciona un tema para jugar</h2>
        <p class="vacio__texto">
          Debes elegir un tema pedagógico para generar la sopa de letras con sus conceptos correspondientes.
        </p>
        <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
          <button type="button" id="btnIniciarSeleccion" class="btn btn--primario">
            Seleccionar tema
          </button>
          <a href="/paginas/actividades.html" class="btn btn--secundario">
            Volver a Actividades
          </a>
        </div>
      </div>
    `;
    const btnIniciar = document.getElementById('btnIniciarSeleccion');
    if (btnIniciar) {
      btnIniciar.addEventListener('click', async () => {
        const t = await obtenerTemaActividad();
        if (t) cargarJuegoParaTema(t);
      });
    }
  }
})();
}

