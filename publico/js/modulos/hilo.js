// publico/js/modulos/hilo.js
// Un hilo del foro: publicación, respuestas paginadas, moderación y reportes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Hilo del foro', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const POR_PAGINA = 20;
const MAX_TEXTO = 5000;
const VENTANA_EDICION_MS = 15 * 60 * 1000;

const yo = sesion.usuarioActual();
const moderador = yo && (yo.rol === 'docente' || yo.rol === 'admin'); // el servidor valida de verdad
const hiloId = util.parametro('id');

let hilo = null;
let respuestas = [];
let pagina = 1;

const esMia = (p) => yo && p.autorId === yo.id;
const puedeEditar = (p) => esMia(p) && Date.now() - new Date(p.fecha).getTime() <= VENTANA_EDICION_MS;

// ----------------------------------------------------
// PINTAR
// ----------------------------------------------------

function menu(p, coleccion) {
  const esHilo = coleccion === 'foros-hilos';
  const acciones = [`<button type="button" role="menuitem" data-accion="reportar">🚩 Reportar</button>`];
  if (puedeEditar(p)) acciones.push(`<button type="button" role="menuitem" data-accion="editar">✏️ Editar</button>`);
  if (moderador) {
    if (esHilo) {
      acciones.push(`<button type="button" role="menuitem" data-accion="fijar">${p.fijado ? '📌 Quitar fijado' : '📌 Fijar'}</button>`);
      acciones.push(`<button type="button" role="menuitem" data-accion="cerrar">${p.cerrado ? '🔓 Abrir' : '🔒 Cerrar'}</button>`);
      acciones.push(`<button type="button" role="menuitem" data-accion="ocultar">${p.oculto ? '👁️ Mostrar' : '🙈 Ocultar'}</button>`);
    } else {
      acciones.push(`<button type="button" role="menuitem" data-accion="destacar">${p.destacada ? '⭐ Quitar destacado' : '⭐ Destacar'}</button>`);
      acciones.push(`<button type="button" role="menuitem" data-accion="ocultar">${p.oculta ? '👁️ Mostrar' : '🙈 Ocultar'}</button>`);
    }
    acciones.push(`<button type="button" role="menuitem" class="foro-menu__peligro" data-accion="eliminar">🗑️ Eliminar</button>`);
  }
  return `
    <details class="foro-menu">
      <summary aria-label="Opciones de la publicación">⋯</summary>
      <div class="foro-menu__lista" role="menu">${acciones.join('')}</div>
    </details>`;
}

function publicacion(p, coleccion) {
  const esHilo = coleccion === 'foros-hilos';
  const oculta = esHilo ? p.oculto : p.oculta;
  const clases = ['foro-post', !esHilo && p.destacada ? 'foro-post--destacada' : '', oculta ? 'foro-post--oculta' : ''].filter(Boolean).join(' ');
  return `
    <article class="${clases}" data-coleccion="${coleccion}" data-id="${ui.escapar(p.id)}">
      <div class="foro-post__cabecera">
        <p class="foro-meta">
          <strong>${ui.escapar(p.autorNombre || 'Usuario')}</strong>
          ${p.autorRol === 'docente' ? '<span class="insignia insignia--acento">Docente</span>' : ''}
          <span title="${ui.escapar(util.fechaLarga(p.fecha))}">${ui.escapar(util.fechaRelativa(p.fecha))}</span>
          ${!esHilo && p.destacada ? '<span class="insignia insignia--exito">⭐ Destacada</span>' : ''}
          ${oculta ? '<span class="insignia insignia--advertencia">Oculta para los estudiantes</span>' : ''}
        </p>
        ${menu(p, coleccion)}
      </div>
      <div class="foro-post__texto">${util.formatoBasico(p.texto)}</div>
    </article>`;
}

function pintar() {
  const totalPaginas = Math.max(1, Math.ceil(respuestas.length / POR_PAGINA));
  pagina = Math.min(Math.max(1, pagina), totalPaginas);
  const visibles = respuestas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const bloqueado = hilo.cerrado || hilo.oculto;

  contenido.innerHTML = `
    <div class="foro-vista">
      <p><a href="/paginas/foros.html?asignaturaId=${encodeURIComponent(hilo.asignaturaId)}">← Volver a los foros</a></p>
      <h1 class="hilo-titulo">${ui.escapar(hilo.titulo)}</h1>
      <p class="foro-meta">
        ${hilo.fijado ? '<span class="insignia insignia--acento">📌 Fijado</span>' : ''}
        ${hilo.cerrado ? '<span class="insignia">🔒 Cerrado</span>' : ''}
        ${hilo.oculto ? '<span class="insignia insignia--advertencia">Oculto</span>' : ''}
      </p>
      ${publicacion(hilo, 'foros-hilos')}

      <h2 style="margin: 0;">Respuestas (${respuestas.filter((r) => !r.oculta).length})</h2>
      ${visibles.length
        ? `<ul class="hilo-respuestas">${visibles.map((r) => `<li>${publicacion(r, 'foros-respuestas')}</li>`).join('')}</ul>`
        : '<p>Aún no hay respuestas.</p>'}
      ${totalPaginas > 1 ? `
        <nav class="hilo-paginas" aria-label="Páginas de respuestas">
          <button type="button" class="btn btn--secundario btn--pequeno" data-pagina="${pagina - 1}" ${pagina === 1 ? 'disabled' : ''}>← Anterior</button>
          <span>Página ${pagina} de ${totalPaginas}</span>
          <button type="button" class="btn btn--secundario btn--pequeno" data-pagina="${pagina + 1}" ${pagina === totalPaginas ? 'disabled' : ''}>Siguiente →</button>
        </nav>` : ''}

      ${bloqueado
        ? `<div class="alerta alerta--advertencia" role="status">${hilo.cerrado ? 'Este hilo está cerrado: ya no admite respuestas.' : 'Este hilo está oculto: no admite respuestas.'}</div>`
        : `<form class="hilo-responder" id="formRespuesta">
             <label for="textoRespuesta"><strong>Tu respuesta</strong></label>
             <textarea id="textoRespuesta" rows="5" maxlength="${MAX_TEXTO}" required></textarea>
             <div class="foro-contador"><span id="contadorRespuesta">0</span> / ${MAX_TEXTO}</div>
             <div><button type="submit" class="btn btn--primario">Responder</button></div>
           </form>`}
    </div>`;

  const texto = document.getElementById('textoRespuesta');
  if (texto) texto.addEventListener('input', () => { document.getElementById('contadorRespuesta').textContent = texto.value.length; });
  document.getElementById('formRespuesta')?.addEventListener('submit', responder);
  contenido.querySelectorAll('[data-pagina]').forEach((b) => b.addEventListener('click', () => { pagina = Number(b.dataset.pagina); pintar(); }));
  contenido.querySelectorAll('.foro-menu__lista button').forEach((b) => b.addEventListener('click', (e) => {
    const articulo = e.target.closest('article');
    e.target.closest('details').removeAttribute('open');
    accion(b.dataset.accion, articulo.dataset.coleccion, articulo.dataset.id);
  }));
}

// ----------------------------------------------------
// DATOS
// ----------------------------------------------------

async function cargar({ ultimaPagina = false } = {}) {
  ui.cargando(true);
  try {
    hilo = await api.obtener('foros-hilos', hiloId);
    const lista = await api.listar('foros-respuestas', { hiloId });
    respuestas = lista.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (ultimaPagina) pagina = Math.ceil(respuestas.length / POR_PAGINA) || 1;
    pintar();
  } catch (error) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">💬</div>
        <h2 class="vacio__titulo">No se encontró el hilo</h2>
        <p class="vacio__texto">${ui.escapar(error.message || 'Puede haber sido eliminado o no tienes acceso.')}</p>
        <a href="/paginas/foros.html" class="btn btn--primario">Volver a los foros</a>
      </div>`;
  } finally {
    ui.cargando(false);
  }
}

async function responder(e) {
  e.preventDefault();
  const texto = document.getElementById('textoRespuesta').value.trim();
  if (!texto) return ui.aviso('Escribe tu respuesta.', 'error');
  const boton = e.target.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await api.crear('foros-respuestas', { hiloId, texto });
    ui.aviso('Respuesta publicada.', 'exito');
    await cargar({ ultimaPagina: true });
  } catch (error) {
    ui.aviso(error.message || 'No se pudo publicar la respuesta.', 'error');
    boton.disabled = false;
  }
}

async function guardarCambio(coleccion, id, cambios, mensaje) {
  ui.cargando(true);
  try {
    await api.actualizar(coleccion, id, cambios);
    if (mensaje) ui.aviso(mensaje, 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo guardar el cambio.', 'error');
  } finally {
    ui.cargando(false);
  }
  await cargar();
}

// ----------------------------------------------------
// ACCIONES
// ----------------------------------------------------

async function pedirTexto({ titulo, etiqueta, valor = '', min = 1, max = MAX_TEXTO, boton }) {
  const form = document.createElement('form');
  form.className = 'pila foro-form';
  form.innerHTML = `
    <div class="campo">
      <label for="campoTexto">${ui.escapar(etiqueta)}</label>
      <textarea id="campoTexto" rows="5" maxlength="${max}"></textarea>
      <div class="foro-contador"><span id="campoContador">0</span> / ${max}</div>
    </div>`;
  form.addEventListener('submit', (ev) => ev.preventDefault());
  const area = form.querySelector('#campoTexto');
  area.value = valor;
  const contar = () => { form.querySelector('#campoContador').textContent = area.value.length; };
  area.addEventListener('input', contar);
  contar();
  while (true) {
    const resultado = await ui.modal({
      titulo,
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: boton, valor: 'ok', clase: 'btn--primario' }
      ]
    });
    if (resultado !== 'ok') return null;
    const texto = area.value.trim();
    if (texto.length < min) { ui.aviso(min > 1 ? `Escribe al menos ${min} caracteres.` : 'El texto no puede estar vacío.', 'error'); continue; }
    return texto;
  }
}

async function accion(nombre, coleccion, id) {
  const esHilo = coleccion === 'foros-hilos';
  const item = esHilo ? hilo : respuestas.find((r) => r.id === id);
  if (!item) return;

  if (nombre === 'reportar') {
    const motivo = await pedirTexto({ titulo: 'Reportar publicación', etiqueta: '¿Por qué la reportas?', min: 3, max: 500, boton: 'Enviar reporte' });
    if (!motivo) return;
    try {
      await api.crear('reportes', { tipo: 'foro', coleccion, referenciaId: id, motivo });
      ui.aviso('Gracias: el administrador revisará tu reporte.', 'exito');
    } catch (error) {
      ui.aviso(error.message || 'No se pudo enviar el reporte.', 'error');
    }
    return;
  }

  if (nombre === 'editar') {
    const texto = await pedirTexto({ titulo: 'Editar publicación', etiqueta: 'Texto', valor: item.texto, boton: 'Guardar' });
    if (texto && texto !== item.texto) await guardarCambio(coleccion, id, { texto }, 'Publicación actualizada.');
    return;
  }

  if (nombre === 'eliminar') {
    if (!(await ui.confirmar(esHilo ? '¿Eliminar el hilo y todas sus respuestas? No se puede deshacer.' : '¿Eliminar esta respuesta? No se puede deshacer.'))) return;
    ui.cargando(true);
    try {
      await api.eliminar(coleccion, id);
      ui.aviso('Publicación eliminada.', 'exito');
      if (esHilo) {
        location.href = `/paginas/foros.html?asignaturaId=${encodeURIComponent(hilo.asignaturaId)}`;
        return;
      }
    } catch (error) {
      ui.aviso(error.message || 'No se pudo eliminar.', 'error');
    } finally {
      ui.cargando(false);
    }
    return cargar();
  }

  const cambios = {
    fijar: { fijado: !item.fijado },
    cerrar: { cerrado: !item.cerrado },
    destacar: { destacada: !item.destacada },
    ocultar: esHilo ? { oculto: !item.oculto } : { oculta: !item.oculta }
  }[nombre];
  if (cambios) await guardarCambio(coleccion, id, cambios, 'Cambio aplicado.');
}

if (!hiloId) {
  location.href = '/paginas/foros.html';
} else {
  await cargar();
}
