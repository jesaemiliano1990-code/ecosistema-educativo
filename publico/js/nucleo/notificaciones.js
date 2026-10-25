// publico/js/nucleo/notificaciones.js
// Campana de notificaciones del encabezado: contador, panel, sondeo cada 60 s y avisos del navegador

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import { usuarioActual } from './sesion.js';

const INTERVALO_MS = 60000;
const ROTULOS = {
  'mensaje-docente': 'Mensaje de tu docente',
  recordatorio: 'Recordatorio',
  foro: 'Foro',
  noticia: 'Noticia',
  alerta: 'Alerta',
  'banco-preguntas': 'Banco de preguntas'
};

let estado = { lista: [], noLeidas: 0 };
let temporizador = null;
let consultando = false;

export function noLeidas() {
  return estado.noLeidas;
}

function soportaAvisos() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// ----------------------------------------------------
// PINTAR
// ----------------------------------------------------

function pintarContador() {
  const contador = document.getElementById('campanaContador');
  const boton = document.getElementById('btnCampana');
  if (!contador || !boton) return;
  const n = estado.noLeidas;
  contador.hidden = n === 0;
  contador.textContent = n > 99 ? '99+' : String(n);
  boton.setAttribute('aria-label', n === 0 ? 'Notificaciones: ninguna sin leer' : `Notificaciones: ${n} sin leer`);
}

function pintarLista() {
  const ul = document.getElementById('listaCampana');
  if (!ul) return;
  if (!estado.lista.length) {
    ul.innerHTML = '<li class="campana__vacio">No tienes notificaciones.</li>';
    return;
  }
  ul.innerHTML = estado.lista.map((n) => {
    const rotulo = ROTULOS[n.tipo] ? `<span class="campana__tipo">${ui.escapar(ROTULOS[n.tipo])}</span>` : '';
    const cuerpo = `
      ${rotulo}
      <span class="campana__texto">${ui.escapar(n.mensaje)}</span>
      <span class="campana__fecha">${ui.escapar(util.fechaRelativa(n.fecha))}</span>`;
    const clase = `campana__item ${n.leida ? '' : 'campana__item--nueva'}`;
    return `<li>${n.enlace
      ? `<a class="${clase}" href="${ui.escapar(n.enlace)}" data-id="${ui.escapar(n.id)}">${cuerpo}</a>`
      : `<button type="button" class="${clase}" data-id="${ui.escapar(n.id)}">${cuerpo}</button>`}</li>`;
  }).join('');
}

function pintarAvisosNavegador() {
  const zona = document.getElementById('avisosNavegador');
  if (!zona) return;
  if (!soportaAvisos()) {
    zona.innerHTML = '';
    return;
  }
  const permiso = Notification.permission;
  if (permiso === 'granted') {
    zona.innerHTML = '<p class="campana__nota">✓ Avisos del navegador activados</p>';
  } else if (permiso === 'denied') {
    zona.innerHTML = '<p class="campana__nota">Los avisos del navegador están bloqueados. Actívalos en la configuración del sitio.</p>';
  } else {
    zona.innerHTML = '<button type="button" id="btnActivarAvisos" class="btn btn--secundario btn--pequeno">🔔 Activar avisos del navegador</button>';
    document.getElementById('btnActivarAvisos').addEventListener('click', activarAvisos);
  }
}

async function activarAvisos() {
  try {
    const permiso = await Notification.requestPermission();
    ui.aviso(permiso === 'granted' ? 'Avisos del navegador activados.' : 'No se activaron los avisos del navegador.', permiso === 'granted' ? 'exito' : 'info');
  } catch {
    ui.aviso('Tu navegador no permitió activar los avisos.', 'error');
  }
  pintarAvisosNavegador();
}

// ----------------------------------------------------
// DATOS
// ----------------------------------------------------

function mostrarAvisoDelSistema(recordatorio) {
  if (!soportaAvisos() || Notification.permission !== 'granted') return;
  try {
    new Notification(recordatorio.titulo || 'Recordatorio', {
      body: recordatorio.mensaje,
      tag: recordatorio.notificacionId // evita repetir el mismo aviso
    });
  } catch {
    // Algunos navegadores (p. ej., móviles) solo permiten avisos desde un service worker.
  }
}

async function consultar() {
  if (consultando || document.visibilityState !== 'visible') return;
  consultando = true;
  try {
    // Primero los recordatorios de la agenda (crean notificaciones nuevas) y después la lista.
    try {
      const nuevos = await api.llamar('GET', '/api/agenda/recordatorios');
      if (Array.isArray(nuevos)) nuevos.forEach(mostrarAvisoDelSistema);
    } catch {
      // Un fallo en los recordatorios no debe esconder las notificaciones.
    }
    const datos = await api.llamar('GET', '/api/notificaciones');
    estado = { lista: datos.notificaciones || [], noLeidas: datos.noLeidas || 0 };
    pintarContador();
    pintarLista();
  } catch {
    // Silencioso si hay un error de red; se reintenta en el siguiente ciclo.
  } finally {
    consultando = false;
  }
}

async function marcarLeida(id) {
  const n = estado.lista.find((x) => x.id === id);
  if (!n || n.leida) return;
  n.leida = true;
  estado.noLeidas = Math.max(0, estado.noLeidas - 1);
  pintarContador();
  try {
    await api.llamar('POST', `/api/notificaciones/${encodeURIComponent(id)}/leida`);
  } catch {
    // Si falla, el siguiente sondeo restablece el estado real.
  }
}

async function marcarTodas() {
  try {
    await api.llamar('POST', '/api/notificaciones/leidas');
    estado.lista.forEach((n) => { n.leida = true; });
    estado.noLeidas = 0;
    pintarContador();
    pintarLista();
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron marcar las notificaciones.', 'error');
  }
}

// ----------------------------------------------------
// MONTAJE
// ----------------------------------------------------

function alternarPanel(abrir) {
  const panel = document.getElementById('panelCampana');
  const boton = document.getElementById('btnCampana');
  if (!panel || !boton) return;
  const mostrar = typeof abrir === 'boolean' ? abrir : panel.hidden;
  panel.hidden = !mostrar;
  boton.setAttribute('aria-expanded', String(mostrar));
  if (mostrar) {
    // En pantallas angostas el panel es fijo: se coloca justo debajo del botón.
    panel.style.top = window.innerWidth <= 600 ? `${Math.round(boton.getBoundingClientRect().bottom) + 4}px` : '';
    pintarAvisosNavegador();
    consultar();
  }
}

export function montarCampana() {
  if (typeof document === 'undefined' || !usuarioActual() || document.getElementById('campana')) return;
  const contenedor = document.querySelector('.encabezado__usuario');
  if (!contenedor) return;

  contenedor.insertAdjacentHTML('afterbegin', `
    <div class="campana" id="campana">
      <button type="button" id="btnCampana" class="campana__boton" aria-haspopup="true" aria-expanded="false"
              aria-controls="panelCampana" aria-label="Notificaciones: ninguna sin leer">
        <span aria-hidden="true">🔔</span><span class="campana__contador" id="campanaContador" hidden>0</span>
      </button>
      <div class="campana__panel" id="panelCampana" role="region" aria-label="Notificaciones" hidden>
        <div class="campana__cabecera">
          <strong>Notificaciones</strong>
          <button type="button" id="btnLeerTodas" class="btn btn--texto btn--pequeno">Marcar todas como leídas</button>
        </div>
        <ul class="campana__lista" id="listaCampana"><li class="campana__vacio">Cargando…</li></ul>
        <div class="campana__pie" id="avisosNavegador"></div>
      </div>
    </div>`);

  document.getElementById('btnCampana').addEventListener('click', () => alternarPanel());
  document.getElementById('btnLeerTodas').addEventListener('click', marcarTodas);
  document.getElementById('listaCampana').addEventListener('click', async (e) => {
    const item = e.target.closest('[data-id]');
    if (!item) return;
    if (item.tagName === 'A') e.preventDefault();
    await marcarLeida(item.dataset.id);
    if (item.tagName === 'A') window.location.href = item.getAttribute('href');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#campana')) alternarPanel(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('panelCampana').hidden) {
      alternarPanel(false);
      document.getElementById('btnCampana').focus();
    }
  });
  // Solo se consulta con la pestaña visible; al volver a verla se actualiza enseguida.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') consultar(); });

  clearInterval(temporizador);
  temporizador = setInterval(consultar, INTERVALO_MS);
  consultar();
}

export default { montarCampana, noLeidas };
