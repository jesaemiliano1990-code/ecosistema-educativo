// publico/js/modulos/asignatura.js
// Vista detallada de una asignatura con unidades visibles y temas con estado Revisado o Pendiente

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Asignatura', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const asignaturaId = util.parametro('id');

if (!asignaturaId) {
  ui.aviso('No se especificó la asignatura.', 'error');
  if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Asignatura no especificada</h2>
        <p class="vacio__texto">Por favor selecciona una materia desde tu listado de asignaturas.</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario">Ir a Mis Asignaturas</a>
      </div>
    `;
  }
} else if (contenido) {
  contenido.innerHTML = `
    <div class="detalle-asignatura">
      <a href="/paginas/asignaturas.html" class="detalle-asignatura__volver">
        ← Volver a Mis Asignaturas
      </a>

      <!-- Tarjeta principal de la asignatura -->
      <article class="tarjeta detalle-asignatura__header-card" id="headerAsignatura">
        <div class="detalle-asignatura__top">
          <h1 class="detalle-asignatura__titulo" id="tituloAsignatura">Cargando...</h1>
          <span class="insignia insignia--acento" id="nivelAsignatura">...</span>
        </div>
        <p class="detalle-asignatura__desc" id="descAsignatura"></p>

        <!-- Barra de progreso general -->
        <div class="detalle-asignatura__progreso-bloque">
          <div class="detalle-asignatura__progreso-info">
            <span id="textoAvanceAsignatura">Calculando progreso...</span>
            <strong id="porcentajeAvanceAsignatura">0%</strong>
          </div>
          <div class="progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
            <span class="progreso__barra" id="barraAvanceAsignatura" style="width: 0%;"></span>
          </div>
        </div>
      </article>

      <!-- Lista de unidades y temas -->
      <section id="contenedorUnidades" class="lista-unidades-estudio" aria-label="Unidades y temas de aprendizaje">
        <div class="vacio">
          <div class="vacio__icono">📚</div>
          <h2 class="vacio__titulo">Cargando unidades y temas...</h2>
        </div>
      </section>
    </div>
  `;

  const tituloAsignatura = document.getElementById('tituloAsignatura');
  const nivelAsignatura = document.getElementById('nivelAsignatura');
  const descAsignatura = document.getElementById('descAsignatura');
  const textoAvance = document.getElementById('textoAvanceAsignatura');
  const porcentajeAvance = document.getElementById('porcentajeAvanceAsignatura');
  const barraAvance = document.getElementById('barraAvanceAsignatura');
  const contenedorUnidades = document.getElementById('contenedorUnidades');

  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [asignatura, avance, progreso] = await Promise.all([
        api.obtener('asignaturas', asignaturaId),
        calcularAvance(asignaturaId),
        api.listar('progreso-temas')
      ]);

      // Datos de cabecera
      tituloAsignatura.textContent = asignatura.nombre || 'Asignatura';
      nivelAsignatura.textContent = asignatura.nivel || 'General';
      descAsignatura.textContent = asignatura.descripcion || 'Sin descripción disponible.';

      // Avance
      textoAvance.textContent = `Avance: ${avance.revisados} de ${avance.total} tema${avance.total === 1 ? '' : 's'} revisados`;
      porcentajeAvance.textContent = `${avance.porcentaje}%`;
      barraAvance.style.width = `${avance.porcentaje}%`;

      // Conjunto de IDs de temas revisados por el usuario actual
      const usuario = usuarioActual();
      const revisadosSet = new Set(
        Array.isArray(progreso)
          ? progreso
              .filter(p => p && (!usuario || !p.usuarioId || p.usuarioId === usuario.id))
              .map(p => p && p.temaId)
              .filter(Boolean)
          : []
      );

      // Cargar unidades de la asignatura
      const todasUnidades = await api.listar('unidades', { asignaturaId });
      const unidadesVisibles = Array.isArray(todasUnidades)
        ? todasUnidades.filter(u => u && u.visible !== false)
        : [];

      // Ordenar unidades por campo orden
      unidadesVisibles.sort((a, b) => (a.orden || 0) - (b.orden || 0));

      if (unidadesVisibles.length === 0) {
        contenedorUnidades.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono">📖</div>
            <h2 class="vacio__titulo">Sin unidades visibles</h2>
            <p class="vacio__texto">El docente aún no ha publicado unidades para esta materia.</p>
          </div>
        `;
        return;
      }

      // Cargar temas publicados de cada unidad
      const promesasTemas = unidadesVisibles.map(u => api.listar('temas', { unidadId: u.id }));
      const resultadosTemas = await Promise.all(promesasTemas);

      contenedorUnidades.innerHTML = unidadesVisibles.map((u, idxUnidad) => {
        const temas = Array.isArray(resultadosTemas[idxUnidad])
          ? resultadosTemas[idxUnidad].filter(t => t && t.estado === 'publicado')
          : [];

        temas.sort((a, b) => (a.orden || 0) - (b.orden || 0));

        let htmlTemas = '';
        if (temas.length === 0) {
          htmlTemas = '<p class="campo__ayuda"><small>No hay temas publicados en esta unidad.</small></p>';
        } else {
          htmlTemas = temas.map((t, idxTema) => {
            const estaRevisado = revisadosSet.has(t.id);

            return `
              <article class="tema-tarjeta-estudio" data-id="${ui.escapar(t.id)}">
                <div class="tema-tarjeta-estudio__info">
                  <span class="tema-tarjeta-estudio__orden">Tema ${idxTema + 1}</span>
                  <h3 class="tema-tarjeta-estudio__titulo">${ui.escapar(t.titulo)}</h3>
                </div>

                <div class="tema-tarjeta-estudio__acciones">
                  <span class="insignia ${estaRevisado ? 'insignia--exito' : 'insignia--advertencia'}">
                    ${estaRevisado ? 'Revisado ✓' : 'Pendiente'}
                  </span>
                  <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno">
                    ${estaRevisado ? 'Repasar tema →' : 'Estudiar tema →'}
                  </a>
                </div>
              </article>
            `;
          }).join('');
        }

        return `
          <section class="tarjeta unidad-card" data-id="${ui.escapar(u.id)}">
            <div class="unidad-card__encabezado">
              <span class="insignia insignia--info">Unidad ${idxUnidad + 1}</span>
              <h2 class="unidad-card__titulo">${ui.escapar(u.titulo)}</h2>
            </div>
            <div class="temas-grid">
              ${htmlTemas}
            </div>
          </section>
        `;
      }).join('');
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar los contenidos de la asignatura.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  cargarDatos();
}
