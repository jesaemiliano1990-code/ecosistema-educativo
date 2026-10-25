// publico/js/modulos/foros.js
// Lista de hilos del foro por asignatura (y tema opcional) y creación de hilos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Foros', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const MAX_TEXTO = 5000;

let asignaturas = [];
let temasPorAsignatura = new Map(); // asignaturaId → [{ id, titulo, unidad }]
let asignaturaId = null;
let temaFiltro = '';

const enlaceHilo = (id) => `/paginas/hilo.html?id=${encodeURIComponent(id)}`;

// ----------------------------------------------------
// LISTA
// ----------------------------------------------------

function ordenar(hilos) {
  return [...hilos].sort((a, b) => {
    if (Boolean(a.fijado) !== Boolean(b.fijado)) return a.fijado ? -1 : 1;
    return String(b.ultimoMovimiento || b.fecha).localeCompare(String(a.ultimoMovimiento || a.fecha));
  });
}

function tarjeta(h, titulosTema) {
  const clases = ['foro-hilo', h.fijado ? 'foro-hilo--fijado' : '', h.oculto ? 'foro-hilo--oculto' : ''].filter(Boolean).join(' ');
  const total = Number(h.totalRespuestas) || 0;
  return `
    <li class="${clases}">
      <div>
        <h3 class="foro-hilo__titulo"><a href="${enlaceHilo(h.id)}">${ui.escapar(h.titulo)}</a></h3>
        <p class="foro-meta">
          ${h.fijado ? '<span class="insignia insignia--acento">📌 Fijado</span>' : ''}
          ${h.cerrado ? '<span class="insignia">🔒 Cerrado</span>' : ''}
          ${h.oculto ? '<span class="insignia insignia--advertencia">Oculto</span>' : ''}
          <span>${ui.escapar(h.autorNombre || 'Usuario')}${h.autorRol === 'docente' ? ' (docente)' : ''}</span>
          <span title="${ui.escapar(util.fechaLarga(h.fecha))}">${ui.escapar(util.fechaRelativa(h.fecha))}</span>
          ${h.temaId && titulosTema.get(h.temaId) ? `<span>Tema: ${ui.escapar(titulosTema.get(h.temaId))}</span>` : ''}
          <span>Último movimiento: ${ui.escapar(util.fechaRelativa(h.ultimoMovimiento || h.fecha))}</span>
        </p>
      </div>
      <div class="foro-hilo__respuestas" aria-label="${total} respuesta${total === 1 ? '' : 's'}">
        <strong>${total}</strong>
        respuesta${total === 1 ? '' : 's'}
      </div>
    </li>`;
}

async function cargarHilos() {
  const zona = document.getElementById('listaHilos');
  ui.cargando(true);
  try {
    let hilos = await api.listar('foros-hilos', { asignaturaId });
    if (temaFiltro) hilos = hilos.filter((h) => h.temaId === temaFiltro);
    const titulosTema = new Map((temasPorAsignatura.get(asignaturaId) || []).map((t) => [t.id, t.titulo]));
    zona.innerHTML = hilos.length
      ? `<ul class="foro-lista">${ordenar(hilos).map((h) => tarjeta(h, titulosTema)).join('')}</ul>`
      : `<div class="vacio">
           <div class="vacio__icono" aria-hidden="true">💬</div>
           <h3 class="vacio__titulo">Aún no hay hilos</h3>
           <p class="vacio__texto">Sé la primera persona en abrir una conversación.</p>
         </div>`;
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar los hilos.', 'error');
  } finally {
    ui.cargando(false);
  }
}

function opcionesTema(seleccionado = '') {
  const temas = temasPorAsignatura.get(asignaturaId) || [];
  return temas
    .map((t) => `<option value="${ui.escapar(t.id)}" ${t.id === seleccionado ? 'selected' : ''}>${ui.escapar(t.unidad)} · ${ui.escapar(t.titulo)}</option>`)
    .join('');
}

// ----------------------------------------------------
// NUEVO HILO
// ----------------------------------------------------

async function nuevoHilo() {
  const form = document.createElement('form');
  form.className = 'pila foro-form';
  form.innerHTML = `
    <div class="campo">
      <label for="hiloTitulo">Título</label>
      <input type="text" id="hiloTitulo" maxlength="150" required>
    </div>
    <div class="campo">
      <label for="hiloTema">Tema (opcional)</label>
      <select id="hiloTema"><option value="">Sin tema específico</option>${opcionesTema(temaFiltro)}</select>
    </div>
    <div class="campo">
      <label for="hiloTexto">Mensaje</label>
      <textarea id="hiloTexto" rows="6" maxlength="${MAX_TEXTO}" required></textarea>
      <div class="foro-contador"><span id="hiloContador">0</span> / ${MAX_TEXTO}</div>
    </div>`;
  form.addEventListener('submit', (e) => e.preventDefault());
  const texto = form.querySelector('#hiloTexto');
  texto.addEventListener('input', () => { form.querySelector('#hiloContador').textContent = texto.value.length; });

  while (true) {
    const accion = await ui.modal({
      titulo: 'Nuevo hilo',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Publicar', valor: 'publicar', clase: 'btn--primario' }
      ]
    });
    if (accion !== 'publicar') return;

    const titulo = form.querySelector('#hiloTitulo').value.trim();
    const mensaje = texto.value.trim();
    if (titulo.length < 3) { ui.aviso('Escribe un título de al menos 3 caracteres.', 'error'); continue; }
    if (!mensaje) { ui.aviso('Escribe el mensaje del hilo.', 'error'); continue; }

    ui.cargando(true);
    try {
      const hilo = await api.crear('foros-hilos', {
        asignaturaId,
        temaId: form.querySelector('#hiloTema').value || null,
        titulo,
        texto: mensaje
      });
      location.href = enlaceHilo(hilo.id);
      return;
    } catch (error) {
      ui.aviso(error.message || 'No se pudo publicar el hilo.', 'error');
    } finally {
      ui.cargando(false);
    }
  }
}

// ----------------------------------------------------
// ARRANQUE
// ----------------------------------------------------

function pintarPagina() {
  contenido.innerHTML = `
    <div class="foro-vista">
      <div class="foro-cabecera">
        <h1 class="foro-cabecera__titulo">Foros</h1>
        <button type="button" id="btnNuevoHilo" class="btn btn--primario">+ Nuevo hilo</button>
      </div>
      <div class="foro-filtros">
        <div class="campo">
          <label for="selAsignatura">Asignatura</label>
          <select id="selAsignatura">
            ${asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="selTema">Tema</label>
          <select id="selTema"></select>
        </div>
      </div>
      <div id="listaHilos" aria-live="polite"></div>
    </div>`;

  const selAsig = document.getElementById('selAsignatura');
  const selTema = document.getElementById('selTema');
  const pintarTemas = () => {
    selTema.innerHTML = `<option value="">Todos los temas</option>${opcionesTema(temaFiltro)}`;
  };
  selAsig.value = asignaturaId;
  pintarTemas();

  selAsig.addEventListener('change', () => {
    asignaturaId = selAsig.value;
    temaFiltro = '';
    history.replaceState(null, '', `?asignaturaId=${encodeURIComponent(asignaturaId)}`);
    pintarTemas();
    cargarHilos();
  });
  selTema.addEventListener('change', () => {
    temaFiltro = selTema.value;
    cargarHilos();
  });
  document.getElementById('btnNuevoHilo').addEventListener('click', nuevoHilo);
}

ui.cargando(true);
try {
  const [listaAsignaturas, unidades, temas] = await Promise.all([
    api.listar('asignaturas'),
    api.listar('unidades'),
    api.listar('temas')
  ]);
  asignaturas = listaAsignaturas;
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
  for (const t of temas) {
    const u = unidadPorId.get(t.unidadId);
    if (!u) continue;
    if (!temasPorAsignatura.has(u.asignaturaId)) temasPorAsignatura.set(u.asignaturaId, []);
    temasPorAsignatura.get(u.asignaturaId).push({ id: t.id, titulo: t.titulo, unidad: u.titulo });
  }
} catch (error) {
  ui.aviso(error.message || 'No se pudieron cargar tus asignaturas.', 'error');
} finally {
  ui.cargando(false);
}

if (!asignaturas.length) {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">💬</div>
      <h2 class="vacio__titulo">Aún no tienes asignaturas</h2>
      <p class="vacio__texto">Los foros se abren por asignatura. Cuando tengas una asignada, aparecerá aquí.</p>
    </div>`;
} else {
  const pedida = util.parametro('asignaturaId');
  asignaturaId = asignaturas.some((a) => a.id === pedida) ? pedida : asignaturas[0].id;
  pintarPagina();
  await cargarHilos();
}
