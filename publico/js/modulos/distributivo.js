// publico/js/modulos/distributivo.js
// Panel de administración del distributivo académico (grupos, paralelos, docentes y estudiantes)

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Distributivo', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="admin-distributivo">
      <header class="distributivo-header">
        <div>
          <h1>Distributivo Docente</h1>
          <p>Asignación de materias, paralelos, períodos, docentes y estudiantes</p>
        </div>
        <div class="distributivo-header__acciones">
          <span id="contadorGrupos" class="insignia insignia--info">0 grupos</span>
          <button type="button" class="btn btn--primario" id="btnNuevoGrupo">
            + Asignar grupo
          </button>
        </div>
      </header>

      <!-- Barra de filtros -->
      <section class="filtros-distributivo" aria-label="Filtros de distributivo">
        <div class="campo">
          <label for="inputBusqueda">Buscar por asignatura, docente o paralelo</label>
          <input type="search" id="inputBusqueda" placeholder="Filtrar grupos..." autocomplete="off">
        </div>
        <div class="campo">
          <label for="selectFiltroAsignatura">Filtrar por asignatura</label>
          <select id="selectFiltroAsignatura">
            <option value="todas">Todas las asignaturas</option>
          </select>
        </div>
      </section>

      <!-- Tabla de grupos -->
      <div class="tabla-tarjeta">
        <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Listado de grupos del distributivo">
          <table class="tabla" id="tablaDistributivo">
            <thead>
              <tr>
                <th scope="col">Asignatura</th>
                <th scope="col">Paralelo</th>
                <th scope="col">Período</th>
                <th scope="col">Docente asignado</th>
                <th scope="col">Estudiantes</th>
                <th scope="col" style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyDistributivo">
              <tr>
                <td colspan="6" class="tabla-vacia" style="text-align: center; padding: var(--espacio-l);">
                  Cargando distributivo académico...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let listaGrupos = [];
  let listaAsignaturas = [];
  let listaUsuarios = [];
  let filtroTexto = '';
  let filtroAsignatura = 'todas';

  const tbody = document.getElementById('tbodyDistributivo');
  const contadorGrupos = document.getElementById('contadorGrupos');
  const inputBusqueda = document.getElementById('inputBusqueda');
  const selectFiltroAsignatura = document.getElementById('selectFiltroAsignatura');
  const btnNuevo = document.getElementById('btnNuevoGrupo');

  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [grupos, asigs, usus] = await Promise.all([
        api.listar('distributivo'),
        api.listar('asignaturas'),
        api.listar('usuarios')
      ]);

      listaGrupos = Array.isArray(grupos) ? grupos : [];
      listaAsignaturas = Array.isArray(asigs) ? asigs : [];
      listaUsuarios = Array.isArray(usus) ? usus : [];

      actualizarFiltroAsignaturas();
      renderizar();
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar los datos del distributivo.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function actualizarFiltroAsignaturas() {
    const valActual = selectFiltroAsignatura.value;
    selectFiltroAsignatura.innerHTML = `
      <option value="todas">Todas las asignaturas</option>
      ${listaAsignaturas.map(a => `
        <option value="${ui.escapar(a.id)}"${a.id === valActual ? ' selected' : ''}>
          ${ui.escapar(a.nombre || a.id)}
        </option>
      `).join('')}
    `;
  }

  function obtenerAsignatura(id) {
    return listaAsignaturas.find(a => a && a.id === id) || null;
  }

  function obtenerUsuario(id) {
    return listaUsuarios.find(u => u && u.id === id) || null;
  }

  function renderizar() {
    const q = filtroTexto.trim().toLowerCase();

    const filtrados = listaGrupos.filter(g => {
      if (!g) return false;
      if (filtroAsignatura !== 'todas' && g.asignaturaId !== filtroAsignatura) return false;

      if (!q) return true;
      const asig = obtenerAsignatura(g.asignaturaId);
      const doc = obtenerUsuario(g.docenteId);
      const nomAsig = (asig?.nombre || '').toLowerCase();
      const nomDoc = doc ? `${doc.nombre} ${doc.apellido}`.toLowerCase() : '';
      const paralelo = (g.paralelo || '').toLowerCase();
      const periodo = (g.periodo || '').toLowerCase();

      return nomAsig.includes(q) || nomDoc.includes(q) || paralelo.includes(q) || periodo.includes(q);
    });

    contadorGrupos.textContent = `${filtrados.length} grupo${filtrados.length === 1 ? '' : 's'}`;

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="tabla-vacia" style="text-align: center; padding: var(--espacio-xl);">
            No se encontraron grupos en el distributivo.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtrados.map(g => {
      const asig = obtenerAsignatura(g.asignaturaId);
      const doc = obtenerUsuario(g.docenteId);
      const cantEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

      const nombreAsignatura = asig
        ? `<strong>${ui.escapar(asig.nombre)}</strong> <small style="color:var(--color-texto-suave)">(${ui.escapar(asig.nivel || '')})</small>`
        : `<em style="color:var(--color-texto-suave)">${ui.escapar(g.asignaturaId || 'Sin asignatura')}</em>`;

      const nombreDocente = doc
        ? `<div><strong>${ui.escapar(doc.nombre)} ${ui.escapar(doc.apellido)}</strong><br><small style="color:var(--color-texto-suave)">${ui.escapar(doc.correo)}</small></div>`
        : `<em style="color:var(--color-error)">No asignado (${ui.escapar(g.docenteId || '')})</em>`;

      return `
        <tr data-id="${ui.escapar(g.id)}">
          <td>${nombreAsignatura}</td>
          <td><span class="insignia">${ui.escapar(g.paralelo || '-')}</span></td>
          <td>${ui.escapar(g.periodo || '-')}</td>
          <td>${nombreDocente}</td>
          <td>
            <span class="insignia ${cantEstudiantes > 0 ? 'insignia--exito' : ''}">
              ${cantEstudiantes} estudiante${cantEstudiantes === 1 ? '' : 's'}
            </span>
          </td>
          <td style="text-align: right;">
            <div class="tabla-acciones">
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(g.id)}">
                Editar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(g.id)}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function abrirModalGrupo(grupo = null) {
    const docentes = listaUsuarios.filter(u => u && u.rol === 'docente' && u.activo !== false);
    const estudiantes = listaUsuarios.filter(u => u && u.rol === 'estudiante' && u.activo !== false);

    const seleccionados = new Set(Array.isArray(grupo?.estudiantes) ? grupo.estudiantes : []);

    const form = document.createElement('form');
    form.className = 'modal-form-distributivo';
    form.innerHTML = `
      <div class="campo">
        <label for="modalAsignatura">Asignatura *</label>
        <select id="modalAsignatura" required>
          <option value="">Selecciona una asignatura...</option>
          ${listaAsignaturas.map(a => `
            <option value="${ui.escapar(a.id)}"${grupo?.asignaturaId === a.id ? ' selected' : ''}>
              ${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'General')})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="modal-fila">
        <div class="campo">
          <label for="modalParalelo">Paralelo *</label>
          <input type="text" id="modalParalelo" required placeholder="Ej. A" value="${ui.escapar(grupo?.paralelo || 'A')}">
        </div>
        <div class="campo">
          <label for="modalPeriodo">Período lectivo *</label>
          <input type="text" id="modalPeriodo" required placeholder="Ej. 2026-2027" value="${ui.escapar(grupo?.periodo || '2026-2027')}">
        </div>
      </div>

      <div class="campo">
        <label for="modalDocente">Docente titular *</label>
        <select id="modalDocente" required>
          <option value="">Selecciona un docente...</option>
          ${docentes.map(d => `
            <option value="${ui.escapar(d.id)}"${grupo?.docenteId === d.id ? ' selected' : ''}>
              ${ui.escapar(d.nombre)} ${ui.escapar(d.apellido)} (${ui.escapar(d.correo)})
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Buscador y selección de estudiantes -->
      <div class="seccion-estudiantes">
        <div class="seccion-estudiantes__header">
          <label for="inputBuscarEst">Estudiantes del grupo</label>
          <span id="contadorEstModal" class="contador-estudiantes">
            ${seleccionados.size} seleccionado${seleccionados.size === 1 ? '' : 's'}
          </span>
        </div>

        <div class="buscador-estudiantes-wrap">
          <input type="search" id="inputBuscarEst" placeholder="Filtrar por nombre, apellido o correo..." autocomplete="off">
        </div>

        <div class="lista-estudiantes" id="contenedorListaEstudiantes" tabindex="0" role="group" aria-label="Selección de estudiantes">
          ${estudiantes.length === 0 ? `
            <div class="lista-estudiantes__vacia">No hay estudiantes activos registrados en el sistema.</div>
          ` : estudiantes.map(e => {
            const checked = seleccionados.has(e.id);
            return `
              <label class="item-estudiante" data-id="${ui.escapar(e.id)}" data-texto="${ui.escapar(`${e.nombre} ${e.apellido} ${e.correo}`.toLowerCase())}">
                <input type="checkbox" class="check-estudiante" value="${ui.escapar(e.id)}"${checked ? ' checked' : ''}>
                <span class="item-estudiante__info">
                  <strong>${ui.escapar(e.nombre)} ${ui.escapar(e.apellido)}</strong>
                  <small>${ui.escapar(e.correo)}</small>
                </span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const selectAsig = form.querySelector('#modalAsignatura');
    const inputParalelo = form.querySelector('#modalParalelo');
    const inputPeriodo = form.querySelector('#modalPeriodo');
    const selectDoc = form.querySelector('#modalDocente');
    const inputBuscarEst = form.querySelector('#inputBuscarEst');
    const contadorEstModal = form.querySelector('#contadorEstModal');
    const contenedorEst = form.querySelector('#contenedorListaEstudiantes');

    function actualizarContador() {
      contadorEstModal.textContent = `${seleccionados.size} seleccionado${seleccionados.size === 1 ? '' : 's'}`;
    }

    // Buscador interactivo de estudiantes
    inputBuscarEst.addEventListener('input', (e) => {
      const qEst = e.target.value.trim().toLowerCase();
      const items = contenedorEst.querySelectorAll('.item-estudiante');
      items.forEach(item => {
        const texto = item.getAttribute('data-texto') || '';
        item.style.display = (!qEst || texto.includes(qEst)) ? 'flex' : 'none';
      });
    });

    // Control de casillas de verificación
    contenedorEst.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('check-estudiante')) {
        const idEst = e.target.value;
        if (e.target.checked) {
          seleccionados.add(idEst);
        } else {
          seleccionados.delete(idEst);
        }
        actualizarContador();
      }
    });

    const accion = await ui.modal({
      titulo: grupo ? 'Editar grupo del distributivo' : 'Asignar nuevo grupo',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: grupo ? 'Guardar cambios' : 'Crear grupo', valor: 'guardar', clase: 'btn--primario' }
      ]
    });

    if (accion === 'guardar') {
      const asignaturaId = selectAsig.value;
      const paralelo = inputParalelo.value.trim().toUpperCase();
      const periodo = inputPeriodo.value.trim();
      const docenteId = selectDoc.value;
      const estudiantesArr = Array.from(seleccionados);

      if (!asignaturaId) {
        ui.aviso('Debes seleccionar una asignatura.', 'error');
        return;
      }
      if (!paralelo) {
        ui.aviso('El paralelo es obligatorio.', 'error');
        return;
      }
      if (!periodo) {
        ui.aviso('El período lectivo es obligatorio.', 'error');
        return;
      }
      if (!docenteId) {
        ui.aviso('Debes seleccionar un docente.', 'error');
        return;
      }

      ui.cargando(true);
      try {
        const payload = {
          asignaturaId,
          paralelo,
          periodo,
          docenteId,
          estudiantes: estudiantesArr
        };

        if (grupo && grupo.id) {
          await api.actualizar('distributivo', grupo.id, payload);
          ui.aviso('Grupo del distributivo actualizado con éxito.', 'exito');
        } else {
          await api.crear('distributivo', payload);
          ui.aviso('Grupo asignado con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar el grupo.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  async function eliminarGrupo(id) {
    const grupo = listaGrupos.find(g => g && g.id === id);
    if (!grupo) return;

    const asig = obtenerAsignatura(grupo.asignaturaId);
    const nombreRef = asig ? `${asig.nombre} (Paralelo ${grupo.paralelo})` : `Grupo ${id}`;

    const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar la asignación de ${nombreRef}?`);
    if (!confirmado) return;

    ui.cargando(true);
    try {
      await api.eliminar('distributivo', id);
      ui.aviso('Grupo eliminado del distributivo.', 'exito');
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al eliminar el grupo.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Event Listeners
  btnNuevo.addEventListener('click', () => abrirModalGrupo(null));

  inputBusqueda.addEventListener('input', (e) => {
    filtroTexto = e.target.value;
    renderizar();
  });

  selectFiltroAsignatura.addEventListener('change', (e) => {
    filtroAsignatura = e.target.value;
    renderizar();
  });

  tbody.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = btnEditar.getAttribute('data-id');
      const g = listaGrupos.find(item => item && item.id === id);
      if (g) abrirModalGrupo(g);
      return;
    }

    const btnEliminar = e.target.closest('.btn-eliminar');
    if (btnEliminar) {
      const id = btnEliminar.getAttribute('data-id');
      eliminarGrupo(id);
    }
  });

  await cargarDatos();
}
