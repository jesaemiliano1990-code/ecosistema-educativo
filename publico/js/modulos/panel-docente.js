// publico/js/modulos/panel-docente.js
// Panel docente: seguimiento de grupos, tabla ordenable de estudiantes, alertas, gráfico por tema y exportación CSV

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Panel docente', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');

/**
 * Nombres amigables para actividades pedagógicas
 */
const NOMBRES_ACTIVIDADES = {
  'ahorcado': 'Ahorcado',
  'pareja': 'Encuentra la pareja',
  'sopa-letras': 'Sopa de letras',
  'canciones': 'Canciones del tema',
  'quiz': 'Quiz pedagógico',
  'crucigrama': 'Crucigrama',
  'simulacion': 'Simulación',
  'tema-revisado': 'Lectura de tema'
};

/**
 * Asegura la disponibilidad de Chart.js desde cdnjs o window
 * @returns {Promise<any>}
 */
async function asegurarChartJS() {
  if (typeof window === 'undefined') return null;
  if (window.Chart) return window.Chart;

  return new Promise((resolve, reject) => {
    const scriptExistente = document.querySelector('script[src*="Chart"]');
    if (scriptExistente) {
      if (window.Chart) return resolve(window.Chart);
      scriptExistente.addEventListener('load', () => resolve(window.Chart));
      scriptExistente.addEventListener('error', () => reject(new Error('Error al cargar Chart.js')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error('No se pudo cargar Chart.js desde cdnjs'));
    document.head.appendChild(script);
  });
}

/**
 * Obtiene colores corporativos del tema
 * @returns {Object}
 */
function obtenerColoresTema() {
  let primario = '#002e45';
  let acento = '#ff6900';
  let secundario = '#264763';
  let advertencia = '#cd5500';
  let borde = '#dfe7ec';
  let texto = '#182d3e';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const estilos = getComputedStyle(document.documentElement);
    primario = estilos.getPropertyValue('--color-primario').trim() || primario;
    acento = estilos.getPropertyValue('--color-acento').trim() || acento;
    secundario = estilos.getPropertyValue('--color-secundario').trim() || secundario;
    advertencia = estilos.getPropertyValue('--color-advertencia').trim() || advertencia;
    borde = estilos.getPropertyValue('--color-borde').trim() || borde;
    texto = estilos.getPropertyValue('--color-texto').trim() || texto;
  }

  return { primario, acento, secundario, advertencia, borde, texto };
}

async function iniciarPanelDocente() {
  if (!contenido) return;

  contenido.innerHTML = `
    <div style="padding: var(--espacio-2xl); text-align: center; color: var(--color-texto-suave);">
      Cargando panel docente y grupos asignados...
    </div>
  `;

  try {
    // 1. Cargar grupos del distributivo y asignaturas en paralelo
    const [grupos, asignaturas] = await Promise.all([
      api.listar('distributivo').catch(() => []),
      api.listar('asignaturas').catch(() => [])
    ]);

    const mapaAsignaturas = new Map(asignaturas.map(a => [a.id, a]));

    if (!Array.isArray(grupos) || grupos.length === 0) {
      contenido.innerHTML = `
        <div class="panel-docente-contenedor">
          <header class="panel-docente-header">
            <div class="panel-docente-header__info">
              <h1>Panel Docente</h1>
              <p>Seguimiento de rendimiento, avance académico y alertas de tus grupos</p>
            </div>
          </header>
          <div class="vacio" role="status">
            <span class="vacio__icono" aria-hidden="true">👥</span>
            <h2 class="vacio__titulo">Sin grupos asignados</h2>
            <p class="vacio__texto">Actualmente no tienes grupos asignados en el distributivo académico.</p>
          </div>
        </div>
      `;
      return;
    }

    // Determinar grupo inicial: parámetro de URL o primer grupo
    const grupoIdParam = util.parametro('grupoId');
    let grupoSeleccionadoId = (grupoIdParam && grupos.some(g => g.id === grupoIdParam))
      ? grupoIdParam
      : grupos[0].id;

    // Estructura principal del panel
    contenido.innerHTML = `
      <div class="panel-docente-contenedor">
        <!-- Encabezado con selector de grupo y botón exportar -->
        <header class="panel-docente-header">
          <div class="panel-docente-header__info">
            <h1>Panel Docente</h1>
            <p>Supervisión del rendimiento estudiantil, alertas pedagógicas y avance por tema</p>
          </div>

          <div class="panel-docente-controles">
            <div class="selector-grupo-wrapper">
              <label for="selectorGrupo">Grupo:</label>
              <select id="selectorGrupo" aria-label="Seleccionar grupo">
                ${grupos.map(g => {
                  const asig = mapaAsignaturas.get(g.asignaturaId);
                  const nombreAsig = asig?.nombre || g.asignaturaId || 'Asignatura';
                  const label = `${nombreAsig} · Paralelo ${g.paralelo || 'A'} (${g.periodo || ''})`;
                  return `<option value="${ui.escapar(g.id)}" ${g.id === grupoSeleccionadoId ? 'selected' : ''}>${ui.escapar(label)}</option>`;
                }).join('')}
              </select>
            </div>

            <button type="button" id="btnExportarCSV" class="btn btn--secundario" title="Descargar reporte en formato CSV">
              📥 Exportar CSV
            </button>
          </div>
        </header>

        <!-- Contenedor dinámico del grupo -->
        <div id="contenedorGrupo" class="pila" style="gap: var(--espacio-xl);"></div>
      </div>
    `;

    const selectorGrupo = document.getElementById('selectorGrupo');
    const btnExportarCSV = document.getElementById('btnExportarCSV');
    const contenedorGrupo = document.getElementById('contenedorGrupo');

    let datosGrupoActual = null;
    let estudiantesActuales = [];
    let columnaOrden = 'nombre';
    let direccionOrden = 'asc';
    let instanciaGraficoTema = null;

    /**
     * Carga y renderiza el resumen del grupo seleccionado
     * @param {string} grupoId
     */
    async function cargarGrupo(grupoId) {
      contenedorGrupo.innerHTML = `
        <div style="padding: var(--espacio-2xl); text-align: center; color: var(--color-texto-suave);">
          Cargando datos del grupo...
        </div>
      `;

      try {
        const resumen = await api.llamar('GET', `/api/resumen/grupo/${encodeURIComponent(grupoId)}`);
        datosGrupoActual = resumen;
        estudiantesActuales = Array.isArray(resumen?.estudiantes) ? [...resumen.estudiantes] : [];

        contenedorGrupo.innerHTML = `
          <!-- 1. Gráfico de promedio por tema -->
          <section class="seccion-grafico-tema" aria-labelledby="tituloGraficoTema">
            <div class="seccion-grafico-tema__header">
              <h2 id="tituloGraficoTema">Rendimiento promedio por tema</h2>
              <p>Calificación media sobre 10 obtenida por los estudiantes en las actividades de cada tema</p>
            </div>
            ${Array.isArray(resumen?.porTema) && resumen.porTema.length > 0 ? `
              <div class="grafico-canvas-container">
                <canvas id="graficoPromedioTema" aria-label="Gráfico de barras de promedio por tema" role="img"></canvas>
              </div>
            ` : `
              <div class="vacio">
                <span class="vacio__icono" aria-hidden="true">📊</span>
                <h3 class="vacio__titulo">Sin datos por tema</h3>
                <p class="vacio__texto">Aún no se registran actividades evaluadas en los temas de este grupo.</p>
              </div>
            `}
          </section>

          <!-- 2. Tabla de estudiantes ordenable -->
          <section class="seccion-tabla-estudiantes" aria-labelledby="tituloTablaEstudiantes">
            <div class="seccion-tabla-estudiantes__header">
              <h2 id="tituloTablaEstudiantes">Estudiantes del grupo (${estudiantesActuales.length})</h2>
              <p class="texto-suave" style="font-size: var(--texto-xs); margin: 0;">
                Haz clic en cualquier encabezado para ordenar o en un estudiante para ver su detalle
              </p>
            </div>

            <div class="tabla-wrapper">
              <table class="tabla-estudiantes" aria-label="Lista de estudiantes y rendimiento">
                <thead>
                  <tr>
                    <th class="ordenable" data-col="nombre" scope="col" tabindex="0">
                      Estudiante <span class="icono-orden" id="icono-nombre">↕</span>
                    </th>
                    <th class="ordenable" data-col="promedio" scope="col" tabindex="0" style="text-align: right;">
                      Promedio (/10) <span class="icono-orden" id="icono-promedio">↕</span>
                    </th>
                    <th class="ordenable" data-col="actividades" scope="col" tabindex="0" style="text-align: right;">
                      Actividades <span class="icono-orden" id="icono-actividades">↕</span>
                    </th>
                    <th class="ordenable" data-col="pctTemas" scope="col" tabindex="0" style="text-align: right;">
                      % Temas <span class="icono-orden" id="icono-pctTemas">↕</span>
                    </th>
                    <th class="ordenable" data-col="ultimaConexion" scope="col" tabindex="0">
                      Última conexión <span class="icono-orden" id="icono-ultimaConexion">↕</span>
                    </th>
                    <th class="ordenable" data-col="alertas" scope="col" tabindex="0" style="text-align: center;">
                      Alertas <span class="icono-orden" id="icono-alertas">↕</span>
                    </th>
                  </tr>
                </thead>
                <tbody id="cuerpoTablaEstudiantes"></tbody>
              </table>
            </div>
          </section>
        `;

        // Renderizar filas de la tabla
        renderizarFilasTabla();

        // Configurar listeners de ordenamiento en los encabezados
        contenedorGrupo.querySelectorAll('th.ordenable').forEach(th => {
          const col = th.getAttribute('data-col');
          const manejarOrden = () => {
            if (columnaOrden === col) {
              direccionOrden = direccionOrden === 'asc' ? 'desc' : 'asc';
            } else {
              columnaOrden = col;
              direccionOrden = col === 'nombre' ? 'asc' : 'desc';
            }
            renderizarFilasTabla();
          };

          th.addEventListener('click', manejarOrden);
          th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              manejarOrden();
            }
          });
        });

        // Inicializar gráfico de barras por tema con Chart.js
        if (Array.isArray(resumen?.porTema) && resumen.porTema.length > 0) {
          await renderizarGraficoTema(resumen.porTema);
        }
      } catch (error) {
        console.error('Error al cargar datos del grupo:', error);
        contenedorGrupo.innerHTML = `
          <div class="vacio" role="alert">
            <span class="vacio__icono" aria-hidden="true">⚠️</span>
            <h2 class="vacio__titulo">No se pudieron cargar los datos</h2>
            <p class="vacio__texto">${ui.escapar(error.message || 'Error al obtener la información del grupo.')}</p>
          </div>
        `;
      }
    }

    /**
     * Renderiza el gráfico de barras del promedio por tema
     * @param {Array<Object>} porTema
     */
    async function renderizarGraficoTema(porTema) {
      try {
        const ChartCls = await asegurarChartJS();
        if (!ChartCls) return;

        const canvas = document.getElementById('graficoPromedioTema');
        if (!canvas) return;

        if (instanciaGraficoTema) {
          instanciaGraficoTema.destroy();
          instanciaGraficoTema = null;
        }

        const colores = obtenerColoresTema();
        const prefiereSinAnimacion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        instanciaGraficoTema = new ChartCls(canvas, {
          type: 'bar',
          data: {
            labels: porTema.map(t => t.titulo || t.temaId),
            datasets: [{
              label: 'Promedio sobre 10',
              data: porTema.map(t => t.promedio),
              backgroundColor: colores.primario,
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: prefiereSinAnimacion ? false : { duration: 600 },
            scales: {
              y: {
                min: 0,
                max: 10,
                ticks: {
                  stepSize: 2,
                  color: colores.texto,
                  font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                },
                grid: { color: colores.borde }
              },
              x: {
                ticks: {
                  color: colores.texto,
                  font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                },
                grid: { display: false }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const item = porTema[ctx.dataIndex];
                    return ` Promedio: ${ctx.parsed.y} / 10 (${item.intentos} intento${item.intentos === 1 ? '' : 's'})`;
                  }
                }
              }
            }
          }
        });
      } catch (err) {
        console.warn('Error al renderizar gráfico por tema:', err);
      }
    }

    /**
     * Ordena y dibuja las filas de la tabla de estudiantes
     */
    function renderizarFilasTabla() {
      const cuerpo = document.getElementById('cuerpoTablaEstudiantes');
      if (!cuerpo) return;

      // Actualizar indicadores visuales de ordenamiento en los th
      contenedorGrupo.querySelectorAll('th.ordenable').forEach(th => {
        const col = th.getAttribute('data-col');
        const icono = document.getElementById(`icono-${col}`);
        if (col === columnaOrden) {
          th.classList.add('th--activo');
          if (icono) icono.textContent = direccionOrden === 'asc' ? '▲' : '▼';
        } else {
          th.classList.remove('th--activo');
          if (icono) icono.textContent = '↕';
        }
      });

      // Ordenar arreglo de estudiantes
      const listaOrdenada = [...estudiantesActuales].sort((a, b) => {
        let valA, valB;

        switch (columnaOrden) {
          case 'nombre':
            valA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
            valB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
            return direccionOrden === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);

          case 'promedio':
            valA = Number(a.promedio) || 0;
            valB = Number(b.promedio) || 0;
            break;

          case 'actividades':
            valA = Number(a.actividades) || 0;
            valB = Number(b.actividades) || 0;
            break;

          case 'pctTemas':
            valA = Number(a.pctTemas) || 0;
            valB = Number(b.pctTemas) || 0;
            break;

          case 'ultimaConexion':
            valA = a.ultimaConexion ? new Date(a.ultimaConexion).getTime() : 0;
            valB = b.ultimaConexion ? new Date(b.ultimaConexion).getTime() : 0;
            break;

          case 'alertas':
            valA = Number(a.alertasActivas) || 0;
            valB = Number(b.alertasActivas) || 0;
            break;

          default:
            return 0;
        }

        return direccionOrden === 'asc' ? valA - valB : valB - valA;
      });

      if (listaOrdenada.length === 0) {
        cuerpo.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
              No hay estudiantes inscritos en este grupo.
            </td>
          </tr>
        `;
        return;
      }

      cuerpo.innerHTML = listaOrdenada.map(est => {
        const tieneAlerta = Number(est.alertasActivas) > 0;
        const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.trim() || 'Estudiante';
        const fechaTexto = est.ultimaConexion
          ? (util.fechaRelativa(est.ultimaConexion) || util.fechaLarga(est.ultimaConexion))
          : 'Nunca';

        return `
          <tr class="${tieneAlerta ? 'fila-alerta' : ''}" data-id="${ui.escapar(est.id)}" tabindex="0" role="button" aria-label="Ver progreso de ${ui.escapar(nombreCompleto)}">
            <td>
              <strong>${ui.escapar(nombreCompleto)}</strong>
              ${tieneAlerta ? ' <span title="Estudiante con alertas activas" aria-label="Alerta">⚠️</span>' : ''}
            </td>
            <td style="text-align: right; font-weight: var(--peso-negrita);">
              ${est.promedio !== null && est.promedio !== undefined ? est.promedio : 0}
            </td>
            <td style="text-align: right;">${est.actividades || 0}</td>
            <td style="text-align: right;">${est.pctTemas || 0}%</td>
            <td>${ui.escapar(fechaTexto)}</td>
            <td style="text-align: center;">
              ${tieneAlerta
                ? `<button type="button" class="chip-alerta-btn btn-alerta-chip" data-estudiante-id="${ui.escapar(est.id)}" title="Ver alertas pedagógicas de ${ui.escapar(nombreCompleto)}" aria-label="${est.alertasActivas} alertas activas">
                    <span class="chip-alerta">⚠️ ${est.alertasActivas} activa${est.alertasActivas === 1 ? '' : 's'}</span>
                   </button>`
                : `<span class="chip-sin-alerta">0</span>`}
            </td>
          </tr>
        `;
      }).join('');

      // Clic en chip de alerta para abrir modal de alertas
      cuerpo.querySelectorAll('.btn-alerta-chip').forEach(btn => {
        const estId = btn.getAttribute('data-estudiante-id');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          abrirModalAlertas(estId);
        });
      });

      // Clic en fila para abrir modal con su resumen general
      cuerpo.querySelectorAll('tr[data-id]').forEach(tr => {
        const estId = tr.getAttribute('data-id');
        const abrir = (e) => {
          if (e.target.closest('.btn-alerta-chip')) return;
          abrirModalEstudiante(estId);
        };

        tr.addEventListener('click', abrir);
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            abrir(e);
          }
        });
      });
    }

    /**
     * Abre un modal con las alertas del estudiante y acciones de apoyo pedagógico
     * @param {string} estudianteId
     */
    async function abrirModalAlertas(estudianteId) {
      ui.cargando(true);
      try {
        const estInfo = estudiantesActuales.find(e => e.id === estudianteId) || {};
        const nombreCompleto = `${estInfo.nombre || ''} ${estInfo.apellido || ''}`.trim() || 'Estudiante';

        // Consultar alertas del grupo y mensajes de apoyo
        const resAlertas = await api.llamar('GET', `/api/alertas?grupoId=${encodeURIComponent(grupoSeleccionadoId)}`);
        const todasDelGrupo = Array.isArray(resAlertas?.alertas) ? resAlertas.alertas : [];
        const mensajesApoyo = Array.isArray(resAlertas?.mensajesApoyo) ? resAlertas.mensajesApoyo : [];

        let alertasEstudiante = todasDelGrupo.filter(a => a && a.estudianteId === estudianteId && a.estado === 'activa');

        const nombresReglas = {
          'promedioBajo': '📉 Promedio bajo',
          'fallosQuiz': '🎯 Dificultad en quiz',
          'inactividad': '⏳ Inactividad prolongada',
          'vencidas': '📅 Fecha límite vencida'
        };

        const modalContenido = document.createElement('div');
        modalContenido.className = 'modal-alertas';

        function actualizarVistaAlertas() {
          modalContenido.innerHTML = `
            <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0;">
              Revisa las alertas pedagógicas activas y envía mensajes motivadores para orientar al estudiante.
            </p>

            <!-- Lista de alertas activas -->
            <div class="lista-alertas-activas">
              ${alertasEstudiante.length > 0 ? alertasEstudiante.map(alerta => `
                <article class="item-alerta-card" id="cardAlerta-${alerta.id}">
                  <div class="item-alerta-card__header">
                    <span class="item-alerta-card__regla">${ui.escapar(nombresReglas[alerta.regla] || alerta.regla)}</span>
                    <span class="item-alerta-card__fecha">📅 ${ui.escapar(util.fechaRelativa(alerta.fecha) || util.fechaLarga(alerta.fecha))}</span>
                  </div>
                  <p class="item-alerta-card__detalle">${ui.escapar(alerta.detalle || 'Alerta activa')}</p>
                  <div class="item-alerta-card__acciones">
                    <button type="button" class="btn btn--pequeno btn--secundario btn-atender" data-alerta-id="${ui.escapar(alerta.id)}">
                      ✓ Marcar como atendida
                    </button>
                  </div>
                </article>
              `).join('') : `
                <div class="vacio" style="padding: var(--espacio-m);">
                  <span class="vacio__icono">🎉</span>
                  <p class="vacio__texto">No hay alertas activas pendientes para este estudiante.</p>
                </div>
              `}
            </div>

            <!-- Sección de envío de mensaje de apoyo -->
            <div class="seccion-apoyo">
              <h4>💬 Enviar mensaje de apoyo</h4>
              <p>El mensaje se enviará directamente a las notificaciones del estudiante en tono constructivo.</p>

              <label for="selectMensajePredefinido" style="font-size: var(--texto-xs); font-weight: var(--peso-seminegrita);">Mensajes sugeridos:</label>
              <select id="selectMensajePredefinido">
                <option value="">-- Selecciona un mensaje de apoyo o escribe uno propio --</option>
                ${mensajesApoyo.map(m => `<option value="${ui.escapar(m)}">${ui.escapar(m)}</option>`).join('')}
              </select>

              <label for="textareaMensaje" style="font-size: var(--texto-xs); font-weight: var(--peso-seminegrita);">Mensaje a enviar:</label>
              <textarea id="textareaMensaje" rows="3" placeholder="Escribe aquí un mensaje motivador y de acompañamiento..."></textarea>

              <div style="display: flex; justify-content: flex-end; margin-top: var(--espacio-xs);">
                <button type="button" id="btnEnviarMensaje" class="btn btn--primario btn--pequeno">
                  📨 Enviar mensaje de apoyo
                </button>
              </div>
            </div>
          `;

          // Vincular botones de "Marcar como atendida"
          modalContenido.querySelectorAll('.btn-atender').forEach(btn => {
            btn.addEventListener('click', async () => {
              const alertaId = btn.getAttribute('data-alerta-id');
              btn.disabled = true;
              try {
                await api.actualizar('alertas', alertaId, { estado: 'atendida' });
                ui.aviso('Alerta marcada como atendida correctamente.', 'exito');

                // Actualizar lista local y conteo del estudiante
                alertasEstudiante = alertasEstudiante.filter(a => a.id !== alertaId);
                estInfo.alertasActivas = Math.max(0, (estInfo.alertasActivas || 1) - 1);
                renderizarFilasTabla();
                actualizarVistaAlertas();
              } catch (errAtender) {
                ui.aviso(errAtender.message || 'Error al actualizar alerta.', 'error');
                btn.disabled = false;
              }
            });
          });

          // Vincular select predefinido con textarea
          const selectPredefinido = modalContenido.querySelector('#selectMensajePredefinido');
          const textarea = modalContenido.querySelector('#textareaMensaje');
          const btnEnviar = modalContenido.querySelector('#btnEnviarMensaje');

          if (selectPredefinido && textarea) {
            selectPredefinido.addEventListener('change', () => {
              if (selectPredefinido.value) {
                textarea.value = selectPredefinido.value;
              }
            });
          }

          // Vincular botón enviar mensaje
          if (btnEnviar && textarea) {
            btnEnviar.addEventListener('click', async () => {
              const texto = textarea.value.trim();
              if (!texto) {
                ui.aviso('Por favor escribe o selecciona un mensaje para enviar.', 'advertencia');
                return;
              }

              btnEnviar.disabled = true;
              try {
                await api.crear('notificaciones', {
                  usuarioId: estudianteId,
                  tipo: 'apoyo',
                  mensaje: texto,
                  enlace: '/paginas/actividades.html'
                });

                ui.aviso('Mensaje de apoyo enviado con éxito al estudiante.', 'exito');
                textarea.value = '';
                if (selectPredefinido) selectPredefinido.value = '';
              } catch (errEnvio) {
                ui.aviso(errEnvio.message || 'Error al enviar la notificación.', 'error');
              } finally {
                btnEnviar.disabled = false;
              }
            });
          }
        }

        actualizarVistaAlertas();

        await ui.modal({
          titulo: `Alertas de ${nombreCompleto}`,
          contenido: modalContenido,
          acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn--secundario' }]
        });
      } catch (err) {
        ui.aviso(err.message || 'Error al cargar las alertas del estudiante.', 'error');
      } finally {
        ui.cargando(false);
      }
    }

    /**
     * Abre un modal con el resumen del estudiante y sus últimos 20 intentos
     * @param {string} estudianteId
     */
    async function abrirModalEstudiante(estudianteId) {
      ui.cargando(true);
      try {
        const estResumen = await api.llamar('GET', `/api/resumen/estudiante/${encodeURIComponent(estudianteId)}`);
        const estInfo = estudiantesActuales.find(e => e.id === estudianteId) || {};
        const nombreCompleto = `${estInfo.nombre || ''} ${estInfo.apellido || ''}`.trim() || 'Estudiante';

        const intentos = Array.isArray(estResumen.ultimosIntentos) ? estResumen.ultimosIntentos : [];

        const contenedorModal = document.createElement('div');
        contenedorModal.className = 'modal-estudiante';
        contenedorModal.innerHTML = `
          <!-- Cuadrícula de métricas del estudiante -->
          <div class="modal-estudiante__resumen-grid">
            <div class="modal-estudiante__metrica">
              <span>Puntos</span>
              <strong>⭐ ${estResumen.puntos || 0}</strong>
            </div>
            <div class="modal-estudiante__metrica">
              <span>Nivel Quiz</span>
              <strong>🏆 ${estResumen.nivelQuizMax || 0}</strong>
            </div>
            <div class="modal-estudiante__metrica">
              <span>% Temas</span>
              <strong>📚 ${estResumen.pctTemas || 0}%</strong>
            </div>
            <div class="modal-estudiante__metrica">
              <span>Promedio</span>
              <strong>🎯 ${estResumen.promedio || 0} / 10</strong>
            </div>
            <div class="modal-estudiante__metrica">
              <span>Tiempo total</span>
              <strong>⏱️ ${estResumen.tiempoMin || 0} min</strong>
            </div>
          </div>

          <!-- Tabla de últimos 20 intentos -->
          <div class="pila" style="gap: var(--espacio-xs);">
            <h4 style="margin: 0; color: var(--color-primario);">Últimos intentos registrados (${intentos.length})</h4>
            ${intentos.length > 0 ? `
              <div class="modal-estudiante__intentos-wrapper">
                <table class="tabla-intentos" aria-label="Últimos intentos del estudiante">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Actividad</th>
                      <th scope="col" style="text-align: right;">Nota</th>
                      <th scope="col" style="text-align: right;">Errores</th>
                      <th scope="col" style="text-align: right;">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${intentos.map(it => {
                      const nombreAct = NOMBRES_ACTIVIDADES[it.actividad] || it.actividad || 'Actividad';
                      const fechaIso = it.fecha ? (util.fechaRelativa(it.fecha) || util.fechaLarga(it.fecha)) : '-';
                      const nota = (it.maximo && it.maximo > 0 && typeof it.puntaje === 'number')
                        ? `${Number(((it.puntaje / it.maximo) * 10).toFixed(1))} / 10`
                        : `${it.puntaje || 0}`;

                      return `
                        <tr>
                          <td>${ui.escapar(fechaIso)}</td>
                          <td><strong>${ui.escapar(nombreAct)}</strong></td>
                          <td style="text-align: right; font-weight: var(--peso-negrita);">${ui.escapar(nota)}</td>
                          <td style="text-align: right;">${it.errores !== null && it.errores !== undefined ? it.errores : '-'}</td>
                          <td style="text-align: right; color: var(--color-acento); font-weight: var(--peso-negrita);">
                            +${it.puntos || 0}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="vacio" style="padding: var(--espacio-l);">
                <p class="vacio__texto">No se registran intentos para este estudiante.</p>
              </div>
            `}
          </div>
        `;

        await ui.modal({
          titulo: `Progreso: ${nombreCompleto}`,
          contenido: contenedorModal,
          acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn--secundario' }]
        });
      } catch (err) {
        ui.aviso(err.message || 'Error al obtener el detalle del estudiante.', 'error');
      } finally {
        ui.cargando(false);
      }
    }

    /**
     * Exporta los datos del grupo actual a un archivo CSV con separador ';' y UTF-8 BOM
     */
    function exportarCSV() {
      if (!datosGrupoActual || estudiantesActuales.length === 0) {
        ui.aviso('No hay datos disponibles para exportar en este grupo.', 'advertencia');
        return;
      }

      function escaparCSV(valor) {
        if (valor === null || valor === undefined) return '""';
        const str = String(valor).replace(/"/g, '""');
        return `"${str}"`;
      }

      const encabezados = [
        'Nombre',
        'Apellido',
        'Promedio',
        'Actividades',
        '% Temas',
        'Última conexión',
        'Alertas activas'
      ];

      const filasCSV = [encabezados.map(escaparCSV).join(';')];

      for (const est of estudiantesActuales) {
        const fechaTexto = est.ultimaConexion
          ? (util.fechaLarga(est.ultimaConexion) || est.ultimaConexion)
          : 'Nunca';

        const fila = [
          escaparCSV(est.nombre || ''),
          escaparCSV(est.apellido || ''),
          escaparCSV(est.promedio !== null && est.promedio !== undefined ? est.promedio : 0),
          escaparCSV(est.actividades || 0),
          escaparCSV(`${est.pctTemas || 0}%`),
          escaparCSV(fechaTexto),
          escaparCSV(est.alertasActivas || 0)
        ];

        filasCSV.push(fila.join(';'));
      }

      const contenidoCSV = filasCSV.join('\r\n');

      // Añadir marca de orden de bytes (BOM) UTF-8 (\uFEFF) para que Excel abra correctamente tildes y caracteres especiales
      const blob = new Blob(['\uFEFF' + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
      const enlace = document.createElement('a');
      const nombreArchivo = `resumen-grupo-${selectorGrupo.value || 'grupo'}.csv`;

      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(enlace.href);

      ui.aviso(`Reporte exportado exitosamente: ${nombreArchivo}`, 'exito');
    }

    // Eventos
    selectorGrupo.addEventListener('change', () => {
      cargarGrupo(selectorGrupo.value);
    });

    btnExportarCSV.addEventListener('click', exportarCSV);

    // Carga inicial del grupo seleccionado
    await cargarGrupo(grupoSeleccionadoId);
  } catch (error) {
    console.error('Error al inicializar panel docente:', error);
    contenido.innerHTML = `
      <div class="vacio" role="alert">
        <span class="vacio__icono" aria-hidden="true">⚠️</span>
        <h2 class="vacio__titulo">Error al cargar el panel docente</h2>
        <p class="vacio__texto">${ui.escapar(error.message || 'Ocurrió un error inesperado.')}</p>
        <button type="button" class="btn btn--primario" onclick="location.reload()">
          Intentar nuevamente
        </button>
      </div>
    `;
  }
}

await iniciarPanelDocente();
