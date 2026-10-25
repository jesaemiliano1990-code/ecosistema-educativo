// publico/js/modulos/mensajes.js
// Mensajería privada: lista de conversaciones, chat con sondeo cada 4 s y nueva conversación

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';
import { actualizarMensajesNoLeidos } from '../nucleo/notificaciones.js';

await montarPlantilla({ titulo: 'Mensajes', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const yo = sesion.usuarioActual();
const MAX_TEXTO = 2000;
const SONDEO_CHAT_MS = 4000;
const SONDEO_LISTA_MS = 15000;
const ROL = { docente: 'Docente', estudiante: 'Estudiante', admin: 'Admin' };

let conversaciones = [];
let abierta = null; // conversación abierta (objeto de la lista)
let mensajes = []; // de la conversación abierta, del más antiguo al más reciente
let hayAnteriores = false;
let filtro = '';
let consultandoChat = false;
let consultandoLista = false;

const por = (id) => document.getElementById(id);
const nombreDe = (u) => `${u.nombre} ${u.apellido}`.trim();
const visible = () => document.visibilityState === 'visible';

// ----------------------------------------------------
// TEXTO
// ----------------------------------------------------

// Escapa todo y solo después convierte las direcciones http(s) en enlaces; los saltos de línea pasan a <br>.
function textoConEnlaces(texto) {
  return ui.escapar(texto)
    .replace(/https?:\/\/[^\s<]+/g, (url) => {
      const final = (url.match(/[.,;:!?)\]]+$/) || [''])[0]; // la puntuación final no es parte del enlace
      const limpia = url.slice(0, url.length - final.length);
      return `<a href="${limpia}" target="_blank" rel="noopener noreferrer">${limpia}</a>${final}`;
    })
    .replace(/\r?\n/g, '<br>');
}

function hora(iso) {
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function mismoDia(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

// Hoy → hora; antes → fecha corta.
function marcaDeTiempo(iso) {
  if (!iso) return '';
  if (mismoDia(iso, Date.now())) return hora(iso);
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

function etiquetaDia(iso) {
  if (mismoDia(iso, Date.now())) return 'Hoy';
  if (mismoDia(iso, Date.now() - 86400000)) return 'Ayer';
  return new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

// ----------------------------------------------------
// LISTA DE CONVERSACIONES
// ----------------------------------------------------

function pintarLista() {
  const ul = por('conversaciones');
  const q = util.normalizar(filtro);
  const lista = conversaciones.filter((c) => !q || util.normalizar(`${nombreDe(c.otro)} ${c.ultimo?.texto || ''}`).includes(q));
  if (!lista.length) {
    ul.innerHTML = `<li><p class="mensajes-vacio">${conversaciones.length ? 'Ninguna conversación coincide con tu búsqueda.' : 'Aún no tienes conversaciones. Pulsa «Nueva» para escribir a alguien.'}</p></li>`;
    return;
  }
  ul.innerHTML = lista.map((c) => {
    const ultimo = c.ultimo ? `${c.ultimo.autorId === yo.id ? 'Tú: ' : ''}${c.ultimo.texto}` : 'Sin mensajes todavía';
    return `
      <li>
        <button type="button" class="mensajes-conv ${c.noLeidos ? 'mensajes-conv--nueva' : ''}" data-conv="${ui.escapar(c.id)}" ${abierta?.id === c.id ? 'aria-current="true"' : ''}>
          <span class="mensajes-conv__fila">
            <span class="mensajes-conv__nombre">${ui.escapar(nombreDe(c.otro))} ${c.otro.rol && c.otro.rol !== 'estudiante' ? `<small>(${ui.escapar(ROL[c.otro.rol] || c.otro.rol)})</small>` : ''}</span>
            <span class="mensajes-conv__hora">${ui.escapar(marcaDeTiempo(c.ultimo?.fecha || c.fecha))}</span>
          </span>
          <span class="mensajes-conv__fila">
            <span class="mensajes-conv__ultimo">${ui.escapar(ultimo)}</span>
            ${c.noLeidos ? `<span class="mensajes-conv__contador" aria-label="${c.noLeidos} sin leer">${c.noLeidos > 99 ? '99+' : c.noLeidos}</span>` : ''}
          </span>
        </button>
      </li>`;
  }).join('');
}

async function cargarLista({ silencioso = true } = {}) {
  if (consultandoLista) return;
  consultandoLista = true;
  try {
    conversaciones = await api.llamar('GET', '/api/mensajes/conversaciones');
    if (abierta) {
      const actual = conversaciones.find((c) => c.id === abierta.id);
      if (actual) {
        abierta = { ...actual, noLeidos: 0 }; // la abierta siempre se considera leída
        actual.noLeidos = 0;
        pintarCabeceraChat();
      }
    }
    pintarLista();
  } catch (error) {
    if (!silencioso) ui.aviso(error.message || 'No se pudieron cargar las conversaciones.', 'error');
  } finally {
    consultandoLista = false;
  }
}

// ----------------------------------------------------
// CHAT
// ----------------------------------------------------

function pintarCabeceraChat() {
  if (!abierta) return;
  por('chatTitulo').innerHTML = `${ui.escapar(nombreDe(abierta.otro))} ${abierta.otro.rol ? `<span class="insignia insignia--info">${ui.escapar(ROL[abierta.otro.rol] || abierta.otro.rol)}</span>` : ''}`;
  const form = por('formMensaje');
  const texto = por('textoMensaje');
  const bloqueado = abierta.sinEnvio;
  texto.disabled = bloqueado;
  form.querySelector('button[type="submit"]').disabled = bloqueado;
  por('avisoSinEnvio').hidden = !bloqueado;
}

function pintarMensajes({ conservarPosicion = false, alFinal = true } = {}) {
  const zona = por('chatMensajes');
  const alturaAntes = zona.scrollHeight;
  const arribaAntes = zona.scrollTop;

  let html = hayAnteriores ? '<button type="button" id="btnAnteriores" class="btn btn--secundario btn--pequeno mensajes-anteriores">Ver anteriores</button>' : '';
  let diaPrevio = null;
  for (const m of mensajes) {
    if (!diaPrevio || !mismoDia(diaPrevio, m.fecha)) {
      html += `<div class="mensajes-dia">${ui.escapar(etiquetaDia(m.fecha))}</div>`;
      diaPrevio = m.fecha;
    }
    html += `
      <div class="burbuja ${m.autorId === yo.id ? 'burbuja--mia' : ''}" data-id="${ui.escapar(m.id)}">
        <div class="burbuja__texto">${textoConEnlaces(m.texto)}</div>
        <time class="burbuja__hora" datetime="${ui.escapar(m.fecha)}">${ui.escapar(hora(m.fecha))}</time>
      </div>`;
  }
  if (!mensajes.length) html += '<p class="mensajes-sin-chat">Aún no hay mensajes. ¡Escribe el primero!</p>';
  zona.innerHTML = html;

  if (conservarPosicion) zona.scrollTop = arribaAntes + (zona.scrollHeight - alturaAntes);
  else if (alFinal) zona.scrollTop = zona.scrollHeight;
  por('btnAnteriores')?.addEventListener('click', verAnteriores);
}

function cercaDelFinal() {
  const zona = por('chatMensajes');
  return zona.scrollHeight - zona.scrollTop - zona.clientHeight < 80;
}

async function marcarLeida() {
  if (!abierta) return;
  try {
    await api.llamar('POST', `/api/mensajes/${abierta.id}/leido`);
    const enLista = conversaciones.find((c) => c.id === abierta.id);
    if (enLista) enLista.noLeidos = 0;
    pintarLista();
    actualizarMensajesNoLeidos();
  } catch {
    // Si falla, el siguiente sondeo lo reintenta.
  }
}

async function abrirConversacion(id) {
  let datos;
  ui.cargando(true);
  try {
    datos = await api.llamar('GET', `/api/mensajes/${encodeURIComponent(id)}`);
  } catch (error) {
    ui.aviso(error.message || 'No se pudo abrir la conversación.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }
  abierta = { ...datos.conversacion };
  mensajes = datos.mensajes;
  hayAnteriores = datos.hayMas;
  por('mensajesVista').dataset.panel = 'chat';
  por('chatVacio').hidden = true;
  por('chatContenedor').hidden = false;
  pintarCabeceraChat();
  pintarMensajes();
  history.replaceState(null, '', `?conv=${encodeURIComponent(id)}`);
  await marcarLeida();
  if (!por('textoMensaje').disabled) por('textoMensaje').focus();
}

async function verAnteriores() {
  if (!abierta || !mensajes.length) return;
  try {
    const datos = await api.llamar('GET', `/api/mensajes/${abierta.id}?antes=${encodeURIComponent(mensajes[0].id)}`);
    mensajes = [...datos.mensajes, ...mensajes];
    hayAnteriores = datos.hayMas;
    pintarMensajes({ conservarPosicion: true });
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar los mensajes anteriores.', 'error');
  }
}

const numero = (id) => parseInt(String(id).split('_')[1], 10);
let ciclos = 0;

// Cada ~16 s se vuelve a pedir la última página para quitar los mensajes que el admin haya ocultado.
async function reconciliar(id) {
  const datos = await api.llamar('GET', `/api/mensajes/${id}`);
  if (!abierta || abierta.id !== id || !datos.mensajes.length) return false;
  const primero = numero(datos.mensajes[0].id);
  const vigentes = new Set(datos.mensajes.map((m) => m.id));
  const quedan = mensajes.filter((m) => numero(m.id) < primero || vigentes.has(m.id));
  if (quedan.length === mensajes.length) return false;
  mensajes = quedan;
  pintarMensajes({ conservarPosicion: !cercaDelFinal() });
  return true;
}

// Solo los mensajes nuevos de la conversación abierta (desde = el último que ya tengo).
async function sondearChat() {
  if (!abierta || consultandoChat || !visible()) return;
  consultandoChat = true;
  const id = abierta.id;
  try {
    if (++ciclos % 4 === 0) await reconciliar(id);
    const ultimoId = mensajes.length ? mensajes[mensajes.length - 1].id : null;
    const ruta = ultimoId ? `/api/mensajes/${id}?desde=${encodeURIComponent(ultimoId)}` : `/api/mensajes/${id}`;
    const datos = await api.llamar('GET', ruta);
    if (!abierta || abierta.id !== id) return; // cambió de conversación mientras esperaba
    abierta = { ...abierta, sinEnvio: datos.conversacion.sinEnvio, bloqueadoPorMi: datos.conversacion.bloqueadoPorMi };
    pintarCabeceraChat();
    const nuevos = datos.mensajes.filter((m) => !mensajes.some((x) => x.id === m.id));
    if (nuevos.length) {
      const estabaAbajo = cercaDelFinal();
      mensajes = [...mensajes, ...nuevos];
      pintarMensajes({ alFinal: estabaAbajo });
      if (!estabaAbajo) por('btnNuevos').hidden = false;
      if (nuevos.some((m) => m.autorId !== yo.id)) marcarLeida();
    }
  } catch {
    // Silencioso: se reintenta en el siguiente ciclo.
  } finally {
    consultandoChat = false;
  }
}

async function enviar(e) {
  e.preventDefault();
  if (!abierta) return;
  const campo = por('textoMensaje');
  const texto = campo.value.trim();
  if (!texto) return;
  const boton = por('formMensaje').querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const nuevo = await api.llamar('POST', `/api/mensajes/${abierta.id}`, { texto });
    if (!mensajes.some((m) => m.id === nuevo.id)) mensajes.push(nuevo);
    campo.value = '';
    por('contadorMensaje').textContent = '0';
    pintarMensajes();
    cargarLista();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo enviar el mensaje.', 'error');
    if (error.message && /No puedes enviar/.test(error.message)) {
      abierta = { ...abierta, sinEnvio: true };
      pintarCabeceraChat();
    }
  } finally {
    boton.disabled = Boolean(abierta?.sinEnvio);
    campo.focus();
  }
}

// ----------------------------------------------------
// NUEVA CONVERSACIÓN
// ----------------------------------------------------

async function nuevaConversacion() {
  let contactos;
  ui.cargando(true);
  try {
    contactos = await api.llamar('GET', '/api/mensajes/contactos');
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar tus contactos.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }

  const cuerpo = document.createElement('div');
  cuerpo.innerHTML = `
    <label for="buscarContacto" class="sr-only">Buscar contacto</label>
    <input type="search" id="buscarContacto" placeholder="Buscar por nombre" style="width: 100%; font: inherit;">
    <ul class="mensajes-contactos" id="listaContactos"></ul>`;
  const lista = cuerpo.querySelector('#listaContactos');
  const pintar = () => {
    const q = util.normalizar(cuerpo.querySelector('#buscarContacto').value);
    const filtrados = contactos.filter((c) => !q || util.normalizar(nombreDe(c)).includes(q));
    lista.innerHTML = filtrados.length
      ? filtrados.map((c) => `<li><button type="button" data-id="${ui.escapar(c.id)}"><span>${ui.escapar(nombreDe(c))}</span><small>${ui.escapar(ROL[c.rol] || c.rol)}</small></button></li>`).join('')
      : `<li><p class="mensajes-vacio">${contactos.length ? 'Nadie coincide con tu búsqueda.' : 'No tienes contactos disponibles por ahora.'}</p></li>`;
  };
  cuerpo.querySelector('#buscarContacto').addEventListener('input', pintar);
  pintar();

  // El modal se cierra con la acción; elegir un contacto cierra con "Cancelar" tras guardar la elección.
  let elegido = null;
  lista.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-id]');
    if (!boton) return;
    elegido = boton.dataset.id;
    document.querySelector('dialog.modal .modal-cerrar')?.click();
  });
  await ui.modal({ titulo: 'Nueva conversación', contenido: cuerpo, acciones: [{ texto: 'Cancelar', valor: null, clase: 'btn--secundario' }] });
  if (!elegido) return;

  ui.cargando(true);
  try {
    const conv = await api.llamar('POST', '/api/mensajes/conversaciones', { con: elegido });
    await cargarLista();
    await abrirConversacion(conv.id);
  } catch (error) {
    ui.aviso(error.message || 'No se pudo abrir la conversación.', 'error');
  } finally {
    ui.cargando(false);
  }
}

// ----------------------------------------------------
// PÁGINA
// ----------------------------------------------------

function pintarPagina() {
  contenido.innerHTML = `
    <div class="mensajes-vista" id="mensajesVista" data-panel="lista">
      <aside class="mensajes-lista" aria-label="Conversaciones">
        <div class="mensajes-lista__cabecera">
          <div class="fila" style="gap: var(--espacio-s); justify-content: space-between; align-items: center;">
            <h1 style="margin: 0; font-size: var(--texto-l); color: var(--color-primario);">Mensajes</h1>
            <button type="button" id="btnNueva" class="btn btn--primario btn--pequeno">+ Nueva</button>
          </div>
          <label for="buscarConversacion" class="sr-only">Buscar conversación</label>
          <input type="search" id="buscarConversacion" placeholder="Buscar conversación" autocomplete="off">
        </div>
        <ul class="mensajes-conversaciones" id="conversaciones"></ul>
      </aside>

      <section class="mensajes-chat" aria-label="Chat">
        <p class="mensajes-sin-chat" id="chatVacio">Elige una conversación o inicia una nueva.</p>
        <div id="chatContenedor" class="mensajes-chat__contenedor" hidden>
          <header class="mensajes-chat__cabecera">
            <button type="button" id="btnVolver" class="btn btn--texto btn--pequeno mensajes-volver" aria-label="Volver a la lista de conversaciones">← Volver</button>
            <div class="mensajes-chat__titulo" id="chatTitulo"></div>
          </header>
          <div class="mensajes-hilo" id="chatMensajes" role="log" aria-live="polite" aria-label="Mensajes de la conversación" tabindex="0"></div>
          <button type="button" id="btnNuevos" class="btn btn--primario btn--pequeno mensajes-nuevos" hidden>↓ Mensajes nuevos</button>
          <p class="alerta alerta--advertencia" id="avisoSinEnvio" role="status" hidden style="margin: var(--espacio-s) var(--espacio-m);">No puedes enviar mensajes a esta persona.</p>
          <form class="mensajes-form" id="formMensaje">
            <div class="mensajes-form__fila">
              <label for="textoMensaje" class="sr-only">Escribe un mensaje</label>
              <textarea id="textoMensaje" rows="2" maxlength="${MAX_TEXTO}" placeholder="Escribe un mensaje…"></textarea>
              <button type="submit" class="btn btn--primario">Enviar</button>
            </div>
            <div class="mensajes-form__pie">
              <span>Enter envía · Mayús + Enter nueva línea</span>
              <span><span id="contadorMensaje">0</span> / ${MAX_TEXTO}</span>
            </div>
          </form>
        </div>
      </section>
    </div>`;

  por('btnNueva').addEventListener('click', nuevaConversacion);
  por('buscarConversacion').addEventListener('input', (e) => { filtro = e.target.value; pintarLista(); });
  por('conversaciones').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-conv]');
    if (boton) abrirConversacion(boton.dataset.conv);
  });
  por('btnVolver').addEventListener('click', () => {
    por('mensajesVista').dataset.panel = 'lista';
    abierta = null;
    history.replaceState(null, '', location.pathname);
    pintarLista();
  });
  por('formMensaje').addEventListener('submit', enviar);
  por('btnNuevos').addEventListener('click', () => {
    por('chatMensajes').scrollTop = por('chatMensajes').scrollHeight;
    por('btnNuevos').hidden = true;
  });
  por('chatMensajes').addEventListener('scroll', () => { if (cercaDelFinal()) por('btnNuevos').hidden = true; });
  const campo = por('textoMensaje');
  campo.addEventListener('input', () => { por('contadorMensaje').textContent = campo.value.length; });
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      por('formMensaje').requestSubmit();
    }
  });

  // Solo con la pestaña visible; al volver a verla se actualiza enseguida.
  setInterval(sondearChat, SONDEO_CHAT_MS);
  setInterval(() => { if (visible()) cargarLista(); }, SONDEO_LISTA_MS);
  document.addEventListener('visibilitychange', () => {
    if (visible()) { sondearChat(); cargarLista(); }
  });
}

pintarPagina();
await cargarLista({ silencioso: false });
const pedida = util.parametro('conv');
if (pedida && conversaciones.some((c) => c.id === pedida)) await abrirConversacion(pedida);
