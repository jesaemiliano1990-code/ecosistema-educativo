// publico/js/modulos/tutor.js
// Tutor IA socrático: chat que guía con preguntas a partir del contenido del tema

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Tutor IA', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
const MAX_TEXTO = 1000; // el servidor recorta cada mensaje a 1.000 caracteres
const MAX_HISTORIAL = 10;
const MAX_CHIPS = 3;
const SUGERENCIAS_BASE = [
  '¿De qué trata este tema?',
  'Quiero repasar los conceptos clave.',
  'Ayúdame a entender un ejemplo.'
];

let tema = null;
let historial = []; // solo en memoria: [{ rol: 'estudiante' | 'tutor', texto }]
let enEspera = false;
let sinConsultas = false; // se alcanzó el límite diario

const por = (id) => document.getElementById(id);
const enlaceTema = () => `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;

// ----------------------------------------------------
// CHAT
// ----------------------------------------------------

function burbuja(clase, autor, texto) {
  return `
    <div class="tutor-burbuja ${clase}">
      ${autor ? `<span class="tutor-burbuja__autor">${ui.escapar(autor)}</span>` : ''}
      ${util.formatoBasico(texto)}
    </div>`;
}

function pintarHilo() {
  const zona = por('tutorHilo');
  const saludo = burbuja('', 'Tutor', 'Hola, soy tu tutor. No te daré las respuestas hechas: te haré preguntas para que las descubras tú. Elige una pregunta de arriba o escribe la tuya.');
  const mensajes = historial.map((m) => (m.rol === 'estudiante' ? burbuja('tutor-burbuja--estudiante', 'Tú', m.texto) : burbuja('', 'Tutor', m.texto)));
  const aviso = sinConsultas
    ? burbuja('tutor-burbuja--aviso', '', 'Hoy ya usaste todas tus consultas al tutor. ¡Descansa y vuelve mañana! Mientras tanto puedes repasar el tema o practicar con las actividades.')
    : '';
  const pensando = enEspera
    ? '<div class="tutor-pensando" role="status"><span class="tutor-pensando__puntos" aria-hidden="true"><span></span><span></span><span></span></span>El tutor está pensando...</div>'
    : '';
  zona.innerHTML = saludo + mensajes.join('') + pensando + aviso;
  zona.scrollTop = zona.scrollHeight;
}

function actualizarControles() {
  const bloqueado = enEspera || sinConsultas;
  por('textoTutor').disabled = bloqueado;
  por('formTutor').querySelector('button[type="submit"]').disabled = bloqueado;
  document.querySelectorAll('.tutor-chip').forEach((c) => { c.disabled = bloqueado; });
}

async function enviar(texto) {
  const pregunta = texto.trim();
  if (!pregunta || enEspera || sinConsultas) return;

  historial.push({ rol: 'estudiante', texto: pregunta.slice(0, MAX_TEXTO) });
  enEspera = true;
  por('textoTutor').value = '';
  por('contadorTutor').textContent = '0';
  pintarHilo();
  actualizarControles();
  cambiarEstado('pensando');

  try {
    const { respuesta } = await api.ia('tutor', { temaId: tema.id, historial: historial.slice(-MAX_HISTORIAL) });
    historial.push({ rol: 'tutor', texto: respuesta });
    // "hablando" mientras responde; solo se lee en voz alta si la voz está activa (el texto ya está en el chat).
    decir(respuesta, { globo: false });
  } catch (error) {
    cambiarEstado('reposo');
    // Se quita la pregunta que no se pudo contestar y se devuelve al campo para reintentar.
    historial.pop();
    if (/l[ií]mite diario/i.test(error.message || '')) {
      sinConsultas = true;
    } else {
      por('textoTutor').value = pregunta;
      por('contadorTutor').textContent = String(pregunta.length);
      ui.aviso(error.message || 'No se pudo consultar al tutor. Intenta de nuevo.', 'error');
    }
  } finally {
    enEspera = false;
    pintarHilo();
    actualizarControles();
    if (!sinConsultas) por('textoTutor').focus();
  }
}

async function nuevaConversacion() {
  if (historial.length && !(await ui.confirmar('¿Empezar una conversación nueva? Se borrará la actual.'))) return;
  historial = [];
  pintarHilo();
  por('textoTutor').focus();
}

// ----------------------------------------------------
// PÁGINA
// ----------------------------------------------------

function pintarPagina() {
  const guia = (Array.isArray(tema.preguntasGuia) ? tema.preguntasGuia : []).filter((p) => typeof p === 'string' && p.trim());
  const sugerencias = (guia.length ? guia : SUGERENCIAS_BASE).slice(0, MAX_CHIPS);

  contenido.innerHTML = `
    <div class="tutor-vista">
      <div class="tutor-cabecera">
        <div>
          <h1 class="tutor-cabecera__titulo">Tutor IA</h1>
          <p class="tutor-cabecera__tema">Tema: <strong>${ui.escapar(tema.titulo)}</strong></p>
        </div>
        <div class="tutor-cabecera__acciones">
          <button type="button" id="btnNueva" class="btn btn--secundario btn--pequeno">🔄 Nueva conversación</button>
          <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">🔍 Cambiar tema</button>
          <a href="${enlaceTema()}" class="btn btn--texto btn--pequeno">📖 Ver tema</a>
        </div>
      </div>

      <div class="tutor-chips" role="group" aria-label="Preguntas para empezar">
        <span class="tutor-chips__etiqueta">Para empezar:</span>
        ${sugerencias.map((s, i) => `<button type="button" class="tutor-chip" data-chip="${i}">${ui.escapar(s)}</button>`).join('')}
      </div>

      <section class="tutor-chat" aria-label="Conversación con el tutor">
        <div class="tutor-hilo" id="tutorHilo" role="log" aria-live="polite" tabindex="0"></div>
        <form class="tutor-form" id="formTutor">
          <div class="tutor-form__fila">
            <label for="textoTutor" class="sr-only">Escribe tu pregunta o respuesta</label>
            <textarea id="textoTutor" rows="2" maxlength="${MAX_TEXTO}" placeholder="Escribe tu pregunta o tu respuesta…"></textarea>
            <button type="submit" class="btn btn--primario">Enviar</button>
          </div>
          <div class="tutor-form__pie">
            <span>Enter envía · Mayús + Enter nueva línea</span>
            <span><span id="contadorTutor">0</span> / ${MAX_TEXTO}</span>
          </div>
        </form>
      </section>
    </div>`;

  pintarHilo();
  por('btnNueva').addEventListener('click', nuevaConversacion);
  por('btnCambiarTema').addEventListener('click', async () => {
    const nuevo = await obtenerTemaActividad();
    if (!nuevo) return;
    tema = nuevo;
    historial = [];
    history.replaceState(null, '', `?temaId=${encodeURIComponent(nuevo.id)}`);
    pintarPagina();
    actualizarControles();
  });
  contenido.querySelectorAll('[data-chip]').forEach((chip) => chip.addEventListener('click', () => enviar(sugerencias[Number(chip.dataset.chip)])));

  const campo = por('textoTutor');
  por('formTutor').addEventListener('submit', (e) => { e.preventDefault(); enviar(campo.value); });
  campo.addEventListener('input', () => { por('contadorTutor').textContent = campo.value.length; });
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      por('formTutor').requestSubmit();
    }
  });
  actualizarControles();
  campo.focus();
}

tema = await obtenerTemaActividad();
if (tema) {
  pintarPagina();
} else {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">🧠</div>
      <h2 class="vacio__titulo">Elige un tema para conversar</h2>
      <p class="vacio__texto">El tutor te hace preguntas guía sobre el tema que elijas, sin darte la respuesta hecha.</p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <button type="button" id="btnElegir" class="btn btn--primario">Seleccionar tema</button>
        <a href="/paginas/actividades.html" class="btn btn--secundario">Volver a Actividades</a>
      </div>
    </div>`;
  por('btnElegir').addEventListener('click', () => location.reload());
}
