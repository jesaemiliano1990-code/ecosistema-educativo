// publico/js/nucleo/selector-tema.js
// Selector dinámico de temas para actividades pedagógicas (usa ?temaId= o modal asistido)

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Obtiene el tema para una actividad interactiva:
 * 1. Si viene ?temaId= en la URL, devuelve directamente ese tema.
 * 2. Si no, abre un modal con selectores dependientes (Asignatura → Unidad → Tema publicado).
 * @returns {Promise<Object|null>} El tema seleccionado o null si el usuario cancela
 */
export async function obtenerTemaActividad() {
  // 1. Verificar parámetro ?temaId= en la URL
  const temaIdUrl = util.parametro('temaId');
  if (temaIdUrl) {
    try {
      const tema = await api.obtener('temas', temaIdUrl);
      if (tema && tema.id) {
        return tema;
      }
    } catch (error) {
      console.warn('No se pudo cargar el tema desde la URL (?temaId=):', error);
    }
  }

  // 2. Si no hay temaId válido en la URL, abrir modal de selección
  ui.cargando(true);
  let asignaturas = [];
  let unidades = [];
  let temas = [];

  try {
    [asignaturas, unidades, temas] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);
  } catch (error) {
    ui.cargando(false);
    ui.aviso('Error al cargar catálogo pedagógico para seleccionar tema.', 'error');
    return null;
  } finally {
    ui.cargando(false);
  }

  const temasPublicados = (Array.isArray(temas) ? temas : []).filter(t => t && t.estado === 'publicado');
  const unidadesVisibles = (Array.isArray(unidades) ? unidades : []).filter(u => u && u.visible !== false);
  const listaAsignaturas = Array.isArray(asignaturas) ? asignaturas : [];

  if (temasPublicados.length === 0) {
    await ui.modal({
      titulo: 'Sin temas disponibles',
      contenido: 'No se encontraron temas publicados disponibles para realizar actividades en este momento.',
      acciones: [{ texto: 'Entendido', valor: null, clase: 'btn--primario' }]
    });
    return null;
  }

  // Indexar jerarquía
  const temasPorUnidad = new Map();
  temasPublicados.forEach(t => {
    if (!temasPorUnidad.has(t.unidadId)) {
      temasPorUnidad.set(t.unidadId, []);
    }
    temasPorUnidad.get(t.unidadId).push(t);
  });

  const unidadesPorAsignatura = new Map();
  unidadesVisibles.forEach(u => {
    // Solo unidades que tengan al menos 1 tema publicado
    if (temasPorUnidad.has(u.id)) {
      if (!unidadesPorAsignatura.has(u.asignaturaId)) {
        unidadesPorAsignatura.set(u.asignaturaId, []);
      }
      unidadesPorAsignatura.get(u.asignaturaId).push(u);
    }
  });

  // Filtrar asignaturas con contenido disponible
  const asignaturasConContenido = listaAsignaturas.filter(a => unidadesPorAsignatura.has(a.id));

  // Crear el contenedor interactivo del modal
  const contenedor = document.createElement('div');
  contenedor.className = 'selector-tema-modal pila';
  contenedor.style.display = 'flex';
  contenedor.style.flexDirection = 'column';
  contenedor.style.gap = 'var(--espacio-m)';

  contenedor.innerHTML = `
    <p style="margin: 0; color: var(--color-texto-suave);">
      Elige la asignatura, unidad y tema que deseas practicar:
    </p>

    <div class="campo">
      <label for="selAsignaturaModal">Asignatura *</label>
      <select id="selAsignaturaModal" required>
        <option value="">Selecciona una asignatura...</option>
        ${asignaturasConContenido.map(a => `<option value="${a.id}">${ui.escapar(a.nombre)}</option>`).join('')}
      </select>
    </div>

    <div class="campo">
      <label for="selUnidadModal">Unidad *</label>
      <select id="selUnidadModal" disabled required>
        <option value="">Primero selecciona una asignatura...</option>
      </select>
    </div>

    <div class="campo">
      <label for="selTemaModal">Tema pedagógico *</label>
      <select id="selTemaModal" disabled required>
        <option value="">Primero selecciona una unidad...</option>
      </select>
    </div>
  `;

  const selAsig = contenedor.querySelector('#selAsignaturaModal');
  const selUni = contenedor.querySelector('#selUnidadModal');
  const selTema = contenedor.querySelector('#selTemaModal');

  selAsig.addEventListener('change', () => {
    const asigId = selAsig.value;
    selUni.innerHTML = '<option value="">Selecciona una unidad...</option>';
    selTema.innerHTML = '<option value="">Primero selecciona una unidad...</option>';
    selTema.disabled = true;

    if (!asigId) {
      selUni.disabled = true;
      return;
    }

    const unis = unidadesPorAsignatura.get(asigId) || [];
    unis.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.titulo;
      selUni.appendChild(opt);
    });
    selUni.disabled = false;
  });

  selUni.addEventListener('change', () => {
    const uniId = selUni.value;
    selTema.innerHTML = '<option value="">Selecciona un tema...</option>';

    if (!uniId) {
      selTema.disabled = true;
      return;
    }

    const tms = temasPorUnidad.get(uniId) || [];
    tms.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selTema.appendChild(opt);
    });
    selTema.disabled = false;
  });

  // Mostrar modal con promesa
  return new Promise((resolve) => {
    ui.modal({
      titulo: 'Elegir Tema de Actividad',
      contenido: contenedor,
      acciones: [
        { texto: 'Comenzar actividad →', valor: 'aceptar', clase: 'btn--primario' },
        { texto: 'Cancelar', valor: 'cancelar', clase: 'btn--secundario' }
      ]
    }).then((accion) => {
      if (accion === 'aceptar') {
        const temaIdSeleccionado = selTema.value;
        if (!temaIdSeleccionado) {
          ui.aviso('Debes seleccionar un tema pedagógico para continuar.', 'advertencia');
          resolve(obtenerTemaActividad()); // Volver a abrir para forzar selección
          return;
        }
        const temaElegido = temasPublicados.find(t => t.id === temaIdSeleccionado);
        resolve(temaElegido || null);
      } else {
        resolve(null);
      }
    });
  });
}

export default {
  obtenerTemaActividad
};
