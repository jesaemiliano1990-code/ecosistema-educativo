// publico/js/modulos/admin-asignaturas.js
// Panel de administración de asignaturas: creación, edición y eliminación condicionada a grupos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Asignaturas', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="admin-asignaturas">
      <header class="admin-header">
        <div>
          <h1>Gestión de Asignaturas</h1>
          <p>Catálogo general de materias y niveles educativos del ecosistema</p>
        </div>
        <div class="admin-header__acciones">
          <span id="contadorAsignaturas" class="insignia insignia--info">0 asignaturas</span>
          <button type="button" class="btn btn--primario" id="btnNuevaAsignatura">
            + Nueva asignatura
          </button>
        </div>
      </header>

      <!-- Filtros y búsqueda -->
      <section class="filtros-asignaturas" aria-label="Filtros de asignaturas">
        <div class="campo">
          <label for="inputBusqueda">Buscar por nombre o descripción</label>
          <input type="search" id="inputBusqueda" placeholder="Filtrar asignaturas..." autocomplete="off">
        </div>
        <div class="campo">
          <label for="selectNivel">Filtrar por nivel</label>
          <select id="selectNivel">
            <option value="todos">Todos los niveles</option>
            <option value="Básica">Básica</option>
            <option value="Básica Elemental">Básica Elemental</option>
            <option value="Básica Media">Básica Media</option>
            <option value="Básica Superior">Básica Superior</option>
            <option value="Bachillerato">Bachillerato</option>
          </select>
        </div>
      </section>

      <!-- Cuadrícula de tarjetas -->
      <section id="contenedorTarjetas" class="grid-asignaturas" aria-label="Listado de asignaturas">
        <div class="vacio">
          <div class="vacio__icono">📚</div>
          <h2 class="vacio__titulo">Cargando asignaturas...</h2>
        </div>
      </section>
    </div>
  `;

  let listaAsignaturas = [];
  let listaDistributivo = [];
  let filtroTexto = '';
  let filtroNivel = 'todos';

  const contenedorTarjetas = document.getElementById('contenedorTarjetas');
  const contadorAsignaturas = document.getElementById('contadorAsignaturas');
  const inputBusqueda = document.getElementById('inputBusqueda');
  const selectNivel = document.getElementById('selectNivel');
  const btnNueva = document.getElementById('btnNuevaAsignatura');

  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [asigs, dist] = await Promise.all([
        api.listar('asignaturas'),
        api.listar('distributivo')
      ]);
      listaAsignaturas = Array.isArray(asigs) ? asigs : [];
      listaDistributivo = Array.isArray(dist) ? dist : [];
      renderizar();
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar las asignaturas.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function contarGrupos(asignaturaId) {
    return listaDistributivo.filter(d => d && d.asignaturaId === asignaturaId).length;
  }

  function renderizar() {
    const q = filtroTexto.trim().toLowerCase();

    const filtradas = listaAsignaturas.filter(a => {
      if (!a) return false;
      const nivelCoincide = filtroNivel === 'todos' || a.nivel === filtroNivel;
      if (!nivelCoincide) return false;

      if (!q) return true;
      const nom = (a.nombre || '').toLowerCase();
      const desc = (a.descripcion || '').toLowerCase();
      return nom.includes(q) || desc.includes(q);
    });

    contadorAsignaturas.textContent = `${filtradas.length} asignatura${filtradas.length === 1 ? '' : 's'}`;

    if (filtradas.length === 0) {
      contenedorTarjetas.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1;">
          <div class="vacio__icono">🔍</div>
          <h2 class="vacio__titulo">No se encontraron asignaturas</h2>
          <p class="vacio__texto">Intenta ajustar los criterios de búsqueda o crea una nueva asignatura con el botón superior.</p>
        </div>
      `;
      return;
    }

    contenedorTarjetas.innerHTML = filtradas.map(a => {
      const grupos = contarGrupos(a.id);
      const tieneGrupos = grupos > 0;
      const descHtml = a.descripcion
        ? `<p class="tarjeta-asignatura__desc">${ui.escapar(a.descripcion)}</p>`
        : `<p class="tarjeta-asignatura__desc tarjeta-asignatura__desc--vacia">Sin descripción registrada</p>`;

      return `
        <article class="tarjeta tarjeta-asignatura" data-id="${ui.escapar(a.id)}">
          <div class="tarjeta-asignatura__top">
            <h2 class="tarjeta-asignatura__titulo">${ui.escapar(a.nombre || 'Sin nombre')}</h2>
            <span class="insignia insignia--acento">${ui.escapar(a.nivel || 'Nivel no definido')}</span>
          </div>

          ${descHtml}

          <div class="tarjeta-asignatura__meta">
            <span>📚 ${grupos} grupo${grupos === 1 ? '' : 's'} en distributivo</span>
          </div>

          <div class="tarjeta-asignatura__pie">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(a.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(a.id)}"
              ${tieneGrupos ? 'title="No se puede eliminar: tiene grupos asignados"' : ''}>
              Eliminar
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  async function abrirModalAsignatura(asig = null) {
    const form = document.createElement('form');
    form.className = 'modal-form-asig';
    form.innerHTML = `
      <div class="campo">
        <label for="inputAsigNombre">Nombre de la asignatura *</label>
        <input type="text" id="inputAsigNombre" required placeholder="Ej. Biología, Matemáticas..." value="${ui.escapar(asig?.nombre || '')}">
      </div>
      <div class="campo">
        <label for="selectAsigNivel">Nivel educativo *</label>
        <select id="selectAsigNivel" required>
          <option value="">Selecciona un nivel...</option>
          <option value="Básica"${asig?.nivel === 'Básica' ? ' selected' : ''}>Básica</option>
          <option value="Básica Elemental"${asig?.nivel === 'Básica Elemental' ? ' selected' : ''}>Básica Elemental</option>
          <option value="Básica Media"${asig?.nivel === 'Básica Media' ? ' selected' : ''}>Básica Media</option>
          <option value="Básica Superior"${asig?.nivel === 'Básica Superior' ? ' selected' : ''}>Básica Superior</option>
          <option value="Bachillerato"${asig?.nivel === 'Bachillerato' ? ' selected' : ''}>Bachillerato</option>
        </select>
      </div>
      <div class="campo">
        <label for="textareaAsigDesc">Descripción</label>
        <textarea id="textareaAsigDesc" rows="3" placeholder="Descripción y objetivos de la materia...">${ui.escapar(asig?.descripcion || '')}</textarea>
      </div>
    `;

    const inputNombre = form.querySelector('#inputAsigNombre');
    const selectNivel = form.querySelector('#selectAsigNivel');
    const textareaDesc = form.querySelector('#textareaAsigDesc');

    let valores = {
      nombre: asig?.nombre || '',
      nivel: asig?.nivel || '',
      descripcion: asig?.descripcion || ''
    };

    inputNombre.addEventListener('input', () => { valores.nombre = inputNombre.value; });
    selectNivel.addEventListener('change', () => { valores.nivel = selectNivel.value; });
    textareaDesc.addEventListener('input', () => { valores.descripcion = textareaDesc.value; });

    const accion = await ui.modal({
      titulo: asig ? 'Editar asignatura' : 'Nueva asignatura',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: asig ? 'Guardar cambios' : 'Crear asignatura', valor: 'guardar', clase: 'btn--primario' }
      ]
    });

    if (accion === 'guardar') {
      const nombre = (inputNombre.value || valores.nombre || '').trim();
      const nivel = (selectNivel.value || valores.nivel || '').trim();
      const descripcion = (textareaDesc.value || valores.descripcion || '').trim();

      if (!nombre) {
        ui.aviso('El nombre de la asignatura es obligatorio.', 'error');
        return;
      }
      if (!nivel) {
        ui.aviso('El nivel educativo es obligatorio.', 'error');
        return;
      }

      ui.cargando(true);
      try {
        if (asig && asig.id) {
          await api.actualizar('asignaturas', asig.id, { nombre, nivel, descripcion });
          ui.aviso('Asignatura actualizada con éxito.', 'exito');
        } else {
          await api.crear('asignaturas', { nombre, nivel, descripcion });
          ui.aviso('Asignatura creada con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar la asignatura.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  async function eliminarAsignatura(id) {
    const asig = listaAsignaturas.find(a => a && a.id === id);
    if (!asig) return;

    const grupos = contarGrupos(id);
    if (grupos > 0) {
      ui.aviso(`No se puede eliminar "${asig.nombre}" porque tiene ${grupos} grupo(s) asignado(s) en el distributivo.`, 'advertencia');
      return;
    }

    const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar la asignatura "${asig.nombre}"?`);
    if (!confirmado) return;

    ui.cargando(true);
    try {
      await api.eliminar('asignaturas', id);
      ui.aviso('Asignatura eliminada con éxito.', 'exito');
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al eliminar la asignatura.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Event Listeners
  btnNueva.addEventListener('click', () => abrirModalAsignatura(null));

  inputBusqueda.addEventListener('input', (e) => {
    filtroTexto = e.target.value;
    renderizar();
  });

  selectNivel.addEventListener('change', (e) => {
    filtroNivel = e.target.value;
    renderizar();
  });

  contenedorTarjetas.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = btnEditar.getAttribute('data-id');
      const asig = listaAsignaturas.find(a => a && a.id === id);
      if (asig) abrirModalAsignatura(asig);
      return;
    }

    const btnEliminar = e.target.closest('.btn-eliminar');
    if (btnEliminar) {
      const id = btnEliminar.getAttribute('data-id');
      eliminarAsignatura(id);
    }
  });

  await cargarDatos();
}
