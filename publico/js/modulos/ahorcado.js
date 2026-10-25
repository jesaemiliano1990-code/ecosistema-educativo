// publico/js/modulos/ahorcado.js
// Juego pedagógico de Ahorcado con figura no violenta de globo, integración de glosario y gamificación

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';

await montarPlantilla({ titulo: 'Ahorcado', roles: ['estudiante', 'docente'] });

const FILAS_TECLADO = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  ['J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q'],
  ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
];
const TODAS_LETRAS = new Set(FILAS_TECLADO.flat());

const contenido = document.getElementById('contenido');

// Estado general de la sesión
let temaActual = null;
let candidatos = [];
const usadosIds = new Set();

// Estado de la partida actual
let terminoActual = null;
let palabraNormalizada = '';
let letrasPalabra = [];
let letrasAdivinadas = new Set();
let letrasErradas = new Set();
let errores = 0;
let juegoActivo = false;
let finalizado = false;
let inicioJuego = 0;

function renderCaraGlobo(numErrores) {
  if (numErrores === 0) {
    return `
      <!-- Ojos felices -->
      <path d="M 82 100 Q 88 92 94 100" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <path d="M 106 100 Q 112 92 118 100" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <!-- Sonrisa -->
      <path d="M 91 113 Q 100 124 109 113" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <!-- Mejillas sonrosadas -->
      <ellipse cx="78" cy="107" rx="5" ry="3" fill="#ffab91" opacity="0.6"/>
      <ellipse cx="122" cy="107" rx="5" ry="3" fill="#ffab91" opacity="0.6"/>
    `;
  }
  if (numErrores === 1) {
    return `
      <!-- Ojos neutrales -->
      <circle cx="88" cy="98" r="4.5" fill="#ffffff"/>
      <circle cx="112" cy="98" r="4.5" fill="#ffffff"/>
      <circle cx="89" cy="97" r="1.5" fill="#002e45"/>
      <circle cx="113" cy="97" r="1.5" fill="#002e45"/>
      <!-- Boca recta -->
      <line x1="94" y1="116" x2="106" y2="116" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    `;
  }
  if (numErrores === 2) {
    return `
      <!-- Ojos abiertos de preocupación -->
      <circle cx="88" cy="98" r="6" fill="#ffffff"/>
      <circle cx="112" cy="98" r="6" fill="#ffffff"/>
      <circle cx="88" cy="98" r="2.5" fill="#002e45"/>
      <circle cx="112" cy="98" r="2.5" fill="#002e45"/>
      <!-- Boca ovalada 'o' -->
      <ellipse cx="100" cy="116" rx="5" ry="7" fill="#ffffff"/>
      <ellipse cx="100" cy="116" rx="3.5" ry="5" fill="#e65100"/>
    `;
  }
  if (numErrores === 3) {
    return `
      <!-- Ojos achinados preocupados -->
      <path d="M 82 98 Q 88 94 94 98" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <path d="M 106 98 Q 112 94 118 98" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <!-- Boca temblorosa -->
      <path d="M 91 116 Q 95 112 100 116 T 109 116" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <!-- Gota de sudor -->
      <path d="M 126 88 Q 129 82 131 88 A 3.5 3.5 0 1 1 126 88" fill="#90caf9"/>
    `;
  }
  // Error 4: Desinflado total
  return `
    <!-- Ojos x_x -->
    <path d="M 83 94 L 91 102 M 91 94 L 83 102" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <path d="M 109 94 L 117 102 M 117 94 L 109 102" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <!-- Boca triste -->
    <path d="M 93 118 Q 100 110 107 118" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  `;
}

function generarSvgGlobo(numErrores) {
  const claseEstado = `globo-estado-${Math.min(numErrores, 4)}`;
  return `
    <svg class="globo-svg ${claseEstado}" viewBox="0 0 200 240" role="img" aria-label="Globo pedagógico en estado de errores ${numErrores} de 4">
      <!-- Aire escapando cuando el globo se desinfla -->
      <g class="globo__aire" aria-hidden="true">
        <path d="M 82 188 Q 68 194 62 206 Q 58 216 68 216" fill="none" stroke="#90caf9" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 118 188 Q 132 194 138 206 Q 142 216 132 216" fill="none" stroke="#90caf9" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="62" cy="208" r="3" fill="#90caf9"/>
        <circle cx="138" cy="208" r="3" fill="#90caf9"/>
      </g>

      <!-- Cuerda flexible del globo -->
      <path class="globo__cuerda" d="M 100 178 Q 93 200 107 216 T 100 238" fill="none" stroke="#37474f" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Cuerpo del globo con punto de anclaje inferior -->
      <g class="globo__cuerpo" aria-hidden="true">
        <!-- Nudo del globo -->
        <polygon points="100,172 93,180 107,180" fill="#e65100"/>
        <!-- Silueta principal del globo -->
        <ellipse cx="100" cy="105" rx="66" ry="73"/>
        <!-- Brillo de iluminación -->
        <ellipse class="globo__brillo" cx="77" cy="74" rx="14" ry="24" transform="rotate(-30 77 74)" fill="#ffffff" opacity="0.45"/>
        <!-- Expresión facial -->
        <g class="globo__cara">
          ${renderCaraGlobo(numErrores)}
        </g>
      </g>
    </svg>
  `;
}

function generarTableroHtml() {
  const puntosErroresHtml = [0, 1, 2, 3].map(i => {
    const fallado = i < errores;
    return `<span class="error-punto ${fallado ? 'error-punto--fallado' : ''}" title="Fallo ${i + 1}"></span>`;
  }).join('');

  const casillasHtml = letrasPalabra.map((letra, idx) => {
    const acertada = letrasAdivinadas.has(letra);
    const mostrar = acertada || finalizado;
    const claseMod = acertada ? 'ahorcado__casilla--acertada' : (finalizado && !acertada ? 'ahorcado__casilla--no-acertada' : '');

    return `
      <div class="ahorcado__casilla ${claseMod}" data-idx="${idx}" aria-label="Letra ${idx + 1}">
        ${mostrar ? ui.escapar(letra) : ''}
      </div>
    `;
  }).join('');

  const tecladoHtml = FILAS_TECLADO.map(fila => `
    <div class="teclado__fila">
      ${fila.map(letra => {
        let clase = 'tecla';
        let deshabilitado = !juegoActivo || finalizado;

        if (letrasAdivinadas.has(letra)) {
          clase += ' tecla--acierto';
          deshabilitado = true;
        } else if (letrasErradas.has(letra)) {
          clase += ' tecla--error';
          deshabilitado = true;
        }

        return `
          <button type="button" class="${clase}" data-letra="${letra}" ${deshabilitado ? 'disabled' : ''} aria-label="Letra ${letra}">
            ${letra}
          </button>
        `;
      }).join('')}
    </div>
  `).join('');

  return `
    <div class="ahorcado-vista">
      <!-- Encabezado de la actividad -->
      <div class="ahorcado-cabecera">
        <div class="ahorcado-cabecera__info">
          <h1 class="ahorcado-cabecera__titulo">Ahorcado</h1>
          <p class="ahorcado-cabecera__tema">
            Tema: <strong>${ui.escapar(temaActual.titulo)}</strong>
          </p>
        </div>
        <div class="ahorcado-cabecera__acciones">
          <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">
            🔍 Cambiar tema
          </button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto btn--pequeno">
            📖 Ver tema
          </a>
        </div>
      </div>

      <!-- Tablero central -->
      <div class="ahorcado-tablero">
        <!-- Figura del globo -->
        <div class="ahorcado-figura-contenedor">
          <div id="contenedorSvgGlobo">
            ${generarSvgGlobo(errores)}
          </div>
          <div class="ahorcado-contador-errores" aria-live="polite">
            <span>Errores: ${errores} / 4</span>
            <div class="ahorcado-contador-errores__puntos" aria-hidden="true">
              ${puntosErroresHtml}
            </div>
          </div>
        </div>

        <!-- Pista, Casillas y Teclado -->
        <div class="ahorcado-interaccion">
          <div class="ahorcado__pista-caja">
            <span class="ahorcado__pista-etiqueta">💡 Pista</span>
            <p class="ahorcado__pista-texto">${ui.escapar(terminoActual.pista || 'Descubre la palabra oculta relacionada con el tema.')}</p>
          </div>

          <div class="ahorcado__casillas" role="region" aria-label="Palabra oculta de 6 letras">
            ${casillasHtml}
          </div>

          <div class="ahorcado__teclado" id="tecladoVirtual">
            ${tecladoHtml}
          </div>
        </div>
      </div>

      <!-- Zona de retroalimentación pedagógica y acciones posteriores -->
      <div class="ahorcado-resultado">
        <div id="contenedorRetro"></div>
        <div class="ahorcado-acciones-finales" id="contenedorAccionesFinales" style="${finalizado ? '' : 'display: none;'}">
          <button type="button" id="btnOtraPalabra" class="btn btn--primario">
            🔄 Otra palabra
          </button>
          <button type="button" id="btnCambiarTemaAbajo" class="btn btn--secundario">
            🔍 Elegir otro tema
          </button>
        </div>
      </div>
    </div>
  `;
}

function actualizarTablero() {
  if (!contenido) return;
  contenido.innerHTML = generarTableroHtml();
  asignarEventos();
}

function procesarLetra(letraBruta) {
  if (!juegoActivo || finalizado) return;

  const letra = util.normalizar(letraBruta);
  if (!letra || letra.length !== 1 || !TODAS_LETRAS.has(letra)) return;
  if (letrasAdivinadas.has(letra) || letrasErradas.has(letra)) return;

  if (letrasPalabra.includes(letra)) {
    letrasAdivinadas.add(letra);
    const gano = letrasPalabra.every(l => letrasAdivinadas.has(l));
    if (gano) {
      juegoActivo = false;
      finalizarPartida(true);
      return;
    }
  } else {
    letrasErradas.add(letra);
    errores = letrasErradas.size;
    if (errores >= 4) {
      juegoActivo = false;
      finalizarPartida(false);
      return;
    }
  }

  actualizarTablero();
}

async function finalizarPartida(gano) {
  finalizado = true;
  juegoActivo = false;
  actualizarTablero();

  const duracionSeg = Math.max(1, Math.round((Date.now() - inicioJuego) / 1000));
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

  // 1. Mostrar retroalimentación pedagógica
  mostrarRetro({
    correcto: gano,
    explicacion: terminoActual.definicion || 'Definición del término no disponible.',
    sugerencia: terminoActual.retroalimentacion || 'Repasa los términos del glosario para afianzar tus conocimientos.',
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
    contenedor: '#contenedorRetro'
  });

  // 2. Registrar intento en el motor de gamificación
  try {
    await registrarIntento({
      actividad: 'ahorcado',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (error) {
    console.warn('Error al registrar intento de ahorcado:', error);
  }

  // 3. Revelar acciones finales
  const contenedorAccionesFinales = document.getElementById('contenedorAccionesFinales');
  if (contenedorAccionesFinales) {
    contenedorAccionesFinales.style.display = 'flex';
  }
}

function iniciarPartida() {
  let disponibles = candidatos.filter(g => !usadosIds.has(g.id));
  if (disponibles.length === 0) {
    // Si ya se usaron todas las palabras de 6 letras, reiniciar ciclo de uso
    usadosIds.clear();
    disponibles = [...candidatos];
  }

  terminoActual = disponibles[Math.floor(Math.random() * disponibles.length)];
  usadosIds.add(terminoActual.id);

  palabraNormalizada = util.normalizar(terminoActual.termino);
  letrasPalabra = palabraNormalizada.split('');

  letrasAdivinadas = new Set();
  letrasErradas = new Set();
  errores = 0;
  juegoActivo = true;
  finalizado = false;
  inicioJuego = Date.now();

  actualizarTablero();
}

function asignarEventos() {
  // Teclas virtuales
  const tecladoVirtual = document.getElementById('tecladoVirtual');
  if (tecladoVirtual) {
    tecladoVirtual.addEventListener('click', (e) => {
      const boton = e.target.closest('.tecla');
      if (boton && boton.dataset.letra) {
        procesarLetra(boton.dataset.letra);
      }
    });
  }

  // Botón "Otra palabra"
  const btnOtraPalabra = document.getElementById('btnOtraPalabra');
  if (btnOtraPalabra) {
    btnOtraPalabra.addEventListener('click', () => {
      iniciarPartida();
    });
  }

  // Botones para cambiar tema
  const btnCambiarTema = document.getElementById('btnCambiarTema');
  const btnCambiarTemaAbajo = document.getElementById('btnCambiarTemaAbajo');

  const accionCambiarTema = async () => {
    const nuevoTema = await obtenerTemaActividad();
    if (nuevoTema) {
      cargarJuegoParaTema(nuevoTema);
    }
  };

  if (btnCambiarTema) btnCambiarTema.addEventListener('click', accionCambiarTema);
  if (btnCambiarTemaAbajo) btnCambiarTemaAbajo.addEventListener('click', accionCambiarTema);
}

// Teclado físico
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }
  if (e.key && e.key.length === 1) {
    procesarLetra(e.key);
  }
});

async function cargarJuegoParaTema(tema) {
  if (!tema || !tema.id) return;
  temaActual = tema;
  usadosIds.clear();

  ui.cargando(true);
  try {
    const glosario = await api.listar('glosario', { temaId: tema.id });
    candidatos = (Array.isArray(glosario) ? glosario : []).filter(g => {
      if (!g || !g.termino) return false;
      const norm = util.normalizar(g.termino);
      return norm.length === 6;
    });

    if (candidatos.length === 0) {
      if (contenido) {
        contenido.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">📖</div>
            <h2 class="vacio__titulo">No hay términos disponibles</h2>
            <p class="vacio__texto">
              El tema <strong>${ui.escapar(tema.titulo)}</strong> no cuenta con términos de 6 letras en el glosario para jugar al Ahorcado.
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
(async () => {
  const tema = await obtenerTemaActividad();
  if (tema) {
    await cargarJuegoParaTema(tema);
  } else if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">🎮</div>
        <h2 class="vacio__titulo">Selecciona un tema para jugar</h2>
        <p class="vacio__texto">
          Debes elegir un tema pedagógico para cargar sus palabras correspondientes al Ahorcado.
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
