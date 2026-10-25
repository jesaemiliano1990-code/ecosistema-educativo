// publico/js/modulos/editor-contenidos.js
// Editor de contenidos pedagógicos: gestión de unidades y temas por asignatura

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Contenidos', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="editor-contenidos">
      <header class="editor-header">
        <div>
          <h1>Editor de Contenidos</h1>
          <p>Organiza las unidades y temas de aprendizaje de tus asignaturas asignadas</p>
        </div>
      </header>

      <!-- Barra de selección de asignatura -->
      <section class="editor-selector-barra" aria-label="Selección de asignatura">
        <div class="campo">
          <label for="selectAsignatura">Asignatura de trabajo:</label>
          <select id="selectAsignatura">
            <option value="">Cargando asignaturas...</option>
          </select>
        </div>
      </section>

      <!-- Grilla de Unidades y Temas -->
      <div id="contenedorPrincipal" class="editor-grid" aria-label="Contenido pedagógico">
        <div class="vacio" style="grid-column: 1 / -1;">
          <div class="vacio__icono">📚</div>
          <h2 class="vacio__titulo">Cargando unidades y temas...</h2>
        </div>
      </div>
    </div>
  `;

  let listaAsignaturas = [];
  let listaUnidades = [];
  let listaTemas = [];

  let asignaturaSeleccionadaId = util.parametro('asignaturaId') || '';
  let unidadSeleccionadaId = util.parametro('unidadId') || '';

  const selectAsignatura = document.getElementById('selectAsignatura');
  const contenedorPrincipal = document.getElementById('contenedorPrincipal');

  // Carga inicial de asignaturas permitidas
  async function iniciar() {
    ui.cargando(true);
    try {
      const asigs = await api.listar('asignaturas');
      listaAsignaturas = Array.isArray(asigs) ? asigs : [];

      if (listaAsignaturas.length === 0) {
        selectAsignatura.innerHTML = '<option value="">Sin asignaturas disponibles</option>';
        selectAsignatura.disabled = true;
        contenedorPrincipal.innerHTML = `
          <div class="vacio" style="grid-column: 1 / -1;">
            <div class="vacio__icono">⚠️</div>
            <h2 class="vacio__titulo">No tienes asignaturas asignadas</h2>
            <p class="vacio__texto">No figuras como docente en ningún grupo activo del distributivo académico. Consulta con la administración.</p>
          </div>
        `;
        return;
      }

      // Llenar selector
      selectAsignatura.innerHTML = listaAsignaturas.map(a => `
        <option value="${ui.escapar(a.id)}"${a.id === asignaturaSeleccionadaId ? ' selected' : ''}>
          ${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'General')})
        </option>
      `).join('');

      // Si no hay seleccionada o la que estaba en URL no existe, tomar la primera
      const existe = listaAsignaturas.some(a => a.id === asignaturaSeleccionadaId);
      if (!existe) {
        asignaturaSeleccionadaId = listaAsignaturas[0].id;
        selectAsignatura.value = asignaturaSeleccionadaId;
      }

      await cargarUnidades(asignaturaSeleccionadaId);
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar las asignaturas.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Cambio de asignatura seleccionada
  selectAsignatura.addEventListener('change', async (e) => {
    asignaturaSeleccionadaId = e.target.value;
    unidadSeleccionadaId = '';
    listaTemas = [];
    if (asignaturaSeleccionadaId) {
      await cargarUnidades(asignaturaSeleccionadaId);
    }
  });

  // Cargar unidades de la asignatura actual
  async function cargarUnidades(asigId, idUnidadASeleccionar = null) {
    ui.cargando(true);
    try {
      const res = await api.listar('unidades', { asignaturaId: asigId });
      listaUnidades = Array.isArray(res) ? res : [];
      // Ordenar por campo orden ascendente
      listaUnidades.sort((a, b) => (a.orden || 0) - (b.orden || 0));

      // Determinar cuál unidad queda seleccionada
      if (idUnidadASeleccionar && listaUnidades.some(u => u.id === idUnidadASeleccionar)) {
        unidadSeleccionadaId = idUnidadASeleccionar;
      } else if (unidadSeleccionadaId && listaUnidades.some(u => u.id === unidadSeleccionadaId)) {
        // Mantener la que ya estaba seleccionada
      } else if (listaUnidades.length > 0) {
        // Auto-seleccionar la primera unidad
        unidadSeleccionadaId = listaUnidades[0].id;
      } else {
        unidadSeleccionadaId = '';
      }

      renderizarEstructura();

      if (unidadSeleccionadaId) {
        await cargarTemas(unidadSeleccionadaId);
      } else {
        listaTemas = [];
        renderizarTemas();
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar unidades.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Cargar temas de la unidad seleccionada
  async function cargarTemas(uniId) {
    if (!uniId) {
      listaTemas = [];
      renderizarTemas();
      return;
    }
    ui.cargando(true);
    try {
      const res = await api.listar('temas', { unidadId: uniId });
      listaTemas = Array.isArray(res) ? res : [];
      listaTemas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      renderizarTemas();
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar temas.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Renderizar esqueleto de columnas (Unidades a la izquierda, Temas a la derecha)
  function renderizarEstructura() {
    contenedorPrincipal.innerHTML = `
      <!-- Columna 1: Unidades -->
      <section class="tarjeta columna-panel columna-unidades" aria-label="Gestión de unidades">
        <div class="columna-encabezado">
          <div class="columna-encabezado__info">
            <h2>Unidades</h2>
            <span class="insignia insignia--info" id="contadorUnidades">${listaUnidades.length}</span>
          </div>
          <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevaUnidad">
            + Nueva unidad
          </button>
        </div>
        <div id="listaUnidades" class="lista-unidades" role="list"></div>
      </section>

      <!-- Columna 2: Temas -->
      <section class="tarjeta columna-panel columna-temas" aria-label="Gestión de temas">
        <div class="columna-encabezado">
          <div class="columna-encabezado__info">
            <h2 id="tituloColumnaTemas">Temas</h2>
            <span class="insignia insignia--info" id="contadorTemas">0</span>
          </div>
          <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevoTema" ${!unidadSeleccionadaId ? 'disabled' : ''}>
            + Nuevo tema
          </button>
        </div>
        <div id="listaTemas" class="lista-temas" role="list"></div>
      </section>
    `;

    // Vincular botones globales de columna
    document.getElementById('btnNuevaUnidad')?.addEventListener('click', abrirModalCrearUnidad);
    document.getElementById('btnNuevoTema')?.addEventListener('click', abrirModalCrearTema);

    // Event delegation para la lista de unidades
    const domListaUnidades = document.getElementById('listaUnidades');
    domListaUnidades.addEventListener('click', manejarClickUnidad);

    // Event delegation para la lista de temas
    const domListaTemas = document.getElementById('listaTemas');
    domListaTemas.addEventListener('click', manejarClickTema);

    renderizarUnidades();
  }

  // Renderizar la lista de unidades
  function renderizarUnidades() {
    const domListaUnidades = document.getElementById('listaUnidades');
    const contadorUnidades = document.getElementById('contadorUnidades');
    if (!domListaUnidades) return;

    if (contadorUnidades) {
      contadorUnidades.textContent = listaUnidades.length;
    }

    if (listaUnidades.length === 0) {
      domListaUnidades.innerHTML = `
        <div class="vacio">
          <div class="vacio__icono">📖</div>
          <h3 class="vacio__titulo">Sin unidades</h3>
          <p class="vacio__texto">Aún no se han creado unidades para esta asignatura. Haz clic en "+ Nueva unidad" para comenzar.</p>
        </div>
      `;
      return;
    }

    domListaUnidades.innerHTML = listaUnidades.map((u, idx) => {
      const activa = u.id === unidadSeleccionadaId;
      const esVisible = u.visible !== false;
      const esPrimera = idx === 0;
      const esUltima = idx === listaUnidades.length - 1;

      return `
        <article class="unidad-item ${activa ? 'unidad-item--activa' : ''}" 
                 data-id="${ui.escapar(u.id)}" 
                 role="listitem"
                 tabindex="0"
                 aria-selected="${activa ? 'true' : 'false'}">
          <div class="unidad-item__cuerpo">
            <div class="unidad-item__titulo-grupo">
              <span class="unidad-item__orden">#${idx + 1}</span>
              <h3 class="unidad-item__titulo">${ui.escapar(u.titulo)}</h3>
            </div>
            <span class="insignia ${esVisible ? 'insignia--exito' : 'insignia--advertencia'}">
              ${esVisible ? 'Visible' : 'Oculta'}
            </span>
          </div>

          <div class="unidad-item__acciones">
            <!-- Botones de orden: Subir y Bajar -->
            <div class="unidad-item__orden-btns">
              <button type="button" class="btn-orden btn-subir-unidad" 
                      data-id="${ui.escapar(u.id)}" 
                      title="Subir unidad" 
                      aria-label="Subir unidad"
                      ${esPrimera ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-orden btn-bajar-unidad" 
                      data-id="${ui.escapar(u.id)}" 
                      title="Bajar unidad" 
                      aria-label="Bajar unidad"
                      ${esUltima ? 'disabled' : ''}>▼</button>
            </div>

            <!-- Controles de visibilidad, renombramiento y eliminación -->
            <div class="unidad-item__controles">
              <button type="button" class="btn btn--texto btn--pequeno btn-visibilidad-unidad" 
                      data-id="${ui.escapar(u.id)}"
                      title="${esVisible ? 'Ocultar para estudiantes' : 'Hacer visible para estudiantes'}">
                ${esVisible ? '👁️ Ocultar' : '👁️‍🗨️ Mostrar'}
              </button>
              <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-unidad" 
                      data-id="${ui.escapar(u.id)}">
                Renombrar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-unidad" 
                      data-id="${ui.escapar(u.id)}" 
                      title="Eliminar unidad">
                🗑️
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Renderizar la lista de temas
  function renderizarTemas() {
    const domListaTemas = document.getElementById('listaTemas');
    const contadorTemas = document.getElementById('contadorTemas');
    const tituloColumna = document.getElementById('tituloColumnaTemas');
    const btnNuevoTema = document.getElementById('btnNuevoTema');
    if (!domListaTemas) return;

    if (btnNuevoTema) {
      btnNuevoTema.disabled = !unidadSeleccionadaId;
    }

    if (!unidadSeleccionadaId) {
      if (tituloColumna) tituloColumna.textContent = 'Temas';
      if (contadorTemas) contadorTemas.textContent = '0';
      domListaTemas.innerHTML = `
        <div class="editor-sin-seleccion">
          <div class="editor-sin-seleccion__icono">👈</div>
          <h3>Selecciona una unidad</h3>
          <p>Haz clic en una unidad de la lista izquierda para visualizar y editar sus temas.</p>
        </div>
      `;
      return;
    }

    const unidadActual = listaUnidades.find(u => u.id === unidadSeleccionadaId);
    if (tituloColumna) {
      tituloColumna.textContent = unidadActual ? `Temas: ${unidadActual.titulo}` : 'Temas';
    }
    if (contadorTemas) {
      contadorTemas.textContent = listaTemas.length;
    }

    if (listaTemas.length === 0) {
      domListaTemas.innerHTML = `
        <div class="vacio">
          <div class="vacio__icono">📝</div>
          <h3 class="vacio__titulo">Sin temas registrados</h3>
          <p class="vacio__texto">Esta unidad aún no tiene temas. Pulsa "+ Nuevo tema" para agregar el primero en estado borrador.</p>
        </div>
      `;
      return;
    }

    domListaTemas.innerHTML = listaTemas.map((t, idx) => {
      const esPublicado = t.estado === 'publicado';
      const esPrimero = idx === 0;
      const esUltimo = idx === listaTemas.length - 1;

      return `
        <article class="tema-item" data-id="${ui.escapar(t.id)}" role="listitem">
          <div class="tema-item__cuerpo">
            <div class="tema-item__titulo-grupo">
              <span class="tema-item__orden">#${idx + 1}</span>
              <h3 class="tema-item__titulo">${ui.escapar(t.titulo)}</h3>
            </div>
            <span class="insignia ${esPublicado ? 'insignia--exito' : 'insignia--advertencia'}">
              ${esPublicado ? 'Publicado' : 'Borrador'}
            </span>
          </div>

          <div class="tema-item__acciones">
            <!-- Botones de orden: Subir y Bajar -->
            <div class="tema-item__orden-btns">
              <button type="button" class="btn-orden btn-subir-tema" 
                      data-id="${ui.escapar(t.id)}" 
                      title="Subir tema" 
                      aria-label="Subir tema"
                      ${esPrimero ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-orden btn-bajar-tema" 
                      data-id="${ui.escapar(t.id)}" 
                      title="Bajar tema" 
                      aria-label="Bajar tema"
                      ${esUltimo ? 'disabled' : ''}>▼</button>
            </div>

            <!-- Controles de estado, edición de ficha y eliminación -->
            <div class="tema-item__controles">
              <button type="button" class="btn btn--pequeno ${esPublicado ? 'btn--secundario' : 'btn--primario'} btn-estado-tema"
                      data-id="${ui.escapar(t.id)}"
                      data-estado="${esPublicado ? 'publicado' : 'borrador'}"
                      title="${esPublicado ? 'Cambiar a borrador' : 'Publicar tema para estudiantes'}">
                ${esPublicado ? 'Pasar a borrador' : 'Publicar'}
              </button>
              <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" 
                 class="btn btn--secundario btn--pequeno"
                 title="Editar objetivos, resumen, recursos y preguntas">
                ✏️ Editar ficha
              </a>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-tema" 
                      data-id="${ui.escapar(t.id)}" 
                      title="Eliminar tema">
                🗑️
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Manejador centralizado de clicks en Unidades
  async function manejarClickUnidad(e) {
    const btnSubir = e.target.closest('.btn-subir-unidad');
    const btnBajar = e.target.closest('.btn-bajar-unidad');
    const btnVisibilidad = e.target.closest('.btn-visibilidad-unidad');
    const btnRenombrar = e.target.closest('.btn-renombrar-unidad');
    const btnEliminar = e.target.closest('.btn-eliminar-unidad');

    // 1. Subir unidad
    if (btnSubir) {
      e.stopPropagation();
      await moverUnidad(btnSubir.dataset.id, 'subir');
      return;
    }

    // 2. Bajar unidad
    if (btnBajar) {
      e.stopPropagation();
      await moverUnidad(btnBajar.dataset.id, 'bajar');
      return;
    }

    // 3. Cambiar visibilidad
    if (btnVisibilidad) {
      e.stopPropagation();
      const u = listaUnidades.find(item => item.id === btnVisibilidad.dataset.id);
      if (u) await cambiarVisibilidadUnidad(u);
      return;
    }

    // 4. Renombrar unidad
    if (btnRenombrar) {
      e.stopPropagation();
      const u = listaUnidades.find(item => item.id === btnRenombrar.dataset.id);
      if (u) await abrirModalRenombrarUnidad(u);
      return;
    }

    // 5. Eliminar unidad
    if (btnEliminar) {
      e.stopPropagation();
      const u = listaUnidades.find(item => item.id === btnEliminar.dataset.id);
      if (u) await eliminarUnidad(u);
      return;
    }

    // 6. Selección de unidad
    const item = e.target.closest('.unidad-item');
    if (item && item.dataset.id) {
      if (unidadSeleccionadaId !== item.dataset.id) {
        unidadSeleccionadaId = item.dataset.id;
        renderizarUnidades();
        await cargarTemas(unidadSeleccionadaId);
      }
    }
  }

  // Manejador centralizado de clicks en Temas
  async function manejarClickTema(e) {
    const btnSubir = e.target.closest('.btn-subir-tema');
    const btnBajar = e.target.closest('.btn-bajar-tema');
    const btnEstado = e.target.closest('.btn-estado-tema');
    const btnEliminar = e.target.closest('.btn-eliminar-tema');

    // 1. Subir tema
    if (btnSubir) {
      await moverTema(btnSubir.dataset.id, 'subir');
      return;
    }

    // 2. Bajar tema
    if (btnBajar) {
      await moverTema(btnBajar.dataset.id, 'bajar');
      return;
    }

    // 3. Cambiar estado
    if (btnEstado) {
      const t = listaTemas.find(item => item.id === btnEstado.dataset.id);
      if (t) await cambiarEstadoTema(t);
      return;
    }

    // 4. Eliminar tema
    if (btnEliminar) {
      const t = listaTemas.find(item => item.id === btnEliminar.dataset.id);
      if (t) await eliminarTema(t);
      return;
    }
  }

  // Modal para agregar una nueva unidad
  async function abrirModalCrearUnidad() {
    if (!asignaturaSeleccionadaId) {
      ui.aviso('Selecciona una asignatura primero.', 'advertencia');
      return;
    }

    const form = document.createElement('form');
    form.className = 'modal-form';
    form.innerHTML = `
      <div class="campo">
        <label for="inputTituloUnidad">Título de la unidad *</label>
        <input type="text" id="inputTituloUnidad" required placeholder="Ej. Unidad 1: Fundamentos y Conceptos">
      </div>
    `;

    const input = form.querySelector('#inputTituloUnidad');

    const accion = await ui.modal({
      titulo: 'Nueva unidad de contenido',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Crear unidad', valor: 'crear', clase: 'btn--primario' }
      ]
    });

    if (accion === 'crear') {
      const titulo = input.value.trim();
      if (!titulo) {
        ui.aviso('El título de la unidad es obligatorio.', 'error');
        return;
      }

      const maxOrden = listaUnidades.reduce((max, u) => Math.max(max, u.orden || 0), 0);
      const nuevoOrden = maxOrden + 1;

      ui.cargando(true);
      try {
        const nueva = await api.crear('unidades', {
          asignaturaId: asignaturaSeleccionadaId,
          titulo,
          orden: nuevoOrden,
          visible: true
        });
        ui.aviso('Unidad creada con éxito.', 'exito');
        await cargarUnidades(asignaturaSeleccionadaId, nueva.id);
      } catch (error) {
        ui.aviso(error.message || 'Error al crear unidad.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  // Modal para renombrar una unidad
  async function abrirModalRenombrarUnidad(unidad) {
    const form = document.createElement('form');
    form.className = 'modal-form';
    form.innerHTML = `
      <div class="campo">
        <label for="inputRenombrarUnidad">Nuevo título de la unidad *</label>
        <input type="text" id="inputRenombrarUnidad" required value="${ui.escapar(unidad.titulo || '')}">
      </div>
    `;

    const input = form.querySelector('#inputRenombrarUnidad');

    const accion = await ui.modal({
      titulo: 'Renombrar unidad',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Guardar', valor: 'guardar', clase: 'btn--primario' }
      ]
    });

    if (accion === 'guardar') {
      const nuevoTitulo = input.value.trim();
      if (!nuevoTitulo) {
        ui.aviso('El título no puede quedar vacío.', 'error');
        return;
      }

      ui.cargando(true);
      try {
        await api.actualizar('unidades', unidad.id, { titulo: nuevoTitulo });
        ui.aviso('Unidad renombrada con éxito.', 'exito');
        await cargarUnidades(asignaturaSeleccionadaId, unidad.id);
      } catch (error) {
        ui.aviso(error.message || 'Error al renombrar unidad.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  // Subir / Bajar posición de una unidad (campo orden)
  async function moverUnidad(id, direccion) {
    const idx = listaUnidades.findIndex(u => u.id === id);
    if (idx === -1) return;
    const targetIdx = direccion === 'subir' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= listaUnidades.length) return;

    const actual = listaUnidades[idx];
    const vecino = listaUnidades[targetIdx];

    let ordenActual = vecino.orden ?? (targetIdx + 1);
    let ordenVecino = actual.orden ?? (idx + 1);

    if (ordenActual === ordenVecino) {
      ordenActual = targetIdx + 1;
      ordenVecino = idx + 1;
    }

    ui.cargando(true);
    try {
      await Promise.all([
        api.actualizar('unidades', actual.id, { orden: ordenActual }),
        api.actualizar('unidades', vecino.id, { orden: ordenVecino })
      ]);
      ui.aviso('Orden de unidades actualizado.', 'exito');
      await cargarUnidades(asignaturaSeleccionadaId, actual.id);
    } catch (error) {
      ui.aviso(error.message || 'Error al cambiar orden de unidad.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Ocultar / Mostrar una unidad (campo visible)
  async function cambiarVisibilidadUnidad(unidad) {
    const esVisible = unidad.visible !== false;
    const nuevoVisible = !esVisible;

    ui.cargando(true);
    try {
      await api.actualizar('unidades', unidad.id, { visible: nuevoVisible });
      ui.aviso(`Unidad ${nuevoVisible ? 'visible para estudiantes' : 'oculta para estudiantes'}.`, 'exito');
      await cargarUnidades(asignaturaSeleccionadaId, unidad.id);
    } catch (error) {
      ui.aviso(error.message || 'Error al cambiar visibilidad.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Eliminar unidad
  async function eliminarUnidad(unidad) {
    // Validar si tiene temas asociados
    const temasDeUnidad = await api.listar('temas', { unidadId: unidad.id });
    if (temasDeUnidad && temasDeUnidad.length > 0) {
      ui.aviso(`No se puede eliminar la unidad porque contiene ${temasDeUnidad.length} tema(s). Elimínalos primero.`, 'advertencia');
      return;
    }

    const seguro = await ui.confirmar(`¿Deseas eliminar la unidad "${unidad.titulo}"? Esta acción no se puede deshacer.`);
    if (!seguro) return;

    ui.cargando(true);
    try {
      await api.eliminar('unidades', unidad.id);
      ui.aviso('Unidad eliminada con éxito.', 'exito');
      if (unidadSeleccionadaId === unidad.id) {
        unidadSeleccionadaId = '';
      }
      await cargarUnidades(asignaturaSeleccionadaId);
    } catch (error) {
      ui.aviso(error.message || 'Error al eliminar unidad.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Modal para agregar un nuevo tema (solo título, estado 'borrador')
  async function abrirModalCrearTema() {
    if (!unidadSeleccionadaId) {
      ui.aviso('Selecciona una unidad primero.', 'advertencia');
      return;
    }

    const form = document.createElement('form');
    form.className = 'modal-form';
    form.innerHTML = `
      <div class="campo">
        <label for="inputTituloTema">Título del tema *</label>
        <input type="text" id="inputTituloTema" required placeholder="Ej. Leyes de Mendel y Cruzamientos">
      </div>
      <p class="campo__ayuda"><small>El tema se creará inicialmente en estado <strong>Borrador</strong>. Podrás editar su ficha pedagógica y publicarlo cuando esté listo.</small></p>
    `;

    const input = form.querySelector('#inputTituloTema');

    const accion = await ui.modal({
      titulo: 'Nuevo tema de aprendizaje',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Crear tema', valor: 'crear', clase: 'btn--primario' }
      ]
    });

    if (accion === 'crear') {
      const titulo = input.value.trim();
      if (!titulo) {
        ui.aviso('El título del tema es obligatorio.', 'error');
        return;
      }

      const maxOrden = listaTemas.reduce((max, t) => Math.max(max, t.orden || 0), 0);
      const nuevoOrden = maxOrden + 1;

      ui.cargando(true);
      try {
        await api.crear('temas', {
          unidadId: unidadSeleccionadaId,
          titulo,
          orden: nuevoOrden,
          estado: 'borrador',
          objetivos: [],
          resumen: '',
          ejemplos: [],
          erroresFrecuentes: [],
          preguntasGuia: [],
          recursos: [],
          palabrasClave: [],
          dificultad: 'media',
          fuentes: ''
        });
        ui.aviso('Tema creado con éxito en estado borrador.', 'exito');
        await cargarTemas(unidadSeleccionadaId);
      } catch (error) {
        ui.aviso(error.message || 'Error al crear tema.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  // Subir / Bajar posición de un tema (campo orden)
  async function moverTema(id, direccion) {
    const idx = listaTemas.findIndex(t => t.id === id);
    if (idx === -1) return;
    const targetIdx = direccion === 'subir' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= listaTemas.length) return;

    const actual = listaTemas[idx];
    const vecino = listaTemas[targetIdx];

    let ordenActual = vecino.orden ?? (targetIdx + 1);
    let ordenVecino = actual.orden ?? (idx + 1);

    if (ordenActual === ordenVecino) {
      ordenActual = targetIdx + 1;
      ordenVecino = idx + 1;
    }

    ui.cargando(true);
    try {
      await Promise.all([
        api.actualizar('temas', actual.id, { orden: ordenActual }),
        api.actualizar('temas', vecino.id, { orden: ordenVecino })
      ]);
      ui.aviso('Orden de temas actualizado.', 'exito');
      await cargarTemas(unidadSeleccionadaId);
    } catch (error) {
      ui.aviso(error.message || 'Error al cambiar orden de tema.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Cambiar estado de un tema (borrador <-> publicado)
  async function cambiarEstadoTema(tema) {
    const nuevoEstado = tema.estado === 'publicado' ? 'borrador' : 'publicado';

    ui.cargando(true);
    try {
      await api.actualizar('temas', tema.id, { estado: nuevoEstado });
      ui.aviso(`Tema marcado como ${nuevoEstado}.`, 'exito');
      await cargarTemas(unidadSeleccionadaId);
    } catch (error) {
      ui.aviso(error.message || 'Error al cambiar estado del tema.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Eliminar tema
  async function eliminarTema(tema) {
    const seguro = await ui.confirmar(`¿Deseas eliminar el tema "${tema.titulo}"? Esta acción no se puede deshacer.`);
    if (!seguro) return;

    ui.cargando(true);
    try {
      await api.eliminar('temas', tema.id);
      ui.aviso('Tema eliminado con éxito.', 'exito');
      await cargarTemas(unidadSeleccionadaId);
    } catch (error) {
      ui.aviso(error.message || 'Error al eliminar tema.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Iniciar la carga
  iniciar();
}
