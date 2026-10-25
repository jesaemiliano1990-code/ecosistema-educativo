// publico/js/modulos/asignaturas.js
// Vista de "Mis Asignaturas" para estudiantes y docentes con cálculo y barra de avance

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

const esPaginaAsignaturas = typeof window !== 'undefined' && window.location.pathname.includes('asignaturas.html');

if (esPaginaAsignaturas) {
  await montarPlantilla({ titulo: 'Mis asignaturas', roles: ['estudiante', 'docente'] });
}

/**
 * Calcula el avance pedagógico de una asignatura para el usuario actual:
 * % de temas publicados revisados sobre el total de temas publicados en unidades visibles.
 * @param {string} asignaturaId
 * @returns {Promise<{ porcentaje: number, revisados: number, total: number }>}
 */
export async function calcularAvance(asignaturaId) {
  if (!asignaturaId) {
    return {
      porcentaje: 0,
      revisados: 0,
      total: 0,
      valueOf() { return 0; },
      toString() { return '0'; }
    };
  }

  try {
    // 1. Obtener unidades de la asignatura (filtrar solo visibles)
    const todasUnidades = await api.listar('unidades', { asignaturaId });
    const unidadesVisibles = Array.isArray(todasUnidades)
      ? todasUnidades.filter(u => u && u.visible !== false)
      : [];

    if (unidadesVisibles.length === 0) {
      return {
        porcentaje: 0,
        revisados: 0,
        total: 0,
        valueOf() { return 0; },
        toString() { return '0'; }
      };
    }

    // 2. Obtener temas de cada unidad visible (solo publicados)
    const promesasTemas = unidadesVisibles.map(u => api.listar('temas', { unidadId: u.id }));
    const listasTemas = await Promise.all(promesasTemas);
    const temasPublicados = listasTemas
      .flat()
      .filter(t => t && t.estado === 'publicado');

    const total = temasPublicados.length;
    if (total === 0) {
      return {
        porcentaje: 0,
        revisados: 0,
        total: 0,
        valueOf() { return 0; },
        toString() { return '0'; }
      };
    }

    // 3. Obtener progreso de temas revisados del usuario actual
    const progreso = await api.listar('progreso-temas');
    const usuario = usuarioActual();
    const idsRevisados = new Set(
      Array.isArray(progreso)
        ? progreso
            .filter(p => p && (!usuario || !p.usuarioId || p.usuarioId === usuario.id))
            .map(p => p && p.temaId)
            .filter(Boolean)
        : []
    );

    const revisados = temasPublicados.filter(t => idsRevisados.has(t.id)).length;
    const porcentaje = Math.round((revisados / total) * 100);

    return {
      porcentaje,
      revisados,
      total,
      valueOf() { return this.porcentaje; },
      toString() { return String(this.porcentaje); }
    };
  } catch {
    return {
      porcentaje: 0,
      revisados: 0,
      total: 0,
      valueOf() { return 0; },
      toString() { return '0'; }
    };
  }
}

// Inicialización de la vista
const contenido = document.getElementById('contenido');
if (esPaginaAsignaturas && contenido) {
  // Comprobar si hay un último tema guardado en localStorage
  let htmlUltimoTema = '';
  try {
    const rawUltimo = localStorage.getItem('ultimoTema');
    if (rawUltimo) {
      const ultimo = JSON.parse(rawUltimo);
      if (ultimo && ultimo.id && ultimo.titulo) {
        htmlUltimoTema = `
          <div class="banner-ultimo-tema" role="region" aria-label="Continuar aprendizaje">
            <div class="banner-ultimo-tema__info">
              <span class="banner-ultimo-tema__etiqueta">Continuar donde lo dejaste</span>
              <h2 class="banner-ultimo-tema__titulo">${ui.escapar(ultimo.titulo)}</h2>
            </div>
            <a href="/paginas/tema.html?id=${encodeURIComponent(ultimo.id)}" class="btn btn--primario">
              Retomar tema →
            </a>
          </div>
        `;
      }
    }
  } catch {
    // Si localStorage está bloqueado o corrupto, se omite el banner
  }

  contenido.innerHTML = `
    <div class="mis-asignaturas">
      <header class="mis-asignaturas__header">
        <div>
          <h1>Mis Asignaturas</h1>
          <p>Explora tus materias asignadas, revisa los temas pedagógicos y sigue tu avance de aprendizaje</p>
        </div>
      </header>

      ${htmlUltimoTema}

      <section id="contenedorAsignaturas" class="grid-mis-asignaturas" aria-label="Listado de asignaturas">
        <div class="vacio" style="grid-column: 1 / -1;">
          <div class="vacio__icono">📚</div>
          <h2 class="vacio__titulo">Cargando tus asignaturas...</h2>
        </div>
      </section>
    </div>
  `;

  const contenedor = document.getElementById('contenedorAsignaturas');

  async function cargarAsignaturas() {
    ui.cargando(true);
    try {
      const asignaturas = await api.listar('asignaturas');
      const lista = Array.isArray(asignaturas) ? asignaturas : [];

      if (lista.length === 0) {
        contenedor.innerHTML = `
          <div class="vacio" style="grid-column: 1 / -1;">
            <div class="vacio__icono">📖</div>
            <h2 class="vacio__titulo">Sin asignaturas inscritas</h2>
            <p class="vacio__texto">Actualmente no estás registrado en ningún grupo activo del distributivo académico.</p>
          </div>
        `;
        return;
      }

      // Calcular avance en paralelo para cada asignatura
      const avances = await Promise.all(lista.map(a => calcularAvance(a.id)));

      contenedor.innerHTML = lista.map((a, idx) => {
        const avance = avances[idx] || { porcentaje: 0, revisados: 0, total: 0 };
        const descHtml = a.descripcion
          ? `<p class="tarjeta-mi-asignatura__desc">${ui.escapar(a.descripcion)}</p>`
          : '<p class="tarjeta-mi-asignatura__desc" style="color: var(--color-texto-suave); font-style: italic;">Sin descripción disponible.</p>';

        return `
          <article class="tarjeta tarjeta-mi-asignatura" data-id="${ui.escapar(a.id)}">
            <div>
              <div class="tarjeta-mi-asignatura__top">
                <h2 class="tarjeta-mi-asignatura__titulo">${ui.escapar(a.nombre || 'Asignatura')}</h2>
                <span class="insignia insignia--acento">${ui.escapar(a.nivel || 'General')}</span>
              </div>
              ${descHtml}
            </div>

            <!-- Avance pedagógico -->
            <div class="tarjeta-mi-asignatura__avance">
              <div class="tarjeta-mi-asignatura__avance-info">
                <span>Avance: ${avance.revisados} de ${avance.total} tema${avance.total === 1 ? '' : 's'}</span>
                <span class="tarjeta-mi-asignatura__porcentaje">${avance.porcentaje}%</span>
              </div>
              <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                <span class="progreso__barra" style="width: ${avance.porcentaje}%;"></span>
              </div>
            </div>

            <div class="tarjeta-mi-asignatura__pie">
              <a href="/paginas/asignatura.html?id=${encodeURIComponent(a.id)}" class="btn btn--primario btn--pequeno">
                Ver contenidos →
              </a>
            </div>
          </article>
        `;
      }).join('');
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar tus asignaturas.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  cargarAsignaturas();
}
