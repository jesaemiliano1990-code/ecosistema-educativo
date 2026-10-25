// publico/js/modulos/banco-preguntas.js
// Banco de preguntas del quiz por niveles: creación manual, generación con IA y aprobación docente

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });

const NIVELES = [
  { nivel: 1, nombre: 'Recordar' },
  { nivel: 2, nombre: 'Comprender' },
  { nivel: 3, nombre: 'Aplicar' },
  { nivel: 4, nombre: 'Analizar' },
  { nivel: 5, nombre: 'Evaluar' }
];
const MINIMO_RECOMENDADO = 20;
const TIPOS = { opcion: 'Opción múltiple', vf: 'Verdadero / Falso', completar: 'Completar' };
const ESTADOS = { aprobado: 'Aprobada', borrador: 'Borrador' };
const LETRAS = ['A', 'B', 'C', 'D'];

const contenido = document.getElementById('contenido');

let temas = [];
let temaId = null;
let nivelActual = 1;
let preguntas = [];

// ----------------------------------------------------
// FORMULARIO DE UNA PREGUNTA (se reutiliza en el modal y en las propuestas de la IA)
// ----------------------------------------------------

let contadorFormularios = 0;

function crearFormulario(p = {}) {
  const n = ++contadorFormularios;
  const id = (campo) => `pq${n}-${campo}`;
  const el = document.createElement('div');
  el.className = 'pila banco-form';
  el.innerHTML = `
    <div class="campo">
      <label for="${id('tipo')}">Tipo de pregunta</label>
      <select id="${id('tipo')}">
        ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
      </select>
    </div>
    <div class="campo">
      <label for="${id('enunciado')}">Enunciado</label>
      <textarea id="${id('enunciado')}" rows="3"></textarea>
      <small data-solo="completar">Escribe ____ en el lugar de la palabra que falta.</small>
    </div>
    <fieldset data-solo="opcion">
      <legend>Opciones (marca la correcta)</legend>
      ${LETRAS.map((l, i) => `
        <div class="banco-opcion">
          <input type="radio" name="${id('correcta')}" value="${i}" aria-label="Opción ${l} es la correcta">
          <input type="text" data-opcion="${i}" aria-label="Texto de la opción ${l}" placeholder="Opción ${l}">
        </div>`).join('')}
    </fieldset>
    <fieldset data-solo="vf">
      <legend>Respuesta correcta</legend>
      <label><input type="radio" name="${id('vf')}" value="true"> Verdadero</label>
      <label><input type="radio" name="${id('vf')}" value="false"> Falso</label>
    </fieldset>
    <div class="campo" data-solo="completar">
      <label for="${id('texto')}">Respuesta correcta</label>
      <input type="text" id="${id('texto')}">
    </div>
    <div class="campo">
      <label for="${id('retro')}">Retroalimentación (por qué es correcta)</label>
      <textarea id="${id('retro')}" rows="2"></textarea>
    </div>
  `;

  const tipo = el.querySelector(`#${id('tipo')}`);
  const aplicarTipo = () => {
    el.querySelectorAll('[data-solo]').forEach((x) => {
      x.hidden = x.dataset.solo !== tipo.value;
    });
  };

  // Los valores se asignan por propiedad (no por HTML) para no interpretar texto como código.
  tipo.value = p.tipo || 'opcion';
  el.querySelector(`#${id('enunciado')}`).value = p.enunciado || '';
  el.querySelector(`#${id('retro')}`).value = p.retroalimentacion || '';
  if (tipo.value === 'opcion') {
    (p.opciones || []).slice(0, 4).forEach((o, i) => { el.querySelector(`[data-opcion="${i}"]`).value = o; });
    if (Number.isInteger(p.correcta)) el.querySelector(`input[name="${id('correcta')}"][value="${p.correcta}"]`)?.click();
  } else if (tipo.value === 'vf') {
    if (typeof p.correcta === 'boolean') el.querySelector(`input[name="${id('vf')}"][value="${p.correcta}"]`).checked = true;
  } else {
    el.querySelector(`#${id('texto')}`).value = typeof p.correcta === 'string' ? p.correcta : '';
  }
  tipo.addEventListener('change', aplicarTipo);
  aplicarTipo();

  // Devuelve la pregunta lista para guardar, o lanza Error con un mensaje claro.
  function leer() {
    const t = tipo.value;
    const enunciado = el.querySelector(`#${id('enunciado')}`).value.trim();
    const retroalimentacion = el.querySelector(`#${id('retro')}`).value.trim();
    if (!enunciado) throw new Error('Escribe el enunciado.');
    if (!retroalimentacion) throw new Error('Escribe la retroalimentación.');
    if (t === 'opcion') {
      const opciones = LETRAS.map((_, i) => el.querySelector(`[data-opcion="${i}"]`).value.trim());
      if (opciones.some((o) => !o)) throw new Error('Completa las 4 opciones.');
      if (new Set(opciones.map((o) => util.normalizar(o))).size !== 4) throw new Error('Las opciones no pueden repetirse.');
      const marcada = el.querySelector(`input[name="${id('correcta')}"]:checked`);
      if (!marcada) throw new Error('Marca cuál opción es la correcta.');
      return { tipo: t, enunciado, opciones, correcta: Number(marcada.value), retroalimentacion };
    }
    if (t === 'vf') {
      const marcada = el.querySelector(`input[name="${id('vf')}"]:checked`);
      if (!marcada) throw new Error('Indica si la respuesta es Verdadero o Falso.');
      return { tipo: t, enunciado, opciones: ['Verdadero', 'Falso'], correcta: marcada.value === 'true', retroalimentacion };
    }
    const correcta = el.querySelector(`#${id('texto')}`).value.trim();
    if (!/_{2,}/.test(enunciado)) throw new Error('El enunciado debe incluir ____ donde va la respuesta.');
    if (!correcta) throw new Error('Escribe la respuesta correcta.');
    return { tipo: t, enunciado, opciones: [], correcta, retroalimentacion };
  }

  return { el, leer };
}

// ----------------------------------------------------
// LISTA Y PESTAÑAS
// ----------------------------------------------------

function textoCorrecta(p) {
  if (p.tipo === 'opcion') return `${LETRAS[p.correcta]}) ${p.opciones[p.correcta] ?? ''}`;
  if (p.tipo === 'vf') return p.correcta ? 'Verdadero' : 'Falso';
  return p.correcta;
}

function aprobadasDe(nivel) {
  return preguntas.filter((p) => p.nivel === nivel && p.estado === 'aprobado').length;
}

function dibujar() {
  const delNivel = preguntas.filter((p) => p.nivel === nivelActual);
  const aprobadas = aprobadasDe(nivelActual);

  document.getElementById('niveles').innerHTML = NIVELES.map(({ nivel, nombre }) => {
    const n = aprobadasDe(nivel);
    return `
      <button type="button" role="tab" class="banco-nivel ${n < MINIMO_RECOMENDADO ? 'banco-nivel--pocas' : ''}" data-nivel="${nivel}"
              aria-selected="${nivel === nivelActual}" id="tab-${nivel}" aria-controls="panelNivel">
        <span class="banco-nivel__nombre">Nivel ${nivel} · ${nombre}</span>
        <span class="banco-nivel__contador">${n} aprobada${n === 1 ? '' : 's'}</span>
      </button>`;
  }).join('');

  const aviso = document.getElementById('avisoNivel');
  aviso.hidden = aprobadas >= MINIMO_RECOMENDADO;
  aviso.textContent = `El nivel ${nivelActual} tiene ${aprobadas} pregunta(s) aprobada(s). Se recomiendan al menos ${MINIMO_RECOMENDADO} para que el quiz no repita preguntas.`;

  const cuerpo = document.getElementById('cuerpoLista');
  if (!delNivel.length) {
    cuerpo.innerHTML = `
      <tr><td colspan="4">
        <div class="vacio" style="border: 0;">
          <div class="vacio__icono" aria-hidden="true">❓</div>
          <h3 class="vacio__titulo">Sin preguntas en este nivel</h3>
          <p class="vacio__texto">Crea una pregunta manualmente o genera propuestas con IA para revisarlas.</p>
        </div>
      </td></tr>`;
    return;
  }
  cuerpo.innerHTML = delNivel.map((p) => `
    <tr data-id="${ui.escapar(p.id)}">
      <td class="banco-enunciado">
        ${ui.escapar(p.enunciado)}
        <br><small>Correcta: <strong>${ui.escapar(String(textoCorrecta(p)))}</strong></small>
      </td>
      <td>${ui.escapar(TIPOS[p.tipo] || p.tipo)}${p.origen === 'ia' ? ' <span class="insignia">IA</span>' : ''}</td>
      <td><span class="insignia ${p.estado === 'aprobado' ? 'insignia--exito' : 'insignia--advertencia'}">${ui.escapar(ESTADOS[p.estado] || p.estado)}</span></td>
      <td>
        <div class="tabla-acciones">
          <button type="button" class="btn btn--secundario btn--pequeno" data-accion="editar" aria-label="Editar pregunta">✏️</button>
          <button type="button" class="btn btn--peligro btn--pequeno" data-accion="eliminar" aria-label="Eliminar pregunta">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

async function cargarPreguntas() {
  ui.cargando(true);
  try {
    preguntas = await api.listar('preguntas', { temaId });
    dibujar();
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar las preguntas.', 'error');
  } finally {
    ui.cargando(false);
  }
}

// ----------------------------------------------------
// ACCIONES
// ----------------------------------------------------

async function editarPregunta(existente = null) {
  const formulario = crearFormulario(existente || {});
  const estado = document.createElement('div');
  estado.className = 'campo';
  estado.innerHTML = `
    <label for="estadoPregunta">Estado</label>
    <select id="estadoPregunta">
      <option value="aprobado">Aprobada (se usa en el quiz)</option>
      <option value="borrador">Borrador (no se usa en el quiz)</option>
    </select>`;
  estado.querySelector('select').value = existente?.estado || 'aprobado';
  formulario.el.appendChild(estado);

  while (true) {
    const accion = await ui.modal({
      titulo: existente ? `Editar pregunta (nivel ${existente.nivel})` : `Nueva pregunta · nivel ${nivelActual}`,
      contenido: formulario.el,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Guardar', valor: 'guardar', clase: 'btn--primario' }
      ]
    });
    if (accion !== 'guardar') return;
    let datos;
    try {
      datos = { ...formulario.leer(), estado: estado.querySelector('select').value };
    } catch (error) {
      ui.aviso(error.message, 'error');
      continue; // se vuelve a abrir con lo que ya se escribió
    }
    ui.cargando(true);
    try {
      if (existente) await api.actualizar('preguntas', existente.id, datos);
      else await api.crear('preguntas', { ...datos, temaId, nivel: nivelActual, origen: 'docente' });
      ui.aviso('Pregunta guardada.', 'exito');
      break;
    } catch (error) {
      ui.aviso(error.message || 'No se pudo guardar la pregunta.', 'error');
      continue;
    } finally {
      ui.cargando(false);
    }
  }
  await cargarPreguntas();
}

async function eliminarPregunta(p) {
  if (!(await ui.confirmar('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.'))) return;
  ui.cargando(true);
  try {
    await api.eliminar('preguntas', p.id);
    ui.aviso('Pregunta eliminada.', 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo eliminar la pregunta.', 'error');
  } finally {
    ui.cargando(false);
  }
  await cargarPreguntas();
}

async function pedirCantidad() {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="campo">
      <label for="cantidadIA">Cantidad de preguntas (5 a 15) para el nivel ${nivelActual} · ${NIVELES[nivelActual - 1].nombre}</label>
      <input type="number" id="cantidadIA" min="5" max="15" step="1" value="10">
    </div>
    <p><small>La IA usa el contenido y el glosario del tema. Tú revisas, editas y apruebas cada pregunta.</small></p>`;
  form.addEventListener('submit', (e) => e.preventDefault());
  const accion = await ui.modal({
    titulo: 'Generar preguntas con IA',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Generar', valor: 'generar', clase: 'btn--primario' }
    ]
  });
  if (accion !== 'generar') return null;
  const cantidad = Number(form.querySelector('#cantidadIA').value);
  if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 15) {
    ui.aviso('La cantidad debe ser un número entero entre 5 y 15.', 'error');
    return null;
  }
  return cantidad;
}

async function generarConIA() {
  const cantidad = await pedirCantidad();
  if (!cantidad) return;

  let propuestas;
  ui.cargando(true);
  try {
    propuestas = await api.ia('generar-preguntas', { temaId, nivel: nivelActual, cantidad });
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron generar las preguntas.', 'error');
    return;
  } finally {
    ui.cargando(false);
  }
  if (!Array.isArray(propuestas) || !propuestas.length) {
    ui.aviso('La IA no devolvió preguntas. Intenta de nuevo.', 'error');
    return;
  }

  // Las que se parecen (mismo enunciado normalizado) a una existente o a otra propuesta salen desmarcadas.
  const vistos = new Set(preguntas.filter((p) => p.nivel === nivelActual).map((p) => util.normalizar(p.enunciado)));
  const tarjetas = propuestas.map((p) => {
    const clave = util.normalizar(p.enunciado || '');
    const repetida = vistos.has(clave);
    vistos.add(clave);
    return { formulario: crearFormulario(p), repetida };
  });

  const contenedor = document.createElement('div');
  tarjetas.forEach((t, i) => {
    const caja = document.createElement('section');
    caja.className = 'banco-propuesta';
    caja.innerHTML = `
      <div class="banco-propuesta__cabecera">
        <label><input type="checkbox" data-aprobar ${t.repetida ? '' : 'checked'}> Aprobar pregunta ${i + 1}</label>
        ${t.repetida ? '<span class="insignia insignia--advertencia">Parecida a una existente</span>' : ''}
      </div>`;
    caja.appendChild(t.formulario.el);
    t.marca = caja.querySelector('[data-aprobar]');
    contenedor.appendChild(caja);
  });

  // Si alguna pregunta marcada no cumple las reglas, se vuelve a mostrar todo con lo ya editado.
  while (true) {
    const accion = await ui.modal({
      titulo: `Propuestas de la IA (${tarjetas.length}) · nivel ${nivelActual}`,
      contenido: contenedor,
      acciones: [
        { texto: 'Descartar todo', valor: null, clase: 'btn--secundario' },
        { texto: 'Aprobar seleccionadas', valor: 'aprobar', clase: 'btn--primario' }
      ]
    });
    if (accion !== 'aprobar') return;

    const elegidas = [];
    let problema = null;
    tarjetas.forEach((t, i) => {
      if (!t.marca.checked || problema) return;
      try {
        elegidas.push(t.formulario.leer());
      } catch (error) {
        problema = `Pregunta ${i + 1}: ${error.message}`;
      }
    });
    if (problema) {
      ui.aviso(problema, 'error');
      continue;
    }
    if (!elegidas.length) {
      ui.aviso('No seleccionaste ninguna pregunta.', 'info');
      continue;
    }

    let creadas = 0;
    ui.cargando(true);
    try {
      for (const q of elegidas) {
        await api.crear('preguntas', { ...q, temaId, nivel: nivelActual, origen: 'ia', estado: 'aprobado' });
        creadas++;
      }
      ui.aviso(`${creadas} pregunta(s) aprobada(s).`, 'exito');
    } catch (error) {
      ui.aviso(`${error.message || 'Error al guardar.'} Se guardaron ${creadas} de ${elegidas.length}.`, 'error');
    } finally {
      ui.cargando(false);
    }
    break;
  }
  await cargarPreguntas();
}

// ----------------------------------------------------
// ARRANQUE
// ----------------------------------------------------

function seleccionarTema(id) {
  temaId = id;
  history.replaceState(null, '', `?temaId=${encodeURIComponent(id)}`);
  return cargarPreguntas();
}

function pintarPagina() {
  contenido.innerHTML = `
    <div class="banco-vista">
      <div class="banco-cabecera">
        <h1 class="banco-cabecera__titulo">Banco de preguntas</h1>
        <div class="campo banco-selector">
          <label for="selectorTema">Tema</label>
          <select id="selectorTema"></select>
        </div>
      </div>

      <div class="banco-niveles" id="niveles" role="tablist" aria-label="Niveles del quiz"></div>
      <div class="alerta alerta--advertencia banco-aviso" id="avisoNivel" role="status" hidden></div>

      <div class="banco-acciones">
        <h2 id="panelNivel" style="margin: 0;">Preguntas del nivel</h2>
        <div class="fila" style="gap: var(--espacio-s);">
          <button type="button" id="btnIA" class="btn btn--secundario">✨ Generar con IA</button>
          <button type="button" id="btnNueva" class="btn btn--primario">+ Nueva pregunta</button>
        </div>
      </div>

      <div class="tabla">
        <table class="banco-lista">
          <thead>
            <tr>
              <th scope="col">Enunciado</th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody id="cuerpoLista"></tbody>
        </table>
      </div>
    </div>`;

  const selector = document.getElementById('selectorTema');
  const porAsignatura = new Map();
  for (const t of temas) {
    if (!porAsignatura.has(t.asignatura)) porAsignatura.set(t.asignatura, []);
    porAsignatura.get(t.asignatura).push(t);
  }
  selector.innerHTML = [...porAsignatura].map(([asig, lista]) => `
    <optgroup label="${ui.escapar(asig)}">
      ${lista.map((t) => `<option value="${ui.escapar(t.id)}">${ui.escapar(t.unidad)} · ${ui.escapar(t.titulo)}</option>`).join('')}
    </optgroup>`).join('');
  selector.value = temaId;
  selector.addEventListener('change', () => seleccionarTema(selector.value));

  document.getElementById('niveles').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-nivel]');
    if (!boton) return;
    nivelActual = Number(boton.dataset.nivel);
    dibujar();
  });
  document.getElementById('cuerpoLista').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const p = preguntas.find((x) => x.id === boton.closest('tr').dataset.id);
    if (!p) return;
    if (boton.dataset.accion === 'editar') editarPregunta(p);
    else eliminarPregunta(p);
  });
  document.getElementById('btnNueva').addEventListener('click', () => editarPregunta());
  document.getElementById('btnIA').addEventListener('click', generarConIA);
}

ui.cargando(true);
try {
  const [asignaturas, unidades, listaTemas] = await Promise.all([
    api.listar('asignaturas'),
    api.listar('unidades'),
    api.listar('temas')
  ]);
  const nombreAsig = new Map(asignaturas.map((a) => [a.id, a.nombre]));
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
  temas = listaTemas
    .map((t) => {
      const u = unidadPorId.get(t.unidadId);
      return u ? { id: t.id, titulo: t.titulo, unidad: u.titulo, asignatura: nombreAsig.get(u.asignaturaId) || 'Sin asignatura' } : null;
    })
    .filter(Boolean);
} catch (error) {
  ui.aviso(error.message || 'No se pudieron cargar los temas.', 'error');
} finally {
  ui.cargando(false);
}

if (!temas.length) {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">📚</div>
      <h2 class="vacio__titulo">No hay temas disponibles</h2>
      <p class="vacio__texto">Crea un tema en Contenidos para empezar el banco de preguntas.</p>
      <a href="/paginas/editor-contenidos.html" class="btn btn--primario">Ir a Contenidos</a>
    </div>`;
} else {
  const pedido = util.parametro('temaId');
  temaId = temas.some((t) => t.id === pedido) ? pedido : temas[0].id;
  pintarPagina();
  await seleccionarTema(temaId);
}
