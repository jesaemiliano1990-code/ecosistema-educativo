// publico/js/modulos/simulador.js
// Motor del simulador (modo escenarios): escenas con decisiones, consecuencias, informe final y puntaje

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';

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
      <div class="sim-juego__puntos" aria-live="polite">Puntos: <strong>${puntos}</strong></div>
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
      pintarMensaje('🎭', 'Próximamente', 'El modo de juego de rol estará disponible pronto.');
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
