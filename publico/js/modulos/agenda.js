// publico/js/modulos/agenda.js
// Agenda personal y de grupo: calendario (mes, semana, lista) y vista "Mi semana"

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Agenda', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const yo = sesion.usuarioActual();
const esDocente = yo.rol === 'docente' || yo.rol === 'admin';
const esEstudiante = yo.rol === 'estudiante';

// Cada tipo lleva ícono y color de tokens.css (el color nunca es la única pista).
const TIPOS = {
  tarea: { nombre: 'Tarea', icono: '📝', token: '--color-info' },
  reunion: { nombre: 'Reunión', icono: '👥', token: '--color-secundario' },
  'fecha-limite': { nombre: 'Fecha límite', icono: '⏰', token: '--color-error' },
  recordatorio: { nombre: 'Recordatorio', icono: '🔔', token: '--color-acento', texto: '--color-primario' }
};
const RECORDATORIOS = [
  { minutos: 1440, texto: '1 día antes' },
  { minutos: 60, texto: '1 hora antes' }
];

let eventos = [];
let grupos = [];
let asignaturas = new Map();
let temas = [];
let intentos = [];
let calendario = null;
let pestana = 'calendario';

// ----------------------------------------------------
// FECHAS
// ----------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// "AAAA-MM-DD" como medianoche local (new Date("AAAA-MM-DD") la tomaría en UTC).
function fechaLocal(texto) {
  if (SOLO_FECHA.test(texto)) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  return new Date(texto);
}

function aValorInput(iso, todoElDia) {
  if (!iso) return '';
  if (todoElDia) return iso.slice(0, 10);
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deValorInput(valor, todoElDia) {
  if (!valor) return null;
  return todoElDia ? valor : new Date(valor).toISOString();
}

function sumarDia(fecha) {
  const d = fechaLocal(fecha);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function textoMomento(e) {
  const opciones = e.todoElDia ? { dateStyle: 'full' } : { dateStyle: 'full', timeStyle: 'short' };
  const f = (v) => new Intl.DateTimeFormat('es-EC', opciones).format(fechaLocal(v));
  return e.fin && e.fin !== e.inicio ? `${f(e.inicio)} → ${f(e.fin)}` : f(e.inicio);
}

// ----------------------------------------------------
// DATOS
// ----------------------------------------------------

// ✓ si la persona tiene un intento de esa actividad y tema posterior a la creación de la fecha límite.
function completado(e) {
  if (!esEstudiante || e.tipo !== 'fecha-limite' || !e.actividad || !e.temaId) return false;
  const creado = new Date(e.fecha).getTime();
  return intentos.some((i) => i.actividad === e.actividad && i.temaId === e.temaId && new Date(i.fecha).getTime() > creado);
}

function vencido(e) {
  if (!esEstudiante || e.tipo !== 'fecha-limite' || completado(e)) return false;
  const limite = e.todoElDia ? fechaLocal(sumarDia(e.fin || e.inicio)) : fechaLocal(e.fin || e.inicio);
  return limite.getTime() < Date.now();
}

function colorDe(tipo) {
  const estilos = getComputedStyle(document.documentElement);
  const meta = TIPOS[tipo];
  return { fondo: estilos.getPropertyValue(meta.token).trim(), texto: estilos.getPropertyValue(meta.texto || '--color-texto-inverso').trim() };
}

function eventosParaCalendario() {
  return eventos.map((e) => {
    const { fondo, texto } = colorDe(e.tipo);
    const ok = completado(e);
    return {
      id: e.id,
      title: `${ok ? '✓ ' : ''}${TIPOS[e.tipo].icono} ${e.titulo}`,
      start: e.inicio,
      end: e.fin ? (e.todoElDia ? sumarDia(e.fin) : e.fin) : undefined,
      allDay: Boolean(e.todoElDia),
      backgroundColor: fondo,
      borderColor: fondo,
      textColor: texto
    };
  });
}

async function cargarDatos() {
  const peticiones = [
    api.listar('agenda'),
    api.listar('asignaturas'),
    api.listar('temas'),
    esEstudiante ? api.listar('intentos') : Promise.resolve([]),
    esDocente ? api.listar('distributivo') : Promise.resolve([]),
    api.listar('unidades')
  ];
  const [lista, listaAsignaturas, listaTemas, listaIntentos, listaGrupos, listaUnidades] = await Promise.all(peticiones);
  eventos = lista;
  asignaturas = new Map(listaAsignaturas.map((a) => [a.id, a]));
  // Cada tema se asocia a su asignatura (tema → unidad → asignatura).
  const asignaturaDeUnidad = new Map(listaUnidades.map((u) => [u.id, u.asignaturaId]));
  temas = listaTemas.map((t) => ({ ...t, asignaturaId: asignaturaDeUnidad.get(t.unidadId) }));
  intentos = listaIntentos;
  grupos = yo.rol === 'admin' ? listaGrupos : listaGrupos.filter((g) => g.docenteId === yo.id);
}

async function recargar() {
  ui.cargando(true);
  try {
    await cargarDatos();
    calendario?.refetchEvents();
    pintarSemana();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo actualizar la agenda.', 'error');
  } finally {
    ui.cargando(false);
  }
}

// ----------------------------------------------------
// MI SEMANA
// ----------------------------------------------------

function rangoDelEvento(e) {
  const inicio = fechaLocal(e.inicio);
  const fin = e.fin ? (e.todoElDia ? fechaLocal(sumarDia(e.fin)) : fechaLocal(e.fin)) : null;
  return { inicio, fin: fin || (e.todoElDia ? fechaLocal(sumarDia(e.inicio)) : inicio) };
}

function itemSemana(e) {
  const venc = vencido(e);
  const { inicio } = rangoDelEvento(e);
  const hora = e.todoElDia ? 'Todo el día' : new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }).format(inicio);
  return `
    <li>
      <button type="button" class="semana-item ${venc ? 'semana-item--vencido' : ''}" data-evento="${ui.escapar(e.id)}" style="--color-tipo: var(${TIPOS[e.tipo].token})">
        <span>
          ${completado(e) ? '✓ ' : ''}${TIPOS[e.tipo].icono} <strong>${ui.escapar(e.titulo)}</strong>
          ${venc ? '<span class="insignia insignia--advertencia">Vencida</span>' : ''}
          ${e.grupoId ? '<span class="insignia">Grupo</span>' : ''}
        </span>
        <span class="semana-item__hora">${ui.escapar(hora)}</span>
      </button>
    </li>`;
}

function pintarSemana() {
  const zona = document.getElementById('panelSemana');
  if (!zona) return;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() + i);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 1);
    const delDia = eventos
      .filter((e) => {
        const r = rangoDelEvento(e);
        return r.inicio < fin && (r.fin > inicio || r.inicio >= inicio);
      })
      .sort((a, b) => fechaLocal(a.inicio) - fechaLocal(b.inicio));
    return { inicio, delDia };
  });

  const vencidas = eventos.filter(vencido).sort((a, b) => fechaLocal(a.inicio) - fechaLocal(b.inicio));
  const etiqueta = (d, i) => `${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : ''} ${new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}`.trim();

  zona.innerHTML = `
    ${vencidas.length ? `
      <section class="semana-bloque" aria-labelledby="titVencidas">
        <h3 class="semana-bloque__titulo" id="titVencidas">⚠️ Fechas límite vencidas sin completar</h3>
        <ul class="semana-lista">${vencidas.map(itemSemana).join('')}</ul>
      </section>` : ''}
    ${dias.map((d, i) => `
      <section class="semana-bloque" aria-label="${ui.escapar(etiqueta(d.inicio, i))}">
        <h3 class="semana-bloque__titulo">${ui.escapar(etiqueta(d.inicio, i))}</h3>
        ${d.delDia.length ? `<ul class="semana-lista">${d.delDia.map(itemSemana).join('')}</ul>` : '<p class="semana-vacio">Sin eventos.</p>'}
      </section>`).join('')}`;
  zona.querySelectorAll('[data-evento]').forEach((b) => b.addEventListener('click', () => verEvento(b.dataset.evento)));
}

// ----------------------------------------------------
// FORMULARIO
// ----------------------------------------------------

let contador = 0;

function temasDisponibles(grupoId) {
  const asignaturaId = grupos.find((g) => g.id === grupoId)?.asignaturaId;
  return temas.filter((t) => {
    if (!asignaturaId) return true;
    return t.asignaturaId === asignaturaId;
  });
}

function etiquetaGrupo(g) {
  return `${asignaturas.get(g.asignaturaId)?.nombre || 'Asignatura'} · ${g.paralelo || ''} ${g.periodo || ''}`.trim();
}

function construirFormulario(e, fechaInicial) {
  const n = ++contador;
  const id = (c) => `ag${n}-${c}`;
  const form = document.createElement('form');
  form.className = 'pila agenda-form';
  form.innerHTML = `
    <div class="campo"><label for="${id('titulo')}">Título</label><input type="text" id="${id('titulo')}" maxlength="120"></div>
    <div class="campo">
      <label for="${id('tipo')}">Tipo</label>
      <select id="${id('tipo')}">${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}">${t.icono} ${t.nombre}</option>`).join('')}</select>
    </div>
    <label class="agenda-check"><input type="checkbox" id="${id('dia')}"> Dura todo el día</label>
    <div class="campo"><label for="${id('inicio')}">Inicio</label><input type="datetime-local" id="${id('inicio')}"></div>
    <div class="campo"><label for="${id('fin')}">Fin (opcional)</label><input type="datetime-local" id="${id('fin')}"></div>
    <fieldset>
      <legend>Recordatorios</legend>
      ${RECORDATORIOS.map((r) => `<label class="agenda-check"><input type="checkbox" data-min="${r.minutos}"> ${r.texto}</label>`).join('')}
    </fieldset>
    ${esDocente ? `
      <div class="campo">
        <label for="${id('grupo')}">Grupo (opcional)</label>
        <select id="${id('grupo')}">
          <option value="">Solo para mí</option>
          ${grupos.map((g) => `<option value="${ui.escapar(g.id)}">${ui.escapar(etiquetaGrupo(g))}</option>`).join('')}
        </select>
      </div>
      <fieldset data-solo="fecha-limite">
        <legend>Actividad vinculada (muestra ✓ al estudiante que la complete)</legend>
        <div class="campo"><label for="${id('actividad')}">Actividad</label>
          <select id="${id('actividad')}"><option value="">Ninguna</option>${ACTIVIDADES.filter((a) => a.id !== 'canciones').map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.texto)}</option>`).join('')}</select>
        </div>
        <div class="campo"><label for="${id('tema')}">Tema</label><select id="${id('tema')}"></select></div>
      </fieldset>` : ''}
  `;

  const q = (c) => form.querySelector(`#${id(c)}`);
  const tipo = q('tipo');
  const dia = q('dia');
  const inicio = q('inicio');
  const fin = q('fin');

  const aplicarDia = () => {
    const valorInicio = inicio.value.slice(0, 10);
    const valorFin = fin.value.slice(0, 10);
    inicio.type = fin.type = dia.checked ? 'date' : 'datetime-local';
    if (dia.checked) { inicio.value = valorInicio; fin.value = valorFin; } else { inicio.value = valorInicio ? `${valorInicio}T09:00` : ''; fin.value = valorFin ? `${valorFin}T10:00` : ''; }
  };
  const pintarTemas = (seleccionado = '') => {
    const sel = q('tema');
    if (!sel) return;
    const lista = temasDisponibles(q('grupo')?.value || '');
    sel.innerHTML = `<option value="">Ninguno</option>${lista.map((t) => `<option value="${ui.escapar(t.id)}">${ui.escapar(t.titulo)}</option>`).join('')}`;
    sel.value = lista.some((t) => t.id === seleccionado) ? seleccionado : '';
  };
  const aplicarTipo = () => form.querySelectorAll('[data-solo]').forEach((x) => { x.hidden = x.dataset.solo !== tipo.value; });

  // Valores iniciales (por propiedad, nunca por HTML)
  q('titulo').value = e?.titulo || '';
  tipo.value = e?.tipo || 'tarea';
  dia.checked = Boolean(e?.todoElDia);
  inicio.type = fin.type = dia.checked ? 'date' : 'datetime-local';
  inicio.value = e ? aValorInput(e.inicio, e.todoElDia) : (fechaInicial || '');
  fin.value = e?.fin ? aValorInput(e.fin, e.todoElDia) : '';
  const guardados = new Set((e?.recordatorios || []).map(Number));
  form.querySelectorAll('[data-min]').forEach((c) => { c.checked = guardados.has(Number(c.dataset.min)); });
  if (q('grupo')) q('grupo').value = e?.grupoId || '';
  if (q('actividad')) q('actividad').value = e?.actividad || '';
  pintarTemas(e?.temaId || '');
  aplicarTipo();

  dia.addEventListener('change', aplicarDia);
  tipo.addEventListener('change', aplicarTipo);
  q('grupo')?.addEventListener('change', () => pintarTemas(q('tema').value));
  form.addEventListener('submit', (ev) => ev.preventDefault());

  // Devuelve los datos listos para guardar o lanza Error con un mensaje claro.
  function leer() {
    const titulo = q('titulo').value.trim();
    if (!titulo) throw new Error('Escribe un título.');
    if (!inicio.value) throw new Error('Indica cuándo empieza.');
    const todoElDia = dia.checked;
    const datos = {
      titulo,
      tipo: tipo.value,
      todoElDia,
      inicio: deValorInput(inicio.value, todoElDia),
      fin: deValorInput(fin.value, todoElDia),
      // Se conservan los recordatorios que el formulario no ofrece (p. ej., creados desde otra parte).
      recordatorios: [
        ...[...guardados].filter((m) => !RECORDATORIOS.some((r) => r.minutos === m)),
        ...[...form.querySelectorAll('[data-min]:checked')].map((c) => Number(c.dataset.min))
      ]
    };
    if (datos.fin && fechaLocal(datos.fin) < fechaLocal(datos.inicio)) throw new Error('El fin no puede ser anterior al inicio.');
    if (esDocente) {
      datos.grupoId = q('grupo').value || null;
      datos.actividad = tipo.value === 'fecha-limite' ? q('actividad').value || null : null;
      datos.temaId = tipo.value === 'fecha-limite' ? q('tema').value || null : null;
      if (datos.actividad && !datos.temaId) throw new Error('Elige el tema de la actividad vinculada.');
    }
    return datos;
  }
  return { form, leer };
}

async function editarEvento(existente = null, fechaInicial = '') {
  const { form, leer } = construirFormulario(existente, fechaInicial);
  while (true) {
    const accion = await ui.modal({
      titulo: existente ? 'Editar evento' : 'Nuevo evento',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Guardar', valor: 'guardar', clase: 'btn--primario' }
      ]
    });
    if (accion !== 'guardar') return;
    let datos;
    try {
      datos = leer();
    } catch (error) {
      ui.aviso(error.message, 'error');
      continue;
    }
    ui.cargando(true);
    try {
      if (existente) await api.actualizar('agenda', existente.id, datos);
      else await api.crear('agenda', datos);
      ui.aviso('Evento guardado.', 'exito');
      break;
    } catch (error) {
      ui.aviso(error.message || 'No se pudo guardar el evento.', 'error');
    } finally {
      ui.cargando(false);
    }
  }
  await recargar();
}

// ----------------------------------------------------
// DETALLE
// ----------------------------------------------------

async function verEvento(id) {
  const e = eventos.find((x) => x.id === id);
  if (!e) return;
  const mio = e.propietarioId === yo.id;
  const actividad = ACTIVIDADES.find((a) => a.id === e.actividad);
  const tema = temas.find((t) => t.id === e.temaId);
  const grupo = grupos.find((g) => g.id === e.grupoId);

  const lista = document.createElement('dl');
  lista.className = 'agenda-detalle';
  const fila = (etiqueta, html) => `<dt>${etiqueta}</dt><dd>${html}</dd>`;
  lista.innerHTML = [
    fila('Tipo', `${TIPOS[e.tipo].icono} ${ui.escapar(TIPOS[e.tipo].nombre)}${completado(e) ? ' <span class="insignia insignia--exito">✓ Completada</span>' : ''}${vencido(e) ? ' <span class="insignia insignia--advertencia">Vencida</span>' : ''}`),
    fila('Cuándo', ui.escapar(textoMomento(e))),
    e.grupoId ? fila('Grupo', ui.escapar(grupo ? etiquetaGrupo(grupo) : 'Evento de grupo')) : '',
    actividad ? fila('Actividad', `${ui.escapar(actividad.texto)}${tema ? ` · ${ui.escapar(tema.titulo)}` : ''}<br><a href="${ui.escapar(actividad.href)}?temaId=${encodeURIComponent(e.temaId || '')}">Ir a la actividad</a>`) : '',
    (e.recordatorios || []).length ? fila('Avisos', e.recordatorios.map((m) => (RECORDATORIOS.find((r) => r.minutos === m)?.texto || `${m} min antes`)).map(ui.escapar).join(' · ')) : '',
    fila('Creado por', ui.escapar(mio ? 'ti' : e.propietarioNombre || 'otra persona'))
  ].join('');

  const accion = await ui.modal({
    titulo: e.titulo,
    contenido: lista,
    acciones: [
      ...(mio ? [{ texto: 'Eliminar', valor: 'eliminar', clase: 'btn--peligro' }, { texto: 'Editar', valor: 'editar', clase: 'btn--secundario' }] : []),
      { texto: 'Cerrar', valor: null, clase: 'btn--primario' }
    ]
  });
  if (accion === 'editar') return editarEvento(e);
  if (accion === 'eliminar') {
    if (!(await ui.confirmar('¿Eliminar este evento? No se puede deshacer.'))) return;
    ui.cargando(true);
    try {
      await api.eliminar('agenda', e.id);
      ui.aviso('Evento eliminado.', 'exito');
    } catch (error) {
      ui.aviso(error.message || 'No se pudo eliminar el evento.', 'error');
    } finally {
      ui.cargando(false);
    }
    await recargar();
  }
}

// ----------------------------------------------------
// PÁGINA
// ----------------------------------------------------

function cambiarPestana(nueva) {
  pestana = nueva;
  document.querySelectorAll('.agenda-pestana').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pestana === nueva)));
  document.getElementById('panelCalendario').hidden = nueva !== 'calendario';
  document.getElementById('panelSemana').hidden = nueva !== 'semana';
  if (nueva === 'calendario') calendario?.updateSize();
}

function pintarPagina() {
  contenido.innerHTML = `
    <div class="agenda-vista">
      <div class="agenda-cabecera">
        <h1 class="agenda-cabecera__titulo">Agenda</h1>
        <div class="fila" style="gap: var(--espacio-s); flex-wrap: wrap;">
          <div class="agenda-pestanas" role="tablist" aria-label="Vistas de la agenda">
            <button type="button" role="tab" class="agenda-pestana" data-pestana="calendario" aria-selected="true">📅 Calendario</button>
            <button type="button" role="tab" class="agenda-pestana" data-pestana="semana" aria-selected="false">🗓️ Mi semana</button>
          </div>
          <button type="button" id="btnNuevoEvento" class="btn btn--primario">+ Nuevo evento</button>
        </div>
      </div>
      <ul class="agenda-leyenda" aria-label="Tipos de evento">
        ${Object.values(TIPOS).map((t) => `<li style="--color-tipo: var(${t.token})"><span class="agenda-leyenda__color" aria-hidden="true"></span>${t.icono} ${ui.escapar(t.nombre)}</li>`).join('')}
        ${esEstudiante ? '<li>✓ Completada</li>' : ''}
      </ul>
      <div class="agenda-calendario" id="panelCalendario"><div id="calendario"></div></div>
      <div class="pila" id="panelSemana" hidden></div>
    </div>`;

  document.querySelectorAll('.agenda-pestana').forEach((b) => b.addEventListener('click', () => cambiarPestana(b.dataset.pestana)));
  document.getElementById('btnNuevoEvento').addEventListener('click', () => {
    const ahora = new Date();
    ahora.setMinutes(0, 0, 0);
    ahora.setHours(ahora.getHours() + 1);
    editarEvento(null, aValorInput(ahora.toISOString(), false));
  });

  calendario = new window.FullCalendar.Calendar(document.getElementById('calendario'), {
    locale: 'es',
    firstDay: 1,
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listMonth' },
    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' },
    height: 'auto',
    navLinks: true,
    nowIndicator: true,
    dayMaxEvents: 3,
    noEventsText: 'No hay eventos en este periodo',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    events: (_info, ok) => ok(eventosParaCalendario()),
    eventClick: (info) => { info.jsEvent.preventDefault(); verEvento(info.event.id); },
    dateClick: (info) => editarEvento(null, info.allDay ? `${info.dateStr}T09:00` : aValorInput(info.date.toISOString(), false))
  });
  calendario.render();
  pintarSemana();
}

ui.cargando(true);
try {
  await cargarDatos();
} catch (error) {
  ui.aviso(error.message || 'No se pudo cargar la agenda.', 'error');
} finally {
  ui.cargando(false);
}

if (!window.FullCalendar) {
  contenido.innerHTML = `
    <div class="vacio">
      <div class="vacio__icono" aria-hidden="true">📅</div>
      <h2 class="vacio__titulo">No se pudo cargar el calendario</h2>
      <p class="vacio__texto">Revisa tu conexión a internet y recarga la página.</p>
    </div>`;
} else {
  pintarPagina();
}
