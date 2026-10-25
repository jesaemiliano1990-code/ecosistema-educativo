// publico/js/modulos/admin-usuarios.js
// Panel de administración de usuarios: listado, filtros, cambio de rol, estado y restablecimiento de clave

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Administración de usuarios', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="admin-contenedor">
      <header class="admin-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administra los roles, cuentas activas y credenciales de acceso de la plataforma</p>
        </div>
        <div id="conteoUsuarios" class="insignia insignia--info">Cargando...</div>
      </header>

      <!-- Barra de Filtros -->
      <section class="filtros-bar" aria-label="Filtros de búsqueda">
        <div class="campo filtro-busqueda">
          <label for="inputBusqueda">Buscar por nombre, apellido o correo</label>
          <input type="search" id="inputBusqueda" placeholder="Escribe para buscar..." autocomplete="off">
        </div>

        <div class="campo filtro-rol">
          <label for="selectFiltroRol">Filtrar por rol</label>
          <select id="selectFiltroRol">
            <option value="todos">Todos los roles</option>
            <option value="estudiante">Estudiantes</option>
            <option value="docente">Docentes</option>
            <option value="admin">Administradores</option>
          </select>
        </div>
      </section>

      <!-- Tabla de Usuarios -->
      <div class="tabla-tarjeta">
        <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Listado de usuarios">
          <table class="tabla" id="tablaUsuarios">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Correo electrónico</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col" style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyUsuarios">
              <tr>
                <td colspan="5" class="tabla-vacia">Cargando registros de usuarios...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let listaUsuarios = [];
  let filtroTexto = '';
  let filtroRol = 'todos';

  const tbody = document.getElementById('tbodyUsuarios');
  const inputBusqueda = document.getElementById('inputBusqueda');
  const selectFiltroRol = document.getElementById('selectFiltroRol');
  const conteoUsuarios = document.getElementById('conteoUsuarios');

  function renderTabla() {
    const q = filtroTexto.trim().toLowerCase();

    const filtrados = listaUsuarios.filter(u => {
      if (!u) return false;
      const rolCoincide = filtroRol === 'todos' || u.rol === filtroRol;
      if (!rolCoincide) return false;

      if (!q) return true;
      const nom = (u.nombre || '').toLowerCase();
      const ape = (u.apellido || '').toLowerCase();
      const cor = (u.correo || '').toLowerCase();
      return nom.includes(q) || ape.includes(q) || cor.includes(q);
    });

    conteoUsuarios.textContent = `${filtrados.length} usuario${filtrados.length === 1 ? '' : 's'}`;

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="tabla-vacia">
            No se encontraron usuarios que coincidan con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtrados.map(u => {
      const id = ui.escapar(u.id);
      const nombreCompleto = `${ui.escapar(u.nombre || '')} ${ui.escapar(u.apellido || '')}`.trim();
      const correo = ui.escapar(u.correo || '');
      const esActivo = u.activo !== false;

      return `
        <tr data-id="${id}">
          <td>
            <div class="usuario-info">
              <span class="usuario-nombre">${nombreCompleto || 'Sin nombre'}</span>
              <span class="usuario-id">${id}</span>
            </div>
          </td>
          <td>${correo}</td>
          <td>
            <select class="select-rol-tabla" data-id="${id}" data-prev="${ui.escapar(u.rol || 'estudiante')}" aria-label="Cambiar rol para ${nombreCompleto}">
              <option value="estudiante"${u.rol === 'estudiante' ? ' selected' : ''}>Estudiante</option>
              <option value="docente"${u.rol === 'docente' ? ' selected' : ''}>Docente</option>
              <option value="admin"${u.rol === 'admin' ? ' selected' : ''}>Administrador</option>
            </select>
          </td>
          <td>
            <label class="checkbox-activo-label">
              <input type="checkbox" class="check-activo" data-id="${id}" ${esActivo ? 'checked' : ''} aria-label="Cuenta activa para ${nombreCompleto}">
              <span class="estado-texto">${esActivo ? 'Activo' : 'Inactivo'}</span>
            </label>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer" data-id="${id}" data-nombre="${nombreCompleto}">
              Restablecer clave
            </button>
          </td>
        </tr>
      `;
    }).join('\n');
  }

  // Cargar usuarios desde la API
  async function cargarUsuarios() {
    ui.cargando(true);
    try {
      listaUsuarios = await api.listar('usuarios');
      renderTabla();
    } catch (error) {
      ui.aviso(error.message || 'Error al obtener la lista de usuarios.', 'error');
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="tabla-vacia" style="color: var(--color-error);">
            Error al cargar usuarios. Intenta recargar la página.
          </td>
        </tr>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  // Escuchadores de filtros
  inputBusqueda.addEventListener('input', (e) => {
    filtroTexto = e.target.value;
    renderTabla();
  });

  selectFiltroRol.addEventListener('change', (e) => {
    filtroRol = e.target.value;
    renderTabla();
  });

  // Delegación de eventos en la tabla
  tbody.addEventListener('change', async (e) => {
    const target = e.target;

    // 1. Cambio de Rol
    if (target.classList.contains('select-rol-tabla')) {
      const id = target.getAttribute('data-id');
      const prevRol = target.getAttribute('data-prev');
      const nuevoRol = target.value;

      try {
        await api.actualizar('usuarios', id, { rol: nuevoRol });
        target.setAttribute('data-prev', nuevoRol);
        const idx = listaUsuarios.findIndex(u => u && u.id === id);
        if (idx !== -1) listaUsuarios[idx].rol = nuevoRol;
        ui.aviso('Rol de usuario actualizado con éxito.', 'exito');
      } catch (error) {
        target.value = prevRol;
        ui.aviso(error.message || 'No se pudo actualizar el rol.', 'error');
      }
    }

    // 2. Cambio de Estado Activo/Inactivo
    if (target.classList.contains('check-activo')) {
      const id = target.getAttribute('data-id');
      const nuevoActivo = target.checked;
      const spanTexto = target.closest('label')?.querySelector('.estado-texto');

      try {
        await api.actualizar('usuarios', id, { activo: nuevoActivo });
        const idx = listaUsuarios.findIndex(u => u && u.id === id);
        if (idx !== -1) listaUsuarios[idx].activo = nuevoActivo;
        if (spanTexto) spanTexto.textContent = nuevoActivo ? 'Activo' : 'Inactivo';
        ui.aviso(`Usuario ${nuevoActivo ? 'activado' : 'desactivado'} con éxito.`, 'exito');
      } catch (error) {
        target.checked = !nuevoActivo;
        if (spanTexto) spanTexto.textContent = !nuevoActivo ? 'Activo' : 'Inactivo';
        ui.aviso(error.message || 'No se pudo actualizar el estado del usuario.', 'error');
      }
    }
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-restablecer');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const nombre = btn.getAttribute('data-nombre') || 'este usuario';

    const confirmado = await ui.confirmar(`¿Estás seguro de que deseas restablecer la contraseña de ${nombre}?`);
    if (!confirmado) return;

    ui.cargando(true);
    try {
      const res = await api.llamar('POST', `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
      ui.cargando(false);

      if (!res || !res.claveTemporal) {
        throw new Error('No se recibió la clave temporal generada.');
      }

      await ui.modal({
        titulo: 'Clave temporal restablecida',
        contenido: `
          <p>Se ha generado una clave temporal para <strong>${ui.escapar(nombre)}</strong>:</p>
          <div class="clave-temporal-box">
            <code class="clave-temporal-code" id="modalClaveCode">${ui.escapar(res.claveTemporal)}</code>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnCopiarClaveTemporal">
              Copiar
            </button>
          </div>
          <p style="font-size: var(--texto-xs); color: var(--color-texto-suave);">
            Esta clave sólo se mostrará una vez. Compártela con el usuario por un canal seguro para que ingrese y cambie su contraseña.
          </p>
        `,
        acciones: [{ texto: 'Cerrar', valor: 'cerrar', primario: true }]
      });
    } catch (error) {
      ui.cargando(false);
      ui.aviso(error.message || 'Error al restablecer la contraseña.', 'error');
    }
  });

  // Listener global para el botón de copiar dentro del modal
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btnCopiarClaveTemporal') {
      const codeElem = document.getElementById('modalClaveCode');
      if (codeElem) {
        const texto = codeElem.textContent.trim();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(texto);
          } else {
            // Fallback con execCommand
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          e.target.textContent = '¡Copiado!';
          ui.aviso('Clave temporal copiada al portapapeles.', 'exito');
          setTimeout(() => {
            if (e.target) e.target.textContent = 'Copiar';
          }, 2000);
        } catch {
          ui.aviso('No se pudo copiar automáticamente. Por favor selecciónala manualmente.', 'advertencia');
        }
      }
    }
  });

  // Inicializar
  await cargarUsuarios();
}
