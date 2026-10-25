// publico/js/modulos/quiz.js
// Quiz por niveles: la corrección, los puntos y la aprobación las calcula el servidor

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
const ETIQUETA_ESTADO = {
  bloqueado: { texto: '🔒 Bloqueado', clase: '' },
  disponible: { texto: 'Disponible', clase: 'insignia--acento' },
  aprobado: { texto: '✅ Aprobado', clase: 'insignia--exito' }
};

let tema = null;
let nivel = 0;
let sesionId = null;
let preguntas = [];
let respondidas = new Set();
let indice = 0;

const enlaceTema = () => `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;

// ----------------------------------------------------
// NIVELES
// ----------------------------------------------------

function cabecera() {
  return `
    <div class="quiz-cabecera">
      <div>
        <h1 class="quiz-cabecera__titulo">Quiz por niveles</h1>
        <p class="quiz-cabecera__tema">Tema: <strong>${ui.escapar(tema.titulo)}</strong></p>
      </div>
      <div class="fila" style="gap: var(--espacio-s);">
        <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">🔍 Cambiar tema</button>
        <a href="${enlaceTema()}" target="_blank" rel="noopener noreferrer" class="btn btn--texto btn--pequeno">📖 Ver tema</a>
      </div>
    </div>`;
}

function enlazarCambiarTema() {
  document.getElementById('btnCambiarTema').addEventListener('click', async () => {
    const nuevo = await obtenerTemaActividad();
    if (nuevo) {
      tema = nuevo;
      history.replaceState(null, '', `?temaId=${encodeURIComponent(nuevo.id)}`);
      mostrarNiveles();
    }
  });
}

async function mostrarNiveles() {
  ui.cargando(true);
  let niveles;
  try {
    ({ niveles } = await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(tema.id)}`));
  } catch (error) {
    ui.aviso(error.message || 'No se pudo cargar el estado del quiz.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }

  contenido.innerHTML = `
    <div class="quiz-vista">
      ${cabecera()}
      <p style="margin: 0;">Supera cada nivel con el 70 % o más para desbloquear el siguiente y ganar tu diploma.</p>
      <div class="quiz-niveles">
        ${niveles.map((n) => {
          const etiqueta = ETIQUETA_ESTADO[n.estado];
          return `
            <article class="quiz-nivel quiz-nivel--${n.estado}" aria-labelledby="nivel-${n.nivel}">
              <h2 class="quiz-nivel__titulo" id="nivel-${n.nivel}">Nivel ${n.nivel} · ${ui.escapar(n.nombre)}</h2>
              <div><span class="insignia ${etiqueta.clase}">${etiqueta.texto}</span></div>
              <p class="quiz-nivel__mejor">${n.mejorPorcentaje > 0 ? `Mejor resultado: <strong>${n.mejorPorcentaje} %</strong>` : 'Aún sin intentos'}</p>
              <div class="quiz-nivel__acciones">
                <button type="button" class="btn btn--primario btn--pequeno" data-iniciar="${n.nivel}" ${n.estado === 'bloqueado' ? 'disabled' : ''}>
                  ${n.estado === 'aprobado' ? 'Repetir' : 'Comenzar'}
                </button>
                ${n.estado === 'aprobado' ? `<button type="button" class="btn btn--secundario btn--pequeno" data-diploma="${n.nivel}">🎓 Diploma</button>` : ''}
              </div>
            </article>`;
        }).join('')}
      </div>
    </div>`;

  enlazarCambiarTema();
  contenido.querySelectorAll('[data-iniciar]').forEach((b) => b.addEventListener('click', () => iniciarNivel(Number(b.dataset.iniciar))));
  contenido.querySelectorAll('[data-diploma]').forEach((b) => b.addEventListener('click', () => descargarDiploma(Number(b.dataset.diploma), b)));
}

async function descargarDiploma(nivelDiploma, boton) {
  if (boton) boton.disabled = true;
  try {
    const { codigo } = await generarDiploma({ tipo: 'nivel-quiz', temaId: tema.id, nivel: nivelDiploma });
    ui.aviso(`Diploma descargado. Código de verificación: ${codigo}`, 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo generar el diploma.', 'error');
  } finally {
    if (boton) boton.disabled = false;
  }
}

// ----------------------------------------------------
// PREGUNTAS
// ----------------------------------------------------

async function iniciarNivel(n) {
  ui.cargando(true);
  try {
    const sesion = await api.llamar('POST', '/api/quiz/iniciar', { temaId: tema.id, nivel: n });
    nivel = n;
    sesionId = sesion.sesionId;
    preguntas = sesion.preguntas;
    respondidas = new Set(sesion.respondidas || []);
  } catch (error) {
    ui.aviso(error.message || 'No se pudo iniciar el quiz.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }
  indice = preguntas.findIndex((p) => !respondidas.has(p.id));
  if (indice === -1) return finalizar();
  mostrarPregunta();
}

function mostrarPregunta() {
  const p = preguntas[indice];
  const total = preguntas.length;
  const porcentaje = Math.round((indice / total) * 100);

  let controles;
  if (p.tipo === 'opcion') {
    controles = `
      <fieldset class="quiz-opciones" id="controles">
        <legend class="sr-only">Elige una opción</legend>
        ${p.opciones.map((o, i) => `
          <label class="quiz-opcion"><input type="radio" name="respuesta" value="${i}"> <span>${ui.escapar(o)}</span></label>`).join('')}
      </fieldset>`;
  } else if (p.tipo === 'vf') {
    controles = `
      <fieldset class="quiz-opciones quiz-opciones--vf" id="controles">
        <legend class="sr-only">Verdadero o falso</legend>
        <label class="quiz-opcion"><input type="radio" name="respuesta" value="true"> <span>Verdadero</span></label>
        <label class="quiz-opcion"><input type="radio" name="respuesta" value="false"> <span>Falso</span></label>
      </fieldset>`;
  } else {
    controles = `
      <div class="campo" id="controles">
        <label for="respuestaTexto" class="sr-only">Tu respuesta</label>
        <input type="text" id="respuestaTexto" class="quiz-completar" autocomplete="off" placeholder="Escribe tu respuesta" maxlength="120">
      </div>`;
  }

  contenido.innerHTML = `
    <div class="quiz-vista">
      ${cabecera()}
      <section class="quiz-pregunta" aria-labelledby="enunciado">
        <div class="quiz-pregunta__avance">
          <span>Nivel ${nivel} · Pregunta ${indice + 1} de ${total}</span>
          <span>${porcentaje} %</span>
        </div>
        <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${porcentaje}" aria-label="Avance del quiz">
          <span style="width: ${porcentaje}%"></span>
        </div>
        <h2 class="quiz-pregunta__enunciado" id="enunciado" tabindex="-1">${ui.escapar(p.enunciado)}</h2>
        ${controles}
        <div id="contenedorRetro"></div>
        <div class="quiz-acciones">
          <button type="button" id="btnResponder" class="btn btn--primario" disabled>Responder</button>
          <button type="button" id="btnSiguiente" class="btn btn--primario" hidden>${indice === total - 1 ? 'Ver resultado' : 'Siguiente'}</button>
        </div>
      </section>
    </div>`;

  enlazarCambiarTema();
  const btn = document.getElementById('btnResponder');
  const entrada = p.tipo === 'completar' ? document.getElementById('respuestaTexto') : null;
  const habilitar = () => {
    btn.disabled = p.tipo === 'completar' ? !entrada.value.trim() : !contenido.querySelector('input[name="respuesta"]:checked');
  };
  contenido.querySelectorAll('input').forEach((i) => i.addEventListener('input', habilitar));
  contenido.querySelectorAll('input[type="radio"]').forEach((i) => i.addEventListener('change', habilitar));
  if (entrada) {
    entrada.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) responder();
    });
  }
  btn.addEventListener('click', responder);
  document.getElementById('btnSiguiente').addEventListener('click', siguiente);
  (entrada || document.getElementById('enunciado')).focus();
}

function leerRespuesta(p) {
  if (p.tipo === 'completar') return document.getElementById('respuestaTexto').value.trim();
  const marcada = contenido.querySelector('input[name="respuesta"]:checked');
  if (!marcada) return null;
  return p.tipo === 'vf' ? marcada.value === 'true' : Number(marcada.value);
}

async function responder() {
  const p = preguntas[indice];
  const respuesta = leerRespuesta(p);
  if (respuesta === null || respuesta === '') return;

  const btn = document.getElementById('btnResponder');
  btn.disabled = true;
  let resultado;
  try {
    resultado = await api.llamar('POST', '/api/quiz/responder', { sesionId, preguntaId: p.id, respuesta });
  } catch (error) {
    ui.aviso(error.message || 'No se pudo enviar la respuesta.', 'error');
    btn.disabled = false;
    return;
  }
  respondidas.add(p.id);

  // Se bloquean los controles para que la respuesta no cambie después de ver la corrección.
  contenido.querySelectorAll('#controles input').forEach((i) => { i.disabled = true; });
  document.getElementById('controles').classList.add('quiz-opciones--bloqueadas');
  mostrarRetro({
    correcto: resultado.correcto,
    explicacion: resultado.correcto
      ? resultado.retroalimentacion
      : `La respuesta correcta es: ${resultado.correcta}. ${resultado.retroalimentacion}`,
    enlaceTema: resultado.correcto ? '' : enlaceTema(),
    contenedor: '#contenedorRetro'
  });
  btn.hidden = true;
  const siguienteBtn = document.getElementById('btnSiguiente');
  siguienteBtn.hidden = false;
  siguienteBtn.focus();
}

function siguiente() {
  indice = preguntas.findIndex((p, i) => i > indice && !respondidas.has(p.id));
  if (indice === -1) finalizar();
  else mostrarPregunta();
}

// ----------------------------------------------------
// RESULTADO
// ----------------------------------------------------

async function finalizar() {
  let resultado;
  ui.cargando(true);
  try {
    resultado = await api.llamar('POST', '/api/quiz/finalizar', { sesionId });
  } catch (error) {
    ui.aviso(error.message || 'No se pudo calcular el resultado.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }

  contenido.innerHTML = `
    <div class="quiz-vista">
      ${cabecera()}
      <section class="quiz-resultado ${resultado.aprobado ? 'quiz-resultado--aprobado' : ''}" aria-labelledby="tituloResultado">
        <h2 id="tituloResultado" style="margin: 0;">${resultado.aprobado ? `¡Aprobaste el nivel ${nivel}! 🎉` : `Aún no apruebas el nivel ${nivel}`}</h2>
        <p class="quiz-resultado__porcentaje">${resultado.porcentaje} %</p>
        <p style="margin: 0;">${resultado.aciertos} de ${resultado.total} respuestas correctas${resultado.aprobado ? '' : ' (necesitas 70 % o más)'}.</p>
        ${resultado.aviso ? `<p class="alerta alerta--advertencia">${ui.escapar(resultado.aviso)}</p>` : ''}
        <div class="quiz-resultado__acciones">
          ${resultado.aprobado ? '<button type="button" id="btnDiploma" class="btn btn--primario">🎓 Descargar diploma</button>' : ''}
          ${resultado.aprobado && nivel < 5 ? `<button type="button" id="btnSiguienteNivel" class="btn btn--primario">Ir al nivel ${nivel + 1} →</button>` : ''}
          <button type="button" id="btnReintentar" class="btn btn--secundario">🔄 ${resultado.aprobado ? 'Repetir este nivel' : 'Reintentar'}</button>
          <button type="button" id="btnNiveles" class="btn btn--secundario">Volver a los niveles</button>
        </div>
      </section>
    </div>`;
  enlazarCambiarTema();
  document.getElementById('btnReintentar').addEventListener('click', () => iniciarNivel(nivel));
  document.getElementById('btnNiveles').addEventListener('click', mostrarNiveles);
  document.getElementById('btnDiploma')?.addEventListener('click', (e) => descargarDiploma(nivel, e.currentTarget));
  document.getElementById('btnSiguienteNivel')?.addEventListener('click', () => iniciarNivel(nivel + 1));
  document.getElementById('tituloResultado').scrollIntoView({ block: 'center' });

  // Puntos e insignias que calculó el servidor, y luego el resumen con lo que conviene repasar.
  if (resultado.aprobado || resultado.puntosGanados > 0) await mostrarLogros(resultado);
  const recomendaciones = resultado.repasar.length
    ? resultado.repasar
    : ['¡Respondiste todo bien! Sigue con el siguiente nivel.'];
  const decision = await mostrarResumen({
    titulo: resultado.aprobado ? `Nivel ${nivel} superado` : `Resultado del nivel ${nivel}: ${resultado.porcentaje} %`,
    aciertos: resultado.aciertos,
    errores: resultado.total - resultado.aciertos,
    recomendaciones,
    enlaceTema: enlaceTema()
  });
  if (decision === 'repetir') iniciarNivel(nivel);
}

// ----------------------------------------------------
// ARRANQUE
// ----------------------------------------------------

async function arrancar() {
  tema = await obtenerTemaActividad();
  if (tema) return mostrarNiveles();
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">🎯</div>
      <h2 class="vacio__titulo">Elige un tema para el quiz</h2>
      <p class="vacio__texto">Cada tema tiene 5 niveles que se desbloquean al aprobar el anterior.</p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <button type="button" id="btnElegir" class="btn btn--primario">Seleccionar tema</button>
        <a href="/paginas/actividades.html" class="btn btn--secundario">Volver a Actividades</a>
      </div>
    </div>`;
  document.getElementById('btnElegir').addEventListener('click', arrancar);
}

await arrancar();
