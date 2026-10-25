// publico/js/modulos/editor-simulacion.js
// Editor de simulaciones en modo escenarios: datos generales, escenas con opciones, validación y mapa

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de simulación', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const MIN_OPCIONES = 2;
const MAX_OPCIONES = 4;
const MAX_ESCENAS = 40;

let id = util.parametro('id') || '';
let temas = [];
let sim = null;
let sucio = false;

const por = (i) => document.getElementById(i);
const etiqueta = (idEscena) => `E${sim.escenas.findIndex((e) => e.id === idEscena) + 1}`;
const esFinal = (e) => !e.opciones.length;

function nuevaEscena() {
  let n = sim.escenas.length + 1;
  while (sim.escenas.some((e) => e.id === `e${n}`)) n++;
  return { id: `e${n}`, texto: '', imagen: '', opciones: [] };
}

function nuevaOpcion() {
  return { texto: '', destino: '', puntos: 0, consecuencia: '' };
}

// ----------------------------------------------------
// VALIDACIÓN (al publicar; el servidor repite las mismas reglas)
// ----------------------------------------------------

function validar() {
  const errores = [];
  const falla = (escenaId, texto) => errores.push({ escenaId, texto });

  if (!sim.titulo.trim()) falla(null, 'El título es obligatorio.');
  if (!sim.temaId) falla(null, 'Elige el tema de la simulación.');
  if (sim.modo !== 'escenarios') return errores;

  const ids = new Set(sim.escenas.map((e) => e.id));
  if (!sim.escenas.length) { falla(null, 'Agrega al menos una escena.'); return errores; }
  if (!ids.has(sim.escenaInicial)) falla(null, 'Elige la escena inicial.');
  if (!sim.escenas.some(esFinal)) falla(null, 'Debe haber al menos un final: una escena sin opciones.');

  for (const e of sim.escenas) {
    const nombre = etiqueta(e.id);
    if (!e.texto.trim()) falla(e.id, `${nombre}: escribe el texto de la escena.`);
    if (e.opciones.length && (e.opciones.length < MIN_OPCIONES || e.opciones.length > MAX_OPCIONES)) {
      falla(e.id, `${nombre}: debe tener de ${MIN_OPCIONES} a ${MAX_OPCIONES} opciones, o ninguna si es un final.`);
    }
    e.opciones.forEach((o, i) => {
      const donde = `${nombre}, opción ${i + 1}`;
      if (!o.texto.trim()) falla(e.id, `${donde}: escribe el texto.`);
      if (!ids.has(o.destino)) falla(e.id, `${donde}: elige una escena de destino que exista.`);
      if (!o.consecuencia.trim()) falla(e.id, `${donde}: escribe la consecuencia.`);
      const p = Number(o.puntos);
      if (!Number.isInteger(p) || p < -10 || p > 10) falla(e.id, `${donde}: los puntos van de −10 a 10.`);
    });
  }

  // Alcanzables desde la inicial y sin ciclos.
  if (ids.has(sim.escenaInicial) && !errores.some((x) => /destino/.test(x.texto))) {
    const porId = new Map(sim.escenas.map((e) => [e.id, e]));
    const estado = new Map();
    const visitar = (idEscena) => {
      estado.set(idEscena, 1);
      for (const o of porId.get(idEscena).opciones) {
        if (estado.get(o.destino) === 1) {
          falla(idEscena, `${etiqueta(idEscena)}: una opción vuelve a ${etiqueta(o.destino)} y forma un ciclo.`);
        } else if (!estado.has(o.destino) && porId.has(o.destino)) {
          visitar(o.destino);
        }
      }
      estado.set(idEscena, 2);
    };
    visitar(sim.escenaInicial);
    for (const e of sim.escenas) {
      if (!estado.has(e.id)) falla(e.id, `${etiqueta(e.id)}: no se puede alcanzar desde la escena inicial.`);
    }
  }
  return errores;
}

function pintarErrores(errores) {
  const zona = por('zonaErrores');
  if (!errores.length) { zona.innerHTML = ''; return; }
  zona.innerHTML = `
    <div class="sim-errores" role="alert" tabindex="-1" id="cajaErrores">
      <strong>No se puede publicar todavía. Corrige esto:</strong>
      <ul>${errores.map((e) => `<li>${e.escenaId ? `<a href="#escena-${ui.escapar(e.escenaId)}" data-ir="${ui.escapar(e.escenaId)}">${ui.escapar(e.texto)}</a>` : ui.escapar(e.texto)}</li>`).join('')}</ul>
    </div>`;
  por('cajaErrores').focus();
}

// ----------------------------------------------------
// MAPA (lista indentada generada desde los datos)
// ----------------------------------------------------

function pintarMapa() {
  const zona = por('mapa');
  if (!zona) return;
  const porId = new Map(sim.escenas.map((e) => [e.id, e]));
  const vistas = new Set();
  const lineas = [];

  const recorrer = (idEscena, nivel) => {
    vistas.add(idEscena);
    const e = porId.get(idEscena);
    for (const o of e.opciones) {
      const destino = porId.get(o.destino);
      if (!destino) {
        lineas.push({ nivel, texto: `${etiqueta(idEscena)} → ¿? (${o.texto || 'sin texto'})`, aviso: true });
        continue;
      }
      const repetida = vistas.has(o.destino);
      lineas.push({ nivel, texto: `${etiqueta(idEscena)} → ${etiqueta(o.destino)} (${o.texto || 'sin texto'})${esFinal(destino) ? ' · final' : ''}${repetida ? ' · ya mostrada' : ''}` });
      if (!repetida) recorrer(o.destino, nivel + 1);
    }
  };
  if (porId.has(sim.escenaInicial)) recorrer(sim.escenaInicial, 0);

  const sueltas = sim.escenas.filter((e) => !vistas.has(e.id)).map((e) => etiqueta(e.id));
  zona.innerHTML = lineas.length || sueltas.length
    ? `<ul class="sim-mapa__lista">${lineas.map((l) => `<li class="sim-mapa__item${l.aviso ? ' sim-mapa__item--aviso' : ''}" style="--nivel:${l.nivel}">${ui.escapar(l.texto)}</li>`).join('')}</ul>
       ${sueltas.length ? `<p class="sim-mapa__sueltas">Sin conexión con la escena inicial: ${ui.escapar(sueltas.join(', '))}</p>` : ''}`
    : '<p class="texto-suave">El mapa aparecerá cuando la escena inicial tenga opciones.</p>';
}

// ----------------------------------------------------
// ESCENAS
// ----------------------------------------------------

function htmlOpcion(e, o, i) {
  const destinos = sim.escenas.filter((x) => x.id !== e.id);
  return `
    <fieldset class="sim-opcion-editor">
      <legend>Opción ${i + 1}</legend>
      <div class="campo">
        <label for="op-${e.id}-${i}-texto">Texto de la opción</label>
        <input type="text" id="op-${e.id}-${i}-texto" maxlength="300" value="${ui.escapar(o.texto)}" data-e="${e.id}" data-o="${i}" data-campo="texto-op">
      </div>
      <div class="sim-fila">
        <div class="campo">
          <label for="op-${e.id}-${i}-destino">Lleva a</label>
          <select id="op-${e.id}-${i}-destino" data-e="${e.id}" data-o="${i}" data-campo="destino">
            <option value="">Elige una escena…</option>
            ${destinos.map((d) => `<option value="${ui.escapar(d.id)}"${d.id === o.destino ? ' selected' : ''}>${etiqueta(d.id)}${esFinal(d) ? ' (final)' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="op-${e.id}-${i}-puntos">Puntos (−10 a 10)</label>
          <input type="number" id="op-${e.id}-${i}-puntos" min="-10" max="10" step="1" value="${Number(o.puntos) || 0}" data-e="${e.id}" data-o="${i}" data-campo="puntos">
        </div>
      </div>
      <div class="campo">
        <label for="op-${e.id}-${i}-consecuencia">Consecuencia (se muestra al elegirla)</label>
        <textarea id="op-${e.id}-${i}-consecuencia" rows="2" maxlength="600" data-e="${e.id}" data-o="${i}" data-campo="consecuencia">${ui.escapar(o.consecuencia)}</textarea>
      </div>
      <button type="button" class="btn btn--texto btn--pequeno" data-accion="quitar-opcion" data-e="${e.id}" data-o="${i}">🗑️ Quitar opción ${i + 1}</button>
    </fieldset>`;
}

function htmlEscena(e, indice) {
  const nombre = `E${indice + 1}`;
  const final = esFinal(e);
  return `
    <article class="tarjeta sim-escena-editor" id="escena-${ui.escapar(e.id)}" tabindex="-1" aria-label="Escena ${nombre}">
      <div class="sim-escena-editor__cabecera">
        <h3 class="sim-escena-editor__titulo">${nombre}
          ${final ? '<span class="insignia insignia--exito">Final</span>' : ''}
          ${sim.escenaInicial === e.id ? '<span class="insignia insignia--acento">Inicial</span>' : ''}
        </h3>
        <label class="sim-inicial"><input type="radio" name="inicial" value="${ui.escapar(e.id)}"${sim.escenaInicial === e.id ? ' checked' : ''} data-campo="inicial"> Escena inicial</label>
      </div>
      <div class="campo">
        <label for="esc-${e.id}-texto">Texto de la escena (admite **negrita**)</label>
        <textarea id="esc-${e.id}-texto" rows="4" maxlength="2000" data-e="${e.id}" data-campo="texto">${ui.escapar(e.texto)}</textarea>
      </div>
      <div class="sim-imagen">
        ${e.imagen ? `<img src="${ui.escapar(e.imagen)}" alt="Imagen de la escena ${nombre}" class="sim-imagen__vista"><button type="button" class="btn btn--texto btn--pequeno" data-accion="quitar-imagen" data-e="${e.id}">Quitar imagen</button>` : ''}
        <label class="btn btn--secundario btn--pequeno" for="esc-${e.id}-imagen">🖼️ ${e.imagen ? 'Cambiar' : 'Agregar'} imagen</label>
        <input type="file" id="esc-${e.id}-imagen" class="sr-only" accept="image/*" data-e="${e.id}" data-campo="imagen">
      </div>
      <div class="sim-opciones-editor">
        ${e.opciones.map((o, i) => htmlOpcion(e, o, i)).join('')}
      </div>
      <div class="sim-escena-editor__acciones">
        <button type="button" class="btn btn--secundario btn--pequeno" data-accion="agregar-opcion" data-e="${e.id}"${e.opciones.length >= MAX_OPCIONES ? ' disabled' : ''}>➕ Agregar opción</button>
        <button type="button" class="btn btn--texto btn--pequeno" data-accion="quitar-escena" data-e="${e.id}">🗑️ Eliminar escena ${nombre}</button>
      </div>
    </article>`;
}

function pintarEscenas(enfocar = '') {
  por('listaEscenas').innerHTML = sim.escenas.map(htmlEscena).join('')
    || '<p class="texto-suave">Aún no hay escenas. Agrega la primera.</p>';
  por('btnAgregarEscena').disabled = sim.escenas.length >= MAX_ESCENAS;
  pintarMapa();
  if (enfocar) por(enfocar)?.focus();
}

const escenaDe = (idEscena) => sim.escenas.find((e) => e.id === idEscena);

async function alCambiar(evento) {
  const el = evento.target;
  const campo = el.dataset?.campo;
  if (!campo) return;
  sucio = true;
  const e = escenaDe(el.dataset.e);
  const o = e && el.dataset.o !== undefined ? e.opciones[Number(el.dataset.o)] : null;

  if (campo === 'inicial') { sim.escenaInicial = el.value; pintarEscenas(); return; }
  if (campo === 'texto' && e) e.texto = el.value;
  else if (campo === 'texto-op' && o) o.texto = el.value;
  else if (campo === 'consecuencia' && o) o.consecuencia = el.value;
  else if (campo === 'puntos' && o) o.puntos = el.value === '' ? 0 : Number(el.value);
  else if (campo === 'destino' && o) o.destino = el.value;
  else if (campo === 'imagen' && e && el.files?.[0]) await subirImagen(e, el.files[0]);
  pintarMapa();
}

async function subirImagen(e, archivo) {
  ui.cargando(true);
  try {
    const { url } = await api.subir(archivo);
    e.imagen = url;
    pintarEscenas(`esc-${e.id}-imagen`);
  } catch (error) {
    ui.aviso(error.message || 'No se pudo subir la imagen.', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function alHacerClic(evento) {
  const enlace = evento.target.closest('[data-ir]');
  if (enlace) {
    evento.preventDefault();
    const tarjeta = por(`escena-${enlace.dataset.ir}`);
    tarjeta?.scrollIntoView({ block: 'center' });
    tarjeta?.focus();
    return;
  }
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const e = escenaDe(boton.dataset.e);
  const accion = boton.dataset.accion;
  sucio = true;

  if (accion === 'agregar-opcion' && e && e.opciones.length < MAX_OPCIONES) {
    e.opciones.push(nuevaOpcion());
    pintarEscenas(`op-${e.id}-${e.opciones.length - 1}-texto`);
  } else if (accion === 'quitar-opcion' && e) {
    e.opciones.splice(Number(boton.dataset.o), 1);
    pintarEscenas(`esc-${e.id}-texto`);
  } else if (accion === 'quitar-imagen' && e) {
    e.imagen = '';
    pintarEscenas(`esc-${e.id}-imagen`);
  } else if (accion === 'quitar-escena' && e) {
    if (!(await ui.confirmar(`¿Eliminar la escena ${etiqueta(e.id)}? Las opciones que llevaban a ella quedarán sin destino.`))) return;
    sim.escenas = sim.escenas.filter((x) => x.id !== e.id);
    for (const x of sim.escenas) for (const op of x.opciones) if (op.destino === e.id) op.destino = '';
    if (sim.escenaInicial === e.id) sim.escenaInicial = sim.escenas[0]?.id || '';
    pintarEscenas('btnAgregarEscena');
  }
}

// ----------------------------------------------------
// GUARDAR, VISTA PREVIA, ELIMINAR
// ----------------------------------------------------

function leerGenerales() {
  sim.titulo = por('simTitulo').value;
  sim.temaId = por('simTema').value;
  sim.modo = por('simModo').value;
  sim.estado = por('simEstado').value;
}

function cargarCuerpo() {
  return {
    temaId: sim.temaId,
    titulo: sim.titulo.trim(),
    modo: sim.modo,
    estado: sim.estado,
    escenaInicial: sim.escenaInicial,
    escenas: sim.escenas,
    personaje: sim.personaje,
    rubrica: sim.rubrica,
    maxTurnos: sim.maxTurnos
  };
}

// Devuelve true si se guardó.
async function guardar() {
  leerGenerales();
  const errores = sim.estado === 'publicado' ? validar() : validar().filter((x) => !x.escenaId && /título|tema/i.test(x.texto));
  pintarErrores(errores);
  if (errores.length) return false;

  ui.cargando(true);
  try {
    const guardada = id
      ? await api.actualizar('simulaciones', id, cargarCuerpo())
      : await api.crear('simulaciones', cargarCuerpo());
    id = guardada.id;
    history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
    sucio = false;
    por('btnEliminar').hidden = false;
    ui.aviso(sim.estado === 'publicado' ? 'Simulación publicada.' : 'Borrador guardado.', 'exito');
    return true;
  } catch (error) {
    pintarErrores([{ escenaId: null, texto: error.message || 'No se pudo guardar.' }]);
    return false;
  } finally {
    ui.cargando(false);
  }
}

async function vistaPrevia() {
  if (!(await guardar())) return;
  window.open(`/paginas/simulador.html?id=${encodeURIComponent(id)}&vista=previa`, '_blank', 'noopener');
}

async function eliminar() {
  if (!id || !(await ui.confirmar('¿Eliminar esta simulación? No se puede deshacer.'))) return;
  try {
    await api.eliminar('simulaciones', id);
    sucio = false;
    location.href = '/paginas/simulaciones.html';
  } catch (error) {
    ui.aviso(error.message || 'No se pudo eliminar.', 'error');
  }
}

// ----------------------------------------------------
// PÁGINA
// ----------------------------------------------------

function alCambiarModo() {
  sim.modo = por('simModo').value;
  por('zonaEscenarios').hidden = sim.modo !== 'escenarios';
  por('avisoRol').hidden = sim.modo !== 'rol';
}

function pintarPagina() {
  contenido.innerHTML = `
    <div class="sim-editor">
      <div class="sim-editor__cabecera">
        <h1 class="sim-editor__titulo">${id ? 'Editar simulación' : 'Nueva simulación'}</h1>
        <a href="/paginas/simulaciones.html" class="btn btn--texto btn--pequeno">← Volver a Simulaciones</a>
      </div>

      <div id="zonaErrores" aria-live="assertive"></div>

      <section class="tarjeta" aria-labelledby="tituloGenerales">
        <h2 id="tituloGenerales" class="sim-editor__subtitulo">Datos generales</h2>
        <div class="campo">
          <label for="simTitulo">Título</label>
          <input type="text" id="simTitulo" maxlength="150" value="${ui.escapar(sim.titulo)}">
        </div>
        <div class="sim-fila sim-fila--3">
          <div class="campo">
            <label for="simTema">Tema</label>
            <select id="simTema">
              <option value="">Elige un tema…</option>
              ${temas.map((t) => `<option value="${ui.escapar(t.id)}"${t.id === sim.temaId ? ' selected' : ''}>${ui.escapar(t.titulo)}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label for="simModo">Modo</label>
            <select id="simModo">
              <option value="escenarios"${sim.modo === 'escenarios' ? ' selected' : ''}>Escenarios</option>
              <option value="rol"${sim.modo === 'rol' ? ' selected' : ''}>Juego de rol</option>
            </select>
          </div>
          <div class="campo">
            <label for="simEstado">Estado</label>
            <select id="simEstado">
              <option value="borrador"${sim.estado === 'borrador' ? ' selected' : ''}>Borrador</option>
              <option value="publicado"${sim.estado === 'publicado' ? ' selected' : ''}>Publicado</option>
            </select>
          </div>
        </div>
      </section>

      <div id="avisoRol" class="tarjeta" role="note" ${sim.modo === 'rol' ? '' : 'hidden'}>
        <p><strong>El editor de rol se agrega en P12.4.</strong> Por ahora puedes guardar los datos generales.</p>
      </div>

      <div id="zonaEscenarios" ${sim.modo === 'escenarios' ? '' : 'hidden'}>
        <section aria-labelledby="tituloEscenas">
          <div class="sim-editor__cabecera">
            <h2 id="tituloEscenas" class="sim-editor__subtitulo">Escenas</h2>
            <button type="button" id="btnAgregarEscena" class="btn btn--secundario btn--pequeno">➕ Agregar escena</button>
          </div>
          <div id="listaEscenas" class="sim-lista-escenas"></div>
        </section>

        <section class="tarjeta" aria-labelledby="tituloMapa">
          <h2 id="tituloMapa" class="sim-editor__subtitulo">Mapa del escenario</h2>
          <div id="mapa"></div>
        </section>
      </div>

      <div class="sim-editor__acciones">
        <button type="button" id="btnGuardar" class="btn btn--primario">💾 Guardar</button>
        <button type="button" id="btnPrevia" class="btn btn--secundario">👁️ Vista previa</button>
        <button type="button" id="btnEliminar" class="btn btn--texto"${id ? '' : ' hidden'}>🗑️ Eliminar simulación</button>
      </div>
    </div>`;

  pintarEscenas();
  por('simModo').addEventListener('change', () => { sucio = true; alCambiarModo(); });
  contenido.querySelectorAll('#simTitulo, #simTema, #simEstado').forEach((c) => c.addEventListener('input', () => { sucio = true; }));
  por('listaEscenas').addEventListener('input', (e) => { if (e.target.type !== 'file' && e.target.type !== 'radio') alCambiar(e); });
  por('listaEscenas').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'file' || e.target.type === 'radio') alCambiar(e); });
  contenido.addEventListener('click', alHacerClic);
  por('btnAgregarEscena').addEventListener('click', () => {
    const escena = nuevaEscena();
    sim.escenas.push(escena);
    if (!sim.escenaInicial) sim.escenaInicial = escena.id;
    sucio = true;
    pintarEscenas(`esc-${escena.id}-texto`);
  });
  por('btnGuardar').addEventListener('click', guardar);
  por('btnPrevia').addEventListener('click', vistaPrevia);
  por('btnEliminar').addEventListener('click', eliminar);
}

try {
  temas = await api.listar('temas');
  if (id) {
    sim = await api.obtener('simulaciones', id);
    sim.escenas = (sim.escenas || []).map((e) => ({ ...e, imagen: e.imagen || '', opciones: (e.opciones || []).map((o) => ({ ...nuevaOpcion(), ...o })) }));
  } else {
    sim = { temaId: util.parametro('temaId') || '', titulo: '', modo: 'escenarios', estado: 'borrador', escenaInicial: '', escenas: [], personaje: {}, rubrica: [], maxTurnos: 8 };
  }
  pintarPagina();
  window.addEventListener('beforeunload', (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });
} catch (error) {
  contenido.innerHTML = `<div class="vacio" role="alert"><div class="vacio__icono" aria-hidden="true">⚠️</div><h2 class="vacio__titulo">No se pudo abrir el editor</h2><p class="vacio__texto">${ui.escapar(error.message || 'La simulación no existe o no tienes permiso.')}</p><a href="/paginas/simulaciones.html" class="btn btn--primario">Volver a Simulaciones</a></div>`;
}
