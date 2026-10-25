// publico/js/modulos/crucigrama.js
// Crucigrama con las palabras del glosario del tema, retroalimentación y gamificación

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';

if (typeof window !== 'undefined') {
  await montarPlantilla({ titulo: 'Crucigrama', roles: ['estudiante', 'docente'] });
}

const HORIZONTAL = 'horizontal';
const VERTICAL = 'vertical';
const MAX_PALABRAS = 12;
const MIN_PALABRAS = 4;
const MAX_CANDIDATOS = 15;
const INTENTOS_GENERACION = 30;
const MAX_REVELADAS = 3;

// ----------------------------------------------------
// GENERADOR (función pura)
// ----------------------------------------------------

/**
 * Coloca las palabras en una cuadrícula cruzada.
 * @param {Array<{palabra: string, pista: string}>} palabras - palabras ya normalizadas (A-Z y Ñ)
 * @returns {{ filas: number, columnas: number, entradas: Array<{numero, palabra, pista, fila, col, direccion}> }}
 */
export function generarCrucigrama(palabras = []) {
  const unicas = [];
  const vistas = new Set();
  for (const p of palabras) {
    if (p && p.palabra && !vistas.has(p.palabra)) {
      vistas.add(p.palabra);
      unicas.push({ palabra: p.palabra, pista: p.pista || '' });
    }
  }
  if (!unicas.length) return { filas: 0, columnas: 0, entradas: [] };

  const masLarga = unicas.reduce((a, b) => (b.palabra.length > a.palabra.length ? b : a));
  const resto = unicas.filter((p) => p !== masLarga);

  let mejor = null;
  for (let i = 0; i < INTENTOS_GENERACION; i++) {
    const orden = [masLarga, ...util.barajar(resto)];
    const intento = colocarEnOrden(orden);
    if (!mejor || intento.entradas.length > mejor.entradas.length ||
        (intento.entradas.length === mejor.entradas.length && intento.area < mejor.area)) {
      mejor = intento;
    }
  }
  return recortar(mejor.entradas);
}

function colocarEnOrden(orden) {
  const celdas = new Map(); // "f,c" → { letra, dirs: Set }
  const entradas = [];
  const limites = { minF: 0, maxF: 0, minC: 0, maxC: 0 };
  const clave = (f, c) => `${f},${c}`;
  const vacia = (f, c) => !celdas.has(clave(f, c));

  // Devuelve el número de cruces si la palabra cabe, o -1 si no es válida.
  function evaluar(palabra, f0, c0, dir) {
    const df = dir === VERTICAL ? 1 : 0;
    const dc = dir === HORIZONTAL ? 1 : 0;
    if (!vacia(f0 - df, c0 - dc) || !vacia(f0 + df * palabra.length, c0 + dc * palabra.length)) return -1;
    let cruces = 0;
    for (let k = 0; k < palabra.length; k++) {
      const f = f0 + df * k;
      const c = c0 + dc * k;
      const celda = celdas.get(clave(f, c));
      if (celda) {
        if (celda.letra !== palabra[k] || celda.dirs.has(dir)) return -1;
        cruces++;
      } else if (!vacia(f + dc, c + df) || !vacia(f - dc, c - df)) {
        return -1; // tocaría otra palabra en paralelo
      }
    }
    return cruces;
  }

  function areaCon(palabra, f0, c0, dir) {
    const f1 = dir === VERTICAL ? f0 + palabra.length - 1 : f0;
    const c1 = dir === HORIZONTAL ? c0 + palabra.length - 1 : c0;
    const alto = Math.max(limites.maxF, f1) - Math.min(limites.minF, f0) + 1;
    const ancho = Math.max(limites.maxC, c1) - Math.min(limites.minC, c0) + 1;
    return alto * ancho;
  }

  function colocar(p, f0, c0, dir) {
    const df = dir === VERTICAL ? 1 : 0;
    const dc = dir === HORIZONTAL ? 1 : 0;
    for (let k = 0; k < p.palabra.length; k++) {
      const f = f0 + df * k;
      const c = c0 + dc * k;
      const celda = celdas.get(clave(f, c));
      if (celda) celda.dirs.add(dir);
      else celdas.set(clave(f, c), { letra: p.palabra[k], dirs: new Set([dir]) });
      limites.minF = Math.min(limites.minF, f);
      limites.maxF = Math.max(limites.maxF, f);
      limites.minC = Math.min(limites.minC, c);
      limites.maxC = Math.max(limites.maxC, c);
    }
    entradas.push({ palabra: p.palabra, pista: p.pista, fila: f0, col: c0, direccion: dir });
  }

  colocar(orden[0], 0, 0, HORIZONTAL);

  for (const p of orden.slice(1)) {
    if (entradas.length >= MAX_PALABRAS) break;
    let elegido = null;
    for (const [k, celda] of celdas) {
      if (celda.dirs.size !== 1) continue;
      const dir = celda.dirs.has(HORIZONTAL) ? VERTICAL : HORIZONTAL;
      const [f, c] = k.split(',').map(Number);
      for (let i = 0; i < p.palabra.length; i++) {
        if (p.palabra[i] !== celda.letra) continue;
        const f0 = dir === VERTICAL ? f - i : f;
        const c0 = dir === HORIZONTAL ? c - i : c;
        const cruces = evaluar(p.palabra, f0, c0, dir);
        if (cruces < 1) continue;
        const puntos = cruces * 1000 - areaCon(p.palabra, f0, c0, dir);
        if (!elegido || puntos > elegido.puntos) elegido = { f0, c0, dir, puntos };
      }
    }
    if (elegido) colocar(p, elegido.f0, elegido.c0, elegido.dir);
  }

  const area = (limites.maxF - limites.minF + 1) * (limites.maxC - limites.minC + 1);
  return { entradas, area };
}

// Recorta la cuadrícula al área usada y numera las casillas iniciales (izquierda a derecha, arriba a abajo).
function recortar(entradas) {
  const minF = Math.min(...entradas.map((e) => e.fila));
  const minC = Math.min(...entradas.map((e) => e.col));
  const movidas = entradas.map((e) => ({ ...e, fila: e.fila - minF, col: e.col - minC }));
  const fin = (e) => ({
    f: e.direccion === VERTICAL ? e.fila + e.palabra.length - 1 : e.fila,
    c: e.direccion === HORIZONTAL ? e.col + e.palabra.length - 1 : e.col
  });
  const filas = Math.max(...movidas.map((e) => fin(e).f)) + 1;
  const columnas = Math.max(...movidas.map((e) => fin(e).c)) + 1;

  const inicios = [...new Set(movidas.map((e) => `${e.fila},${e.col}`))]
    .map((k) => k.split(',').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numeroDe = new Map(inicios.map(([f, c], i) => [`${f},${c}`, i + 1]));

  const resultado = movidas
    .map((e) => ({ numero: numeroDe.get(`${e.fila},${e.col}`), ...e }))
    .sort((a, b) => a.numero - b.numero || (a.direccion === HORIZONTAL ? -1 : 1));
  return { filas, columnas, entradas: resultado };
}

// ----------------------------------------------------
// INTERFAZ
// ----------------------------------------------------

const contenido = typeof document !== 'undefined' ? document.getElementById('contenido') : null;

let temaActual = null;
let glosarioTema = [];
let crucigrama = null;
let estados = []; // por entrada: 'pendiente' | 'correcta' | 'incorrecta'
let celdasPorClave = new Map(); // "f,c" → { elemento, input, letra, entradas: { horizontal, vertical }, bloqueada }
let seleccionada = 0;
let direccionActual = HORIZONTAL;
let reveladas = 0;
let terminado = false;
let inicioJuego = 0;

const clave = (f, c) => `${f},${c}`;
const NOMBRE_DIR = { [HORIZONTAL]: 'Horizontal', [VERTICAL]: 'Vertical' };
const LETRA_VALIDA = /^[a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]$/;

function textoRevelar() {
  const quedan = MAX_REVELADAS - reveladas;
  return `Revelar letra (${quedan} ${quedan === 1 ? 'restante' : 'restantes'})`;
}

function celdasDe(entrada) {
  const celdas = [];
  for (let k = 0; k < entrada.palabra.length; k++) {
    const f = entrada.fila + (entrada.direccion === VERTICAL ? k : 0);
    const c = entrada.col + (entrada.direccion === HORIZONTAL ? k : 0);
    celdas.push(celdasPorClave.get(clave(f, c)));
  }
  return celdas;
}

function textoDe(entrada) {
  return celdasDe(entrada).map((c) => c.input.value.toUpperCase()).join('');
}

function terminoDe(entrada) {
  return glosarioTema.find((g) => util.normalizar(g.termino) === entrada.palabra) || {};
}

function candidatosDelGlosario() {
  return glosarioTema
    .map((g) => ({ palabra: util.normalizar(g.termino || ''), pista: g.pista || g.definicion || '' }))
    .filter((p) => /^[A-ZÑ]{3,12}$/.test(p.palabra));
}

function construirHtml() {
  const { filas, columnas, entradas } = crucigrama;
  const inicios = new Map(entradas.map((e) => [clave(e.fila, e.col), e.numero]));
  const activas = new Set();
  for (const e of entradas) {
    for (let k = 0; k < e.palabra.length; k++) {
      activas.add(clave(e.fila + (e.direccion === VERTICAL ? k : 0), e.col + (e.direccion === HORIZONTAL ? k : 0)));
    }
  }

  let casillas = '';
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      if (!activas.has(clave(f, c))) {
        casillas += '<div class="crucigrama__bloque" aria-hidden="true"></div>';
        continue;
      }
      const numero = inicios.get(clave(f, c));
      casillas += `
        <div class="crucigrama__celda" data-f="${f}" data-c="${c}">
          ${numero ? `<span class="crucigrama__numero" aria-hidden="true">${numero}</span>` : ''}
          <input type="text" class="crucigrama__input" maxlength="1" autocomplete="off" autocapitalize="characters"
                 spellcheck="false" aria-label="Fila ${f + 1}, columna ${c + 1}${numero ? `, inicio de la palabra ${numero}` : ''}">
        </div>`;
    }
  }

  const lista = (dir) => entradas
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => e.direccion === dir)
    .map(({ e, idx }) => `
      <li>
        <button type="button" class="crucigrama-pista" data-idx="${idx}">
          <span class="crucigrama-pista__numero">${e.numero}.</span>
          <span>${ui.escapar(e.pista)} <small>(${e.palabra.length} letras)</small></span>
        </button>
      </li>`).join('');

  return `
    <div class="crucigrama-vista">
      <div class="crucigrama-cabecera">
        <div>
          <h1 class="crucigrama-cabecera__titulo">Crucigrama</h1>
          <p class="crucigrama-cabecera__tema">Tema: <strong>${ui.escapar(temaActual.titulo)}</strong></p>
        </div>
        <div class="crucigrama-cabecera__acciones">
          <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">🔍 Cambiar tema</button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto btn--pequeno">📖 Ver tema</a>
        </div>
      </div>

      <div class="crucigrama-tablero">
        <div class="crucigrama-rejilla-marco">
          <div class="crucigrama-rejilla" id="rejilla" style="--columnas: ${columnas}" role="group" aria-label="Crucigrama de ${columnas} columnas y ${filas} filas">
            ${casillas}
          </div>
        </div>
        <p class="crucigrama-ayuda">Flechas para moverte · Retroceso para borrar · Espacio o doble clic para cambiar de dirección · Enter para comprobar la palabra.</p>
        <div class="crucigrama-barra">
          <button type="button" id="btnComprobar" class="btn btn--primario">Comprobar palabra</button>
          <button type="button" id="btnRevelar" class="btn btn--secundario">${textoRevelar()}</button>
          <button type="button" id="btnTerminar" class="btn btn--secundario">Terminar</button>
        </div>
        <p class="crucigrama-estado" id="estado" role="status" aria-live="polite"></p>
      </div>

      <div id="contenedorRetro"></div>

      <div class="crucigrama-pistas">
        <section aria-labelledby="titPistasH" class="crucigrama-pistas__bloque">
          <h2 class="crucigrama-pistas__titulo" id="titPistasH">Horizontales</h2>
          <ul class="crucigrama-pistas__lista">${lista(HORIZONTAL)}</ul>
        </section>
        <section aria-labelledby="titPistasV" class="crucigrama-pistas__bloque">
          <h2 class="crucigrama-pistas__titulo" id="titPistasV">Verticales</h2>
          <ul class="crucigrama-pistas__lista">${lista(VERTICAL)}</ul>
        </section>
      </div>
      <div class="crucigrama-barra" id="accionesFinales" style="display: none;">
        <button type="button" id="btnNuevo" class="btn btn--primario">🔄 Nuevo crucigrama</button>
        <button type="button" id="btnCambiarTemaAbajo" class="btn btn--secundario">🔍 Elegir otro tema</button>
      </div>
    </div>`;
}

function montarTablero() {
  contenido.innerHTML = construirHtml();
  celdasPorClave = new Map();
  crucigrama.entradas.forEach((e, idx) => {
    for (let k = 0; k < e.palabra.length; k++) {
      const f = e.fila + (e.direccion === VERTICAL ? k : 0);
      const c = e.col + (e.direccion === HORIZONTAL ? k : 0);
      let celda = celdasPorClave.get(clave(f, c));
      if (!celda) {
        const elemento = contenido.querySelector(`.crucigrama__celda[data-f="${f}"][data-c="${c}"]`);
        celda = { elemento, input: elemento.querySelector('input'), letra: e.palabra[k], entradas: {}, bloqueada: false };
        celdasPorClave.set(clave(f, c), celda);
      }
      celda.entradas[e.direccion] = idx;
    }
  });
  estados = crucigrama.entradas.map(() => 'pendiente');
  reveladas = 0;
  terminado = false;
  inicioJuego = Date.now();
  asignarEventos();
  seleccionarEntrada(0, true);
}

function entradaEn(celda, preferida) {
  if (celda.entradas[preferida] !== undefined) return celda.entradas[preferida];
  return celda.entradas[preferida === HORIZONTAL ? VERTICAL : HORIZONTAL];
}

function seleccionarEntrada(idx, enfocar = false) {
  seleccionada = idx;
  const entrada = crucigrama.entradas[idx];
  direccionActual = entrada.direccion;

  contenido.querySelectorAll('.crucigrama__celda--palabra, .crucigrama__celda--activa')
    .forEach((el) => el.classList.remove('crucigrama__celda--palabra', 'crucigrama__celda--activa'));
  celdasDe(entrada).forEach((c) => c.elemento.classList.add('crucigrama__celda--palabra'));

  contenido.querySelectorAll('.crucigrama-pista').forEach((b) => {
    b.removeAttribute('aria-current');
    if (Number(b.dataset.idx) === idx) b.setAttribute('aria-current', 'true');
  });

  const estado = document.getElementById('estado');
  if (estado) estado.textContent = `${entrada.numero} ${NOMBRE_DIR[entrada.direccion]}: ${entrada.pista} (${entrada.palabra.length} letras)`;

  if (enfocar) {
    const celdas = celdasDe(entrada);
    (celdas.find((c) => !c.input.value && !c.bloqueada) || celdas[0]).input.focus();
  }
  marcarActiva(document.activeElement);
}

function marcarActiva(input) {
  contenido.querySelectorAll('.crucigrama__celda--activa').forEach((el) => el.classList.remove('crucigrama__celda--activa'));
  const celda = input && input.closest ? input.closest('.crucigrama__celda') : null;
  if (celda) celda.classList.add('crucigrama__celda--activa');
}

function celdaDeInput(input) {
  const el = input.closest('.crucigrama__celda');
  return el ? celdasPorClave.get(clave(Number(el.dataset.f), Number(el.dataset.c))) : null;
}

function alternarDireccion(celda) {
  const otra = direccionActual === HORIZONTAL ? VERTICAL : HORIZONTAL;
  if (celda.entradas[otra] === undefined) return;
  direccionActual = otra;
  seleccionarEntrada(celda.entradas[otra]);
}

function moverA(f, c) {
  const destino = celdasPorClave.get(clave(f, c));
  if (!destino) return false;
  destino.input.focus();
  return true;
}

function avanzar(celda) {
  const entrada = crucigrama.entradas[seleccionada];
  const celdas = celdasDe(entrada);
  const i = celdas.indexOf(celda);
  if (i >= 0 && i < celdas.length - 1) celdas[i + 1].input.focus();
}

function retroceder(celda) {
  const celdas = celdasDe(crucigrama.entradas[seleccionada]);
  const i = celdas.indexOf(celda);
  if (i > 0) {
    celdas[i - 1].input.focus();
    return celdas[i - 1];
  }
  return null;
}

// Al editar una palabra marcada como incorrecta, se limpia su marca.
function limpiarMarcaIncorrecta(celda) {
  for (const dir of [HORIZONTAL, VERTICAL]) {
    const idx = celda.entradas[dir];
    if (idx !== undefined && estados[idx] === 'incorrecta') ponerEstado(idx, 'pendiente');
  }
}

function ponerEstado(idx, estado) {
  estados[idx] = estado;
  const entrada = crucigrama.entradas[idx];
  const boton = contenido.querySelector(`.crucigrama-pista[data-idx="${idx}"]`);
  if (boton) {
    boton.classList.toggle('crucigrama-pista--correcta', estado === 'correcta');
    boton.classList.toggle('crucigrama-pista--incorrecta', estado === 'incorrecta');
  }
  for (const celda of celdasDe(entrada)) {
    const enOtraCorrecta = Object.values(celda.entradas).some((i) => estados[i] === 'correcta');
    const enIncorrecta = Object.values(celda.entradas).some((i) => estados[i] === 'incorrecta');
    celda.elemento.classList.toggle('crucigrama__celda--correcta', enOtraCorrecta);
    celda.elemento.classList.toggle('crucigrama__celda--incorrecta', !enOtraCorrecta && enIncorrecta);
    if (enOtraCorrecta) bloquear(celda);
  }
}

function bloquear(celda) {
  celda.bloqueada = true;
  celda.input.readOnly = true;
}

function escribirLetra(celda, letra) {
  if (celda.bloqueada || terminado) return;
  celda.input.value = util.normalizar(letra);
  limpiarMarcaIncorrecta(celda);
  avanzar(celda);
}

function asignarEventos() {
  const rejilla = document.getElementById('rejilla');

  rejilla.addEventListener('focusin', (e) => {
    const celda = celdaDeInput(e.target);
    if (!celda) return;
    const idx = entradaEn(celda, direccionActual);
    if (idx !== seleccionada || !contenido.querySelector('.crucigrama__celda--palabra')) seleccionarEntrada(idx);
    marcarActiva(e.target);
  });

  rejilla.addEventListener('dblclick', (e) => {
    const celda = celdaDeInput(e.target);
    if (celda) alternarDireccion(celda);
  });

  rejilla.addEventListener('keydown', (e) => {
    const celda = celdaDeInput(e.target);
    if (!celda || e.ctrlKey || e.metaKey || e.altKey) return;
    const f = Number(celda.elemento.dataset.f);
    const c = Number(celda.elemento.dataset.c);

    const movimientos = { ArrowLeft: [0, -1, HORIZONTAL], ArrowRight: [0, 1, HORIZONTAL], ArrowUp: [-1, 0, VERTICAL], ArrowDown: [1, 0, VERTICAL] };
    if (movimientos[e.key]) {
      e.preventDefault();
      const [df, dc, dir] = movimientos[e.key];
      const destino = celdasPorClave.get(clave(f + df, c + dc));
      if (!destino) return;
      if (destino.entradas[dir] !== undefined) direccionActual = dir;
      moverA(f + df, c + dc);
      return;
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      alternarDireccion(celda);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (terminado) return;
      if (celda.input.value && !celda.bloqueada) {
        celda.input.value = '';
        limpiarMarcaIncorrecta(celda);
      } else {
        const previa = retroceder(celda);
        if (previa && !previa.bloqueada) {
          previa.input.value = '';
          limpiarMarcaIncorrecta(previa);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      comprobarPalabra();
    } else if (e.key.length === 1 && LETRA_VALIDA.test(e.key)) {
      e.preventDefault();
      escribirLetra(celda, e.key);
    } else if (e.key.length === 1) {
      e.preventDefault(); // números y símbolos no se escriben
    }
  });

  // Teclados virtuales que no envían la tecla en keydown
  rejilla.addEventListener('input', (e) => {
    const celda = celdaDeInput(e.target);
    if (!celda) return;
    const letra = e.target.value.slice(-1);
    e.target.value = '';
    if (letra && LETRA_VALIDA.test(letra)) escribirLetra(celda, letra);
  });

  contenido.querySelectorAll('.crucigrama-pista').forEach((boton) => {
    boton.addEventListener('click', () => seleccionarEntrada(Number(boton.dataset.idx), true));
  });

  document.getElementById('btnComprobar').addEventListener('click', comprobarPalabra);
  document.getElementById('btnRevelar').addEventListener('click', revelarLetra);
  document.getElementById('btnTerminar').addEventListener('click', terminar);
  document.getElementById('btnNuevo').addEventListener('click', () => nuevoCrucigrama());
  const cambiarTema = async () => {
    const nuevo = await obtenerTemaActividad();
    if (nuevo) cargarParaTema(nuevo);
  };
  document.getElementById('btnCambiarTema').addEventListener('click', cambiarTema);
  document.getElementById('btnCambiarTemaAbajo').addEventListener('click', cambiarTema);
}

function comprobarPalabra() {
  if (terminado) return;
  const entrada = crucigrama.entradas[seleccionada];
  const escrito = textoDe(entrada);
  if (escrito.length < entrada.palabra.length) {
    ui.aviso('Completa todas las letras de la palabra antes de comprobar.', 'info');
    return;
  }
  const correcta = escrito === entrada.palabra;
  ponerEstado(seleccionada, correcta ? 'correcta' : 'incorrecta');
  const termino = terminoDe(entrada);
  mostrarRetro({
    correcto: correcta,
    explicacion: termino.definicion || entrada.pista,
    sugerencia: correcta
      ? termino.retroalimentacion || ''
      : 'Revisa las letras que cruzan con otras palabras y vuelve a intentarlo.',
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
    contenedor: '#contenedorRetro'
  });
}

function revelarLetra() {
  if (terminado) return;
  if (reveladas >= MAX_REVELADAS) {
    ui.aviso(`Solo puedes revelar ${MAX_REVELADAS} letras por crucigrama.`, 'info');
    return;
  }
  const entrada = crucigrama.entradas[seleccionada];
  const objetivo = celdasDe(entrada).find((c) => !c.bloqueada && c.input.value.toUpperCase() !== c.letra);
  if (!objetivo) {
    ui.aviso('Esta palabra ya está completa.', 'info');
    return;
  }
  objetivo.input.value = objetivo.letra;
  objetivo.elemento.classList.add('crucigrama__celda--revelada');
  bloquear(objetivo);
  limpiarMarcaIncorrecta(objetivo);
  reveladas++;
  document.getElementById('btnRevelar').textContent = textoRevelar();
  ui.aviso('Letra revelada: cuenta como un error.', 'info');
}

async function terminar() {
  if (terminado) return;
  const incompletas = crucigrama.entradas.filter((e) => textoDe(e) !== e.palabra).length;
  if (incompletas > 0) {
    const seguro = await ui.confirmar(`Hay ${incompletas} palabra(s) incompleta(s) o incorrecta(s). ¿Terminar el crucigrama? Contarán como errores.`);
    if (!seguro) return;
  }
  terminado = true;

  const total = crucigrama.entradas.length;
  const falladas = [];
  crucigrama.entradas.forEach((e, idx) => {
    if (textoDe(e) === e.palabra) ponerEstado(idx, 'correcta');
    else {
      falladas.push(e);
      ponerEstado(idx, 'incorrecta');
    }
  });
  // Se muestra la solución en las casillas que quedaron mal o vacías.
  for (const celda of celdasPorClave.values()) {
    if (celda.input.value.toUpperCase() !== celda.letra) {
      celda.input.value = celda.letra;
      celda.elemento.classList.add('crucigrama__celda--solucion');
    }
    celda.input.readOnly = true;
  }

  const correctas = total - falladas.length;
  const errores = falladas.length + reveladas;
  const duracionSeg = Math.max(1, Math.round((Date.now() - inicioJuego) / 1000));

  try {
    await registrarIntento({
      actividad: 'crucigrama',
      temaId: temaActual.id,
      puntaje: correctas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch (error) {
    console.warn('Error al registrar intento de crucigrama:', error);
    ui.aviso('No se pudo guardar tu resultado. Revisa tu conexión.', 'error');
  }

  document.getElementById('accionesFinales').style.display = 'flex';
  const recomendaciones = [];
  if (falladas.length) recomendaciones.push(`Repasa estos términos: ${falladas.map((e) => e.palabra.toLowerCase()).join(', ')}.`);
  if (reveladas) recomendaciones.push(`Usaste ${reveladas} letra(s) revelada(s).`);
  recomendaciones.push(`Tiempo empleado: ${Math.floor(duracionSeg / 60)} min ${duracionSeg % 60} s`);

  const decision = await mostrarResumen({
    titulo: correctas === total && reveladas === 0 ? '¡Crucigrama completado! 🏆' : 'Fin del crucigrama',
    aciertos: correctas,
    errores,
    recomendaciones,
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
  });
  if (decision === 'repetir') nuevoCrucigrama();
}

function mostrarVacio(mensaje) {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">📖</div>
      <h2 class="vacio__titulo">No hay términos suficientes</h2>
      <p class="vacio__texto">${mensaje}</p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--primario">Repasar el tema</a>
        <button type="button" id="btnElegirOtro" class="btn btn--secundario">Elegir otro tema</button>
      </div>
    </div>`;
  document.getElementById('btnElegirOtro').addEventListener('click', async () => {
    const nuevo = await obtenerTemaActividad();
    if (nuevo) cargarParaTema(nuevo);
  });
}

function nuevoCrucigrama() {
  const elegidos = util.barajar(candidatosDelGlosario()).slice(0, MAX_CANDIDATOS);
  crucigrama = generarCrucigrama(elegidos);
  if (crucigrama.entradas.length < MIN_PALABRAS) {
    mostrarVacio(`El tema <strong>${ui.escapar(temaActual.titulo)}</strong> necesita más términos de una sola palabra, de 3 a 12 letras, en el glosario para armar el crucigrama.`);
    return;
  }
  montarTablero();
}

async function cargarParaTema(tema) {
  if (!tema || !tema.id) return;
  temaActual = tema;
  ui.cargando(true);
  try {
    const glosario = await api.listar('glosario', { temaId: tema.id });
    glosarioTema = Array.isArray(glosario) ? glosario : [];
    nuevoCrucigrama();
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar el glosario.', 'error');
  } finally {
    ui.cargando(false);
  }
}

if (typeof window !== 'undefined') {
  const tema = await obtenerTemaActividad();
  if (tema) {
    await cargarParaTema(tema);
  } else if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">🎮</div>
        <h2 class="vacio__titulo">Selecciona un tema para jugar</h2>
        <p class="vacio__texto">Elige un tema para armar el crucigrama con las palabras de su glosario.</p>
        <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
          <button type="button" id="btnIniciarSeleccion" class="btn btn--primario">Seleccionar tema</button>
          <a href="/paginas/actividades.html" class="btn btn--secundario">Volver a Actividades</a>
        </div>
      </div>`;
    document.getElementById('btnIniciarSeleccion').addEventListener('click', async () => {
      const nuevo = await obtenerTemaActividad();
      if (nuevo) cargarParaTema(nuevo);
    });
  }
}
