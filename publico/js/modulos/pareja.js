// publico/js/modulos/pareja.js
// Juego pedagógico "Encuentra la pareja" con tarjetas 3D, retroalimentación y gamificación

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';

await montarPlantilla({ titulo: 'Encuentra la Pareja', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');

// Estado general
let temaActual = null;
let candidatos = [];
let dificultadDeseada = 6;
let totalParejas = 6;

// Estado de la partida actual
let cartas = [];
let seleccionadas = [];
let emparejadas = new Set();
let parejasEncontradas = 0;
let intentos = 0;
let tiempoSegundos = 0;
let cronometroInterval = null;
let bloqueado = false;
let inicioJuego = 0;

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function actualizarCronometro() {
  const elem = document.getElementById('cronometro');
  if (elem) {
    elem.textContent = formatearTiempo(tiempoSegundos);
  }
}

function actualizarMarcador() {
  const elIntentos = document.getElementById('marcadorIntentos');
  const elParejas = document.getElementById('marcadorParejas');
  if (elIntentos) elIntentos.textContent = intentos;
  if (elParejas) elParejas.textContent = `${parejasEncontradas} / ${totalParejas}`;
}

function generarVistaHtml() {
  return `
    <div class="pareja-vista">
      <!-- Cabecera -->
      <div class="pareja-cabecera">
        <div class="pareja-cabecera__info">
          <h1 class="pareja-cabecera__titulo">Encuentra la Pareja</h1>
          <p class="pareja-cabecera__tema">
            Tema: <strong>${ui.escapar(temaActual.titulo)}</strong>
          </p>
        </div>
        <div class="pareja-cabecera__acciones">
          <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">
            🔍 Cambiar tema
          </button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto btn--pequeno">
            📖 Ver tema
          </a>
        </div>
      </div>

      <!-- Marcador y controles -->
      <div class="pareja-marcador">
        <div class="pareja-marcador__dificultad">
          <label for="selDificultad">Dificultad:</label>
          <select id="selDificultad" aria-label="Seleccionar cantidad de parejas">
            <option value="6" ${dificultadDeseada === 6 ? 'selected' : ''}>6 parejas</option>
            <option value="8" ${dificultadDeseada === 8 ? 'selected' : ''}>8 parejas</option>
            <option value="10" ${dificultadDeseada === 10 ? 'selected' : ''}>10 parejas</option>
          </select>
          <button type="button" id="btnReiniciar" class="btn btn--secundario btn--pequeno" title="Reiniciar partida">
            🔄 Reiniciar
          </button>
        </div>

        <div class="pareja-marcador__stats" aria-live="polite">
          <div class="stat-item">
            <span class="stat-item__valor" id="cronometro">00:00</span>
            <span class="stat-item__etiqueta">Tiempo</span>
          </div>
          <div class="stat-item">
            <span class="stat-item__valor" id="marcadorIntentos">0</span>
            <span class="stat-item__etiqueta">Intentos</span>
          </div>
          <div class="stat-item">
            <span class="stat-item__valor" id="marcadorParejas">0 / ${totalParejas}</span>
            <span class="stat-item__etiqueta">Parejas</span>
          </div>
        </div>
      </div>

      <!-- Cuadrícula de tarjetas -->
      <div class="pareja-cuadricula" id="cuadriculaTarjetas" role="region" aria-label="Tablero de cartas boca abajo">
        ${cartas.map((carta, idx) => {
          const esEmparejada = emparejadas.has(carta.id);
          const esVolteada = seleccionadas.some(s => s.id === carta.id) || esEmparejada;
          const claseVolteada = esVolteada ? 'carta-pareja--volteada' : '';
          const claseEmparejada = esEmparejada ? 'carta-pareja--emparejada' : '';

          const tipoEtiqueta = carta.tipo === 'termino' ? 'CONCEPTO' : 'DEFINICIÓN';
          const claseTipo = carta.tipo === 'termino' ? 'carta-pareja__tipo-etiqueta--termino' : 'carta-pareja__tipo-etiqueta--definicion';

          return `
            <button type="button"
                    class="carta-pareja carta-pareja--tipo-${carta.tipo} ${claseVolteada} ${claseEmparejada}"
                    data-id="${carta.id}"
                    data-idx="${idx}"
                    aria-label="Tarjeta ${idx + 1}: ${esVolteada ? (carta.tipo + ' ' + carta.texto) : 'Boca abajo'}"
                    ${esEmparejada ? 'disabled' : ''}>
              <div class="carta-pareja__interno">
                <!-- Dorso (Boca abajo) -->
                <div class="carta-pareja__cara carta-pareja__dorso" aria-hidden="true">
                  <span class="carta-pareja__dorso-icono">🃏</span>
                  <span class="carta-pareja__dorso-patron">UNEMI</span>
                </div>
                <!-- Frente (Boca arriba) -->
                <div class="carta-pareja__cara carta-pareja__frente">
                  <span class="carta-pareja__tipo-etiqueta ${claseTipo}">${tipoEtiqueta}</span>
                  <p class="carta-pareja__texto">${ui.escapar(carta.texto)}</p>
                </div>
              </div>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Panel de retroalimentación inmediata -->
      <div class="pareja-retroalimentacion" id="contenedorRetro"></div>
    </div>
  `;
}

function renderizarJuego() {
  if (!contenido) return;
  contenido.innerHTML = generarVistaHtml();
  asignarEventos();
}

function iniciarPartida() {
  if (cronometroInterval) {
    clearInterval(cronometroInterval);
    cronometroInterval = null;
  }

  // Dificultad efectiva
  totalParejas = Math.min(dificultadDeseada, candidatos.length);
  if (totalParejas < 4) {
    totalParejas = candidatos.length;
  }

  // Seleccionar términos al azar
  const barajados = util.barajar(candidatos).slice(0, totalParejas);

  // Generar 2 tarjetas por término (concepto y definición)
  const nuevasCartas = [];
  barajados.forEach((item, i) => {
    nuevasCartas.push({
      id: `c-term-${item.id}-${i}`,
      terminoId: item.id,
      tipo: 'termino',
      texto: item.termino,
      termObj: item
    });
    nuevasCartas.push({
      id: `c-def-${item.id}-${i}`,
      terminoId: item.id,
      tipo: 'definicion',
      texto: item.definicion,
      termObj: item
    });
  });

  cartas = util.barajar(nuevasCartas);
  seleccionadas = [];
  emparejadas = new Set();
  parejasEncontradas = 0;
  intentos = 0;
  tiempoSegundos = 0;
  bloqueado = false;
  inicioJuego = 0;

  renderizarJuego();
}

async function procesarClickCarta(carta) {
  if (bloqueado) return;
  if (emparejadas.has(carta.id)) return;
  if (seleccionadas.some(c => c.id === carta.id)) return;

  // Iniciar cronómetro si es el primer movimiento
  if (!cronometroInterval) {
    inicioJuego = Date.now();
    cronometroInterval = setInterval(() => {
      tiempoSegundos++;
      actualizarCronometro();
    }, 1000);
  }

  // Voltear tarjeta en UI
  const cartaEl = document.querySelector(`[data-id="${carta.id}"]`);
  if (cartaEl) {
    cartaEl.classList.add('carta-pareja--volteada');
    cartaEl.setAttribute('aria-label', `Tarjeta: ${carta.tipo} ${carta.texto}`);
  }

  seleccionadas.push(carta);

  if (seleccionadas.length === 2) {
    intentos++;
    actualizarMarcador();
    bloqueado = true;

    const [c1, c2] = seleccionadas;
    const c1El = document.querySelector(`[data-id="${c1.id}"]`);
    const c2El = document.querySelector(`[data-id="${c2.id}"]`);

    // Comprobar si forman pareja (mismo términoId y tipos distintos: concepto con definición)
    const esPareja = (c1.terminoId === c2.terminoId) && (c1.tipo !== c2.tipo);

    if (esPareja) {
      // Pareja correcta
      emparejadas.add(c1.id);
      emparejadas.add(c2.id);

      if (c1El) {
        c1El.classList.add('carta-pareja--emparejada');
        c1El.disabled = true;
      }
      if (c2El) {
        c2El.classList.add('carta-pareja--emparejada');
        c2El.disabled = true;
      }

      parejasEncontradas++;
      actualizarMarcador();

      // Mostrar retroalimentación pedagógica inmediata con definición
      mostrarRetro({
        correcto: true,
        explicacion: `¡Pareja correcta! ${c1.termObj.termino}: ${c1.termObj.definicion}`,
        sugerencia: c1.termObj.retroalimentacion || '',
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
        contenedor: '#contenedorRetro'
      });

      seleccionadas = [];
      bloqueado = false;

      // Comprobar si completó el juego
      if (parejasEncontradas === totalParejas) {
        await finalizarJuego();
      }
    } else {
      // No forman pareja: voltear a los 1.2 segundos
      setTimeout(() => {
        if (c1El) {
          c1El.classList.remove('carta-pareja--volteada');
          c1El.setAttribute('aria-label', 'Tarjeta boca abajo');
        }
        if (c2El) {
          c2El.classList.remove('carta-pareja--volteada');
          c2El.setAttribute('aria-label', 'Tarjeta boca abajo');
        }
        seleccionadas = [];
        bloqueado = false;
      }, 1200);
    }
  }
}

async function finalizarJuego() {
  if (cronometroInterval) {
    clearInterval(cronometroInterval);
    cronometroInterval = null;
  }

  const duracionSeg = Math.max(1, Math.round((Date.now() - inicioJuego) / 1000));
  const errores = Math.max(0, intentos - totalParejas);
  const puntaje = Math.max(0, 10 - errores);

  // 1. Registrar intento en gamificación
  try {
    await registrarIntento({
      actividad: 'pareja',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.warn('Error al registrar intento de pareja:', err);
  }

  // 2. Mostrar modal de resumen pedagógico
  const recomendacion = errores === 0
    ? '¡Excelente precisión! Relacionaste todos los conceptos sin fallar.'
    : '¡Buen trabajo! Continúa ejercitando la memoria para asociar conceptos más rápido.';

  const decision = await mostrarResumen({
    titulo: '¡Juego Completado! 🎉',
    aciertos: totalParejas,
    errores,
    recomendaciones: [recomendacion, `Tiempo total: ${formatearTiempo(duracionSeg)}`],
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
  });

  if (decision === 'repetir') {
    iniciarPartida();
  }
}

function asignarEventos() {
  // Clic en tarjetas
  const cuadricula = document.getElementById('cuadriculaTarjetas');
  if (cuadricula) {
    cuadricula.addEventListener('click', (e) => {
      const btn = e.target.closest('.carta-pareja');
      if (btn && btn.dataset.id) {
        const carta = cartas.find(c => c.id === btn.dataset.id);
        if (carta) {
          procesarClickCarta(carta);
        }
      }
    });
  }

  // Selector de dificultad
  const selDificultad = document.getElementById('selDificultad');
  if (selDificultad) {
    selDificultad.addEventListener('change', () => {
      dificultadDeseada = parseInt(selDificultad.value, 10) || 6;
      iniciarPartida();
    });
  }

  // Botón Reiniciar
  const btnReiniciar = document.getElementById('btnReiniciar');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      iniciarPartida();
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
    candidatos = (Array.isArray(glosario) ? glosario : []).filter(t => t && t.termino && t.definicion);

    if (candidatos.length < 4) {
      if (contenido) {
        contenido.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">🃏</div>
            <h2 class="vacio__titulo">Términos insuficientes</h2>
            <p class="vacio__texto">
              El tema <strong>${ui.escapar(tema.titulo)}</strong> cuenta con ${candidatos.length} término(s) en el glosario. Se requieren al menos 4 parejas para jugar.
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
        <div class="vacio__icono" aria-hidden="true">🃏</div>
        <h2 class="vacio__titulo">Selecciona un tema para jugar</h2>
        <p class="vacio__texto">
          Debes elegir un tema pedagógico para cargar sus conceptos y definiciones en Encuentra la Pareja.
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
