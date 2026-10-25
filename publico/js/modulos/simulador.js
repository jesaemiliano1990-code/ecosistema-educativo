// publico/js/modulos/simulador.js
// Motor del simulador (modo escenarios): escenas con decisiones, consecuencias, informe final y puntaje

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Simulador', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const idSimulacion = util.parametro('id');
const esPrevia = util.parametro('vista') === 'previa';

let simulacion = null;
let escenas = new Map();
let maximo = 1; // puntaje del mejor camino
let puntos = 0;
let recorrido = []; // [{ escena, decision, consecuencia, puntos }]
let inicio = 0;

const por = (id) => document.getElementById(id);
const esFinal = (escena) => !escena.opciones.length;

// Mejor puntaje posible recorriendo el escenario (sin repetir escenas en un mismo camino).
function mejorPuntaje(id, visitadas = new Set()) {
  const escena = escenas.get(id);
  if (!escena || esFinal(escena) || visitadas.has(id)) return 0;
  const siguientes = new Set(visitadas).add(id);
  let mejor = -Infinity;
  for (const o of escena.opciones) {
    if (!escenas.has(o.destino) || siguientes.has(o.destino)) continue;
    mejor = Math.max(mejor, o.puntos + mejorPuntaje(o.destino, siguientes));
  }
  return mejor === -Infinity ? 0 : mejor;
}

function pintarMensaje(icono, titulo, texto, volver = true) {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">${icono}</div>
      <h2 class="vacio__titulo">${ui.escapar(titulo)}</h2>
      <p class="vacio__texto">${ui.escapar(texto)}</p>
      ${volver ? '<a href="/paginas/simulaciones.html" class="btn btn--primario">Volver a Simulaciones</a>' : ''}
    </div>`;
}

// Solo se muestran imágenes de la plataforma (/...) o https.
function imagenEscena(escena) {
  return /^(\/(?!\/)|https:\/\/)/.test(escena.imagen || '')
    ? `<img class="sim-escena__imagen" src="${ui.escapar(escena.imagen)}" alt="Ilustración de la escena">`
    : '';
}

function cabecera() {
  return `
    <div class="sim-juego__cabecera">
      <div>
        <h1 class="sim-juego__titulo">${ui.escapar(simulacion.titulo)}</h1>
        ${esPrevia ? '<span class="insignia insignia--acento">Vista previa: no se registran puntos</span>' : ''}
      </div>
      ${simulacion.modo === 'rol' ? '' : `<div class="sim-juego__puntos" aria-live="polite">Puntos: <strong>${puntos}</strong></div>`}
    </div>`;
}

function mostrarEscena(id) {
  const escena = escenas.get(id);
  if (!escena) {
    pintarMensaje('⚠️', 'Escena no encontrada', 'Esta simulación tiene un enlace roto. Avisa a tu docente.');
    return;
  }
  if (esFinal(escena)) {
    mostrarInforme(escena);
    return;
  }

  contenido.innerHTML = `
    <div class="sim-juego">
      ${cabecera()}
      <section class="tarjeta sim-escena" aria-label="Escena ${recorrido.length + 1}">
        <p class="sim-escena__paso">Decisión ${recorrido.length + 1}</p>
        ${imagenEscena(escena)}
        <div class="sim-escena__texto">${util.formatoBasico(escena.texto)}</div>
        <div class="sim-opciones" id="opciones" role="group" aria-label="¿Qué haces?">
          ${escena.opciones.map((o, i) => `<button type="button" class="btn btn--secundario sim-opcion" data-op="${i}">${ui.escapar(o.texto)}</button>`).join('')}
        </div>
        <div id="zonaRetro" aria-live="polite"></div>
        <div class="sim-escena__pie" id="zonaContinuar"></div>
      </section>
    </div>`;

  por('opciones').querySelectorAll('[data-op]').forEach((boton) => {
    boton.addEventListener('click', () => elegir(escena, escena.opciones[Number(boton.dataset.op)], boton));
  });
  por('opciones').querySelector('button')?.focus();
}

function elegir(escena, opcion, boton) {
  puntos += opcion.puntos;
  recorrido.push({ decision: opcion.texto, consecuencia: opcion.consecuencia, puntos: opcion.puntos, escena: escena.texto });

  por('opciones').querySelectorAll('button').forEach((b) => {
    b.disabled = true;
    b.classList.toggle('sim-opcion--elegida', b === boton);
  });
  por('zonaRetro').appendChild(mostrarRetro({
    correcto: opcion.puntos > 0,
    explicacion: opcion.consecuencia || (opcion.puntos > 0 ? 'Buena decisión.' : 'Esta decisión no fue la mejor.'),
    enlaceTema: opcion.puntos > 0 ? '' : `/paginas/tema.html?id=${encodeURIComponent(simulacion.temaId)}`
  }));
  document.querySelector('.sim-juego__puntos strong').textContent = String(puntos);

  const continuar = document.createElement('button');
  continuar.type = 'button';
  continuar.className = 'btn btn--primario';
  continuar.textContent = 'Continuar';
  continuar.addEventListener('click', () => mostrarEscena(opcion.destino));
  por('zonaContinuar').appendChild(continuar);
  continuar.focus();
}

async function mostrarInforme(final) {
  const puntaje = Math.min(maximo, Math.max(0, puntos));
  const errores = recorrido.filter((r) => r.puntos <= 0).length;

  contenido.innerHTML = `
    <div class="sim-juego">
      ${cabecera()}
      <section class="tarjeta sim-informe" aria-labelledby="tituloInforme">
        <h2 id="tituloInforme" class="sim-informe__titulo">Informe de la simulación</h2>
        <div class="sim-escena__texto">${util.formatoBasico(final.texto)}</div>
        <p class="sim-informe__puntaje">Puntaje: <strong>${puntaje} / ${maximo}</strong></p>
        <ol class="sim-informe__lista">
          ${recorrido.map((r) => `
            <li class="sim-informe__item ${r.puntos > 0 ? 'sim-informe__item--bien' : 'sim-informe__item--mal'}">
              <strong>${ui.escapar(r.decision)}</strong>
              ${r.consecuencia ? `<span>${ui.escapar(r.consecuencia)}</span>` : ''}
              <span class="sim-informe__pts">${r.puntos > 0 ? '+' : ''}${r.puntos} pts</span>
            </li>`).join('')}
        </ol>
        <div class="sim-escena__pie">
          <button type="button" id="btnRepetir" class="btn btn--secundario">🔄 Repetir</button>
          <a href="/paginas/simulaciones.html" class="btn btn--primario">Volver a Simulaciones</a>
        </div>
      </section>
    </div>`;
  por('btnRepetir').addEventListener('click', empezar);

  if (esPrevia) return;
  try {
    await registrarIntento({
      actividad: 'simulacion',
      temaId: simulacion.temaId,
      puntaje,
      maximo,
      errores,
      duracionSeg: Math.round((Date.now() - inicio) / 1000),
      detalle: { simulacionId: simulacion.id, recorrido: recorrido.map((r) => ({ decision: r.decision, puntos: r.puntos })) }
    });
  } catch (error) {
    ui.aviso(error.message || 'No se pudo registrar tu intento.', 'error');
  }
}

// ----------------------------------------------------
// MODO ROL: chat con el personaje y evaluación con rúbrica
// ----------------------------------------------------

let mensajesRol = []; // [{ rol: 'estudiante' | 'personaje', texto }]
let esperandoRol = false;
let terminado = false;

const turnosUsados = () => mensajesRol.filter((m) => m.rol === 'estudiante').length;

function burbujaRol(m) {
  const quien = m.rol === 'estudiante' ? 'Tú' : simulacion.personaje.nombre;
  return `
    <div class="sim-burbuja${m.rol === 'estudiante' ? ' sim-burbuja--estudiante' : ''}">
      <span class="sim-burbuja__autor">${ui.escapar(quien)}</span>
      ${util.formatoBasico(m.texto)}
    </div>`;
}

function pintarChat() {
  const max = simulacion.maxTurnos;
  const usados = turnosUsados();
  por('hiloRol').innerHTML = mensajesRol.map(burbujaRol).join('')
    + (esperandoRol ? '<div class="sim-pensando" role="status">El personaje está respondiendo...</div>' : '');
  por('hiloRol').scrollTop = por('hiloRol').scrollHeight;
  por('turnosRol').textContent = `Turno ${Math.min(usados + (esperandoRol || terminado ? 0 : 1), max)} de ${max}`;
  const bloqueado = esperandoRol || terminado;
  por('textoRol').disabled = bloqueado;
  por('btnEnviarRol').disabled = bloqueado;
  por('btnTerminarRol').disabled = bloqueado || usados === 0;
}

function presentarCaso() {
  const p = simulacion.personaje;
  contenido.innerHTML = `
    <div class="sim-juego">
      ${cabecera()}
      <section class="tarjeta sim-escena" aria-labelledby="tituloCaso">
        <p class="sim-escena__paso">Juego de rol</p>
        <h2 id="tituloCaso" class="sim-informe__titulo">Conversarás con ${ui.escapar(p.nombre)}</h2>
        <p>${ui.escapar(p.descripcion)}</p>
        <div class="sim-escena__texto"><strong>Situación:</strong> ${util.formatoBasico(p.contexto)}</div>
        <div class="sim-escena__texto"><strong>Tu objetivo:</strong> ${util.formatoBasico(p.objetivo)}</div>
        <p class="texto-suave">Tienes hasta ${simulacion.maxTurnos} turnos. Al terminar recibirás una evaluación por criterios.</p>
        <details class="sim-rubrica">
          <summary>Ver rúbrica de evaluación</summary>
          <ul>${(simulacion.rubrica || []).map((r) => `<li><strong>${ui.escapar(r.criterio)}</strong> (${Number(r.puntos)} pts): ${ui.escapar(r.descripcion)}</li>`).join('')}</ul>
        </details>
        <div class="sim-escena__pie">
          <button type="button" id="btnComenzarRol" class="btn btn--primario">Comenzar</button>
          <a href="/paginas/simulaciones.html" class="btn btn--secundario">Volver a Simulaciones</a>
        </div>
      </section>
    </div>`;
  por('btnComenzarRol').addEventListener('click', comenzarRol);
  por('btnComenzarRol').focus();
}

function comenzarRol() {
  mensajesRol = [];
  esperandoRol = false;
  terminado = false;
  inicio = Date.now();
  contenido.innerHTML = `
    <div class="sim-juego">
      ${cabecera()}
      <section class="tarjeta sim-chat" aria-label="Conversación con ${ui.escapar(simulacion.personaje.nombre)}">
        <div class="sim-chat__barra">
          <strong>${ui.escapar(simulacion.personaje.nombre)}</strong>
          <span id="turnosRol" class="texto-suave"></span>
        </div>
        <div class="sim-chat__hilo" id="hiloRol" role="log" aria-live="polite" tabindex="0"></div>
        <form id="formRol" class="sim-chat__form">
          <label for="textoRol" class="sr-only">Escribe tu mensaje para el personaje</label>
          <textarea id="textoRol" rows="2" maxlength="1000" placeholder="Escribe lo que le dirías al personaje…"></textarea>
          <div class="sim-escena__pie">
            <button type="submit" id="btnEnviarRol" class="btn btn--primario">Enviar</button>
            <button type="button" id="btnTerminarRol" class="btn btn--secundario">Terminar y evaluar</button>
          </div>
        </form>
      </section>
    </div>`;
  por('formRol').addEventListener('submit', (e) => { e.preventDefault(); enviarRol(por('textoRol').value); });
  por('btnTerminarRol').addEventListener('click', evaluarRol);
  por('textoRol').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); por('formRol').requestSubmit(); }
  });
  pintarChat();
  por('textoRol').focus();
}

async function enviarRol(texto) {
  const mensaje = texto.trim();
  if (!mensaje || esperandoRol || terminado || turnosUsados() >= simulacion.maxTurnos) return;
  mensajesRol.push({ rol: 'estudiante', texto: mensaje.slice(0, 1000) });
  esperandoRol = true;
  por('textoRol').value = '';
  pintarChat();
  cambiarEstado('pensando');
  try {
    const { texto: respuesta } = await api.ia('rol-simulacion', { simulacionId: simulacion.id, historial: mensajesRol });
    mensajesRol.push({ rol: 'personaje', texto: respuesta });
    decir(respuesta, { globo: false });
  } catch (error) {
    cambiarEstado('reposo');
    mensajesRol.pop(); // la pregunta sin respuesta vuelve al campo para reintentar
    por('textoRol').value = mensaje;
    ui.aviso(error.message || 'El personaje no pudo responder. Intenta de nuevo.', 'error');
  } finally {
    esperandoRol = false;
    pintarChat();
  }
  if (turnosUsados() >= simulacion.maxTurnos && mensajesRol.at(-1)?.rol === 'personaje') evaluarRol();
}

async function evaluarRol() {
  if (esperandoRol || terminado || turnosUsados() === 0) return;
  terminado = true;
  esperandoRol = true;
  pintarChat();
  por('hiloRol').insertAdjacentHTML('beforeend', '<div class="sim-pensando" role="status">Evaluando tu desempeño...</div>');
  cambiarEstado('pensando');
  try {
    const evaluacion = await api.ia('evaluar-rol', { simulacionId: simulacion.id, historial: mensajesRol });
    mostrarEvaluacion(evaluacion);
  } catch (error) {
    cambiarEstado('reposo');
    terminado = false;
    esperandoRol = false;
    pintarChat();
    ui.aviso(error.message || 'No se pudo evaluar. Pulsa "Terminar y evaluar" para reintentar.', 'error');
  }
}

async function mostrarEvaluacion(ev) {
  cambiarEstado('reposo');
  contenido.innerHTML = `
    <div class="sim-juego">
      ${cabecera()}
      <section class="tarjeta sim-informe" aria-labelledby="tituloInforme">
        <h2 id="tituloInforme" class="sim-informe__titulo">Informe de la práctica</h2>
        <p class="sim-informe__puntaje">Puntaje: <strong>${ev.puntaje} / ${ev.maximo}</strong></p>
        <ul class="sim-informe__lista sim-informe__lista--rol">
          ${ev.criterios.map((c) => `
            <li class="sim-informe__item ${c.puntos >= c.maximo / 2 ? 'sim-informe__item--bien' : 'sim-informe__item--mal'}">
              <strong>${ui.escapar(c.criterio)}</strong>
              ${c.comentario ? `<span>${ui.escapar(c.comentario)}</span>` : ''}
              <span class="sim-informe__pts">${c.puntos} / ${c.maximo} pts</span>
            </li>`).join('')}
        </ul>
        <div class="sim-escena__texto"><strong>Comentario general:</strong> ${util.formatoBasico(ev.comentarioGeneral)}</div>
        <div class="sim-escena__pie">
          <button type="button" id="btnRepetirRol" class="btn btn--secundario">🔄 Repetir</button>
          <a href="/paginas/simulaciones.html" class="btn btn--primario">Volver a Simulaciones</a>
        </div>
      </section>
    </div>`;
  por('btnRepetirRol').addEventListener('click', presentarCaso);

  if (esPrevia) return;
  try {
    await registrarIntento({
      actividad: 'simulacion',
      temaId: simulacion.temaId,
      puntaje: ev.puntaje,
      maximo: Math.max(1, ev.maximo),
      errores: ev.criterios.filter((c) => c.puntos < c.maximo).length,
      duracionSeg: Math.round((Date.now() - inicio) / 1000),
      detalle: { simulacionId: simulacion.id, modo: 'rol' }
    });
  } catch (error) {
    ui.aviso(error.message || 'No se pudo registrar tu intento.', 'error');
  }
}

function empezar() {
  puntos = 0;
  recorrido = [];
  inicio = Date.now();
  mostrarEscena(simulacion.escenaInicial);
}

try {
  if (!idSimulacion) {
    pintarMensaje('🎭', 'Elige una simulación', 'Abre una simulación desde la lista para empezar.');
  } else {
    simulacion = await api.obtener('simulaciones', idSimulacion);
    if (simulacion.modo === 'rol') {
      const p = simulacion.personaje || {};
      if (!p.nombre || !p.contexto || !simulacion.rubrica?.length) {
        pintarMensaje('🛠️', 'Simulación incompleta', 'Esta simulación de rol aún no está lista. Avisa a tu docente.');
      } else {
        presentarCaso();
      }
    } else {
      escenas = new Map((simulacion.escenas || []).map((e) => [e.id, e]));
      if (!escenas.has(simulacion.escenaInicial)) {
        pintarMensaje('🛠️', 'Simulación incompleta', 'Esta simulación aún no tiene escenas.');
      } else {
        maximo = Math.max(1, mejorPuntaje(simulacion.escenaInicial));
        empezar();
      }
    }
  }
} catch (error) {
  pintarMensaje('⚠️', 'No se encontró la simulación', error.message || 'Puede que no exista o que no esté publicada.');
}
