// publico/js/modulos/mi-progreso.js
// Panel de progreso del estudiante: métricas, gráficos de evolución/actividades y temas pendientes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Mi progreso', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');

/**
 * Mapa de nombres amigables para las actividades pedagógicas
 */
const NOMBRES_ACTIVIDADES = {
  'ahorcado': 'Ahorcado',
  'pareja': 'Encuentra la pareja',
  'sopa-letras': 'Sopa de letras',
  'canciones': 'Canciones del tema',
  'quiz': 'Quiz pedagógico',
  'crucigrama': 'Crucigrama',
  'simulacion': 'Simulación'
};

/**
 * Asegura que Chart.js esté cargado desde cdnjs o ventana global
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
    script.onerror = () => reject(new Error('No se pudo cargar la librería Chart.js desde cdnjs'));
    document.head.appendChild(script);
  });
}

/**
 * Obtiene los tokens de color del documento
 * @returns {Object}
 */
function obtenerColoresTema() {
  let primario = '#002e45';
  let acento = '#ff6900';
  let secundario = '#264763';
  let exito = '#1d6540';
  let texto = '#182d3e';
  let borde = '#dfe7ec';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const estilos = getComputedStyle(document.documentElement);
    primario = estilos.getPropertyValue('--color-primario').trim() || primario;
    acento = estilos.getPropertyValue('--color-acento').trim() || acento;
    secundario = estilos.getPropertyValue('--color-secundario').trim() || secundario;
    exito = estilos.getPropertyValue('--color-exito').trim() || exito;
    texto = estilos.getPropertyValue('--color-texto').trim() || texto;
    borde = estilos.getPropertyValue('--color-borde').trim() || borde;
  }

  return { primario, acento, secundario, exito, texto, borde };
}

if (contenido) {
  contenido.innerHTML = `
    <div style="padding: var(--espacio-2xl); text-align: center; color: var(--color-texto-suave);">
      Cargando tu progreso académico...
    </div>
  `;

  try {
    const resumen = await api.llamar('GET', '/api/resumen/estudiante/yo');

    if (!resumen) {
      throw new Error('No se recibieron datos de progreso.');
    }

    const puntos = Number(resumen.puntos) || 0;
    const nivelQuiz = Number(resumen.nivelQuizMax) || 0;
    const pctTemas = Number(resumen.pctTemas) || 0;
    const promedio = typeof resumen.promedio === 'number' ? resumen.promedio : Number(resumen.promedio) || 0;
    const pendientes = Array.isArray(resumen.pendientes) ? resumen.pendientes : [];
    const evolucion = Array.isArray(resumen.evolucion) ? resumen.evolucion : [];
    const porActividad = Array.isArray(resumen.porActividad) ? resumen.porActividad : [];

    // Formatear última conexión si existe
    const ultimaConexionTexto = resumen.ultimaConexion
      ? `Última conexión: ${util.fechaRelativa(resumen.ultimaConexion) || util.fechaLarga(resumen.ultimaConexion)}`
      : 'Sesión activa';

    contenido.innerHTML = `
      <div class="progreso-contenedor">
        <!-- Encabezado de la página -->
        <header class="progreso-header">
          <div class="progreso-header__info">
            <h1>Mi Progreso Académico</h1>
            <p>Consulta tus calificaciones, nivel de aprendizaje, avance de temas y estadísticas de estudio</p>
          </div>
          <span class="chip" title="${ui.escapar(resumen.ultimaConexion || '')}">
            🟢 ${ui.escapar(ultimaConexionTexto)}
          </span>
        </header>

        <!-- 1. Tarjetas Métricas Principales -->
        <section class="metricas-grid" aria-label="Métricas principales de aprendizaje">
          <!-- Puntos -->
          <article class="tarjeta-metrica tarjeta-metrica--puntos" id="tarjetaPuntos">
            <div class="tarjeta-metrica__icono" aria-hidden="true">⭐</div>
            <div class="tarjeta-metrica__info">
              <span class="tarjeta-metrica__etiqueta">Puntos acumulados</span>
              <span class="tarjeta-metrica__valor">${puntos}</span>
              <span class="tarjeta-metrica__subtexto">En actividades y retos</span>
            </div>
          </article>

          <!-- Nivel de Quiz -->
          <article class="tarjeta-metrica tarjeta-metrica--quiz" id="tarjetaNivelQuiz">
            <div class="tarjeta-metrica__icono" aria-hidden="true">🏆</div>
            <div class="tarjeta-metrica__info">
              <span class="tarjeta-metrica__etiqueta">Nivel de Quiz</span>
              <span class="tarjeta-metrica__valor">${nivelQuiz} <small style="font-size: var(--texto-s); font-weight: normal; color: var(--color-texto-suave);">/ 5</small></span>
              <span class="tarjeta-metrica__subtexto">Nivel máximo alcanzado</span>
            </div>
          </article>

          <!-- % Temas Revisados -->
          <article class="tarjeta-metrica tarjeta-metrica--temas" id="tarjetaPctTemas">
            <div class="tarjeta-metrica__icono" aria-hidden="true">📚</div>
            <div class="tarjeta-metrica__info">
              <span class="tarjeta-metrica__etiqueta">Temas revisados</span>
              <span class="tarjeta-metrica__valor">${pctTemas}%</span>
              <span class="tarjeta-metrica__subtexto">De tus asignaturas</span>
            </div>
          </article>

          <!-- Promedio sobre 10 -->
          <article class="tarjeta-metrica tarjeta-metrica--promedio" id="tarjetaPromedio">
            <div class="tarjeta-metrica__icono" aria-hidden="true">🎯</div>
            <div class="tarjeta-metrica__info">
              <span class="tarjeta-metrica__etiqueta">Promedio general</span>
              <span class="tarjeta-metrica__valor">${promedio} <small style="font-size: var(--texto-s); font-weight: normal; color: var(--color-texto-suave);">/ 10</small></span>
              <span class="tarjeta-metrica__subtexto">Actividades evaluadas</span>
            </div>
          </article>
        </section>

        <!-- 2. Gráficos de Evolución y Rendimiento por Actividad -->
        <section class="graficos-grid" aria-label="Visualización gráfica de progreso">
          <!-- Gráfico de líneas: Evolución -->
          <div class="tarjeta-grafico" id="contenedorGraficoEvolucion">
            <div class="tarjeta-grafico__header">
              <h2>Evolución de calificaciones</h2>
              <p>Promedio obtenido semana a semana en tus actividades pedagógicas (últimas semanas)</p>
            </div>
            ${evolucion.length > 0 ? `
              <div class="tarjeta-grafico__canvas-wrapper">
                <canvas id="graficoEvolucion" aria-label="Gráfico de línea con la evolución semanal de tus notas" role="img"></canvas>
              </div>
            ` : `
              <div class="vacio" id="vacioEvolucion">
                <span class="vacio__icono" aria-hidden="true">📈</span>
                <h3 class="vacio__titulo">Sin datos de evolución</h3>
                <p class="vacio__texto">Completa actividades para registrar y visualizar tu evolución de calificaciones.</p>
              </div>
            `}
          </div>

          <!-- Gráfico de barras: Promedio por Actividad -->
          <div class="tarjeta-grafico" id="contenedorGraficoActividades">
            <div class="tarjeta-grafico__header">
              <h2>Promedio por actividad</h2>
              <p>Calificación media sobre 10 obtenida en cada juego o tipo de actividad</p>
            </div>
            ${porActividad.length > 0 ? `
              <div class="tarjeta-grafico__canvas-wrapper">
                <canvas id="graficoActividades" aria-label="Gráfico de barras con el promedio obtenido en cada actividad" role="img"></canvas>
              </div>
            ` : `
              <div class="vacio" id="vacioActividades">
                <span class="vacio__icono" aria-hidden="true">🎮</span>
                <h3 class="vacio__titulo">Sin actividades realizadas</h3>
                <p class="vacio__texto">Participa en los juegos y retos disponibles para conocer tu rendimiento por actividad.</p>
              </div>
            `}
          </div>
        </section>

        <!-- 3. Lista de Temas Pendientes de Revisión -->
        <section class="seccion-pendientes" aria-labelledby="tituloPendientes">
          <div class="seccion-pendientes__header">
            <h2 id="tituloPendientes">Temas pendientes de revisión</h2>
            ${pendientes.length > 0 ? `
              <span class="chip chip--advertencia">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}</span>
            ` : ''}
          </div>

          ${pendientes.length > 0 ? `
            <div class="lista-pendientes" role="list">
              ${pendientes.map(item => `
                <article class="item-pendiente" role="listitem">
                  <div class="item-pendiente__info">
                    <span class="item-pendiente__icono" aria-hidden="true">📖</span>
                    <h3 class="item-pendiente__titulo">${ui.escapar(item.titulo || item.temaId)}</h3>
                  </div>
                  <a href="/paginas/tema.html?temaId=${encodeURIComponent(item.temaId)}" class="btn btn--primario btn--pequeno">
                    Revisar tema →
                  </a>
                </article>
              `).join('')}
            </div>
          ` : `
            <div class="vacio" id="pendientesVacio">
              <span class="vacio__icono" aria-hidden="true">🎉</span>
              <h3 class="vacio__titulo">¡Todo al día!</h3>
              <p class="vacio__texto">Has revisado todos los temas publicados de tus asignaturas. ¡Excelente compromiso con tu aprendizaje!</p>
            </div>
          `}
        </section>
      </div>
    `;

    // Inicializar gráficos con Chart.js si hay datos
    if (evolucion.length > 0 || porActividad.length > 0) {
      try {
        const ChartCls = await asegurarChartJS();
        if (ChartCls) {
          const colores = obtenerColoresTema();
          const prefiereSinAnimacion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const animacion = prefiereSinAnimacion ? false : { duration: 600 };

          // Gráfico 1: Línea de evolución
          const canvasEvolucion = document.getElementById('graficoEvolucion');
          if (canvasEvolucion && evolucion.length > 0) {
            new ChartCls(canvasEvolucion, {
              type: 'line',
              data: {
                labels: evolucion.map(e => e.semana),
                datasets: [{
                  label: 'Promedio semanal',
                  data: evolucion.map(e => e.promedio),
                  borderColor: colores.acento,
                  backgroundColor: 'rgba(255, 105, 0, 0.12)',
                  borderWidth: 3,
                  tension: 0.35,
                  fill: true,
                  pointBackgroundColor: colores.acento,
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 2,
                  pointRadius: 5,
                  pointHoverRadius: 7
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: animacion,
                scales: {
                  y: {
                    min: 0,
                    max: 10,
                    ticks: {
                      stepSize: 2,
                      color: colores.texto,
                      font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                    },
                    grid: {
                      color: colores.borde
                    }
                  },
                  x: {
                    ticks: {
                      color: colores.texto,
                      font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                    },
                    grid: {
                      display: false
                    }
                  }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: ctx => ` Promedio: ${ctx.parsed.y} / 10`
                    }
                  }
                }
              }
            });
          }

          // Gráfico 2: Barras por actividad
          const canvasActividades = document.getElementById('graficoActividades');
          if (canvasActividades && porActividad.length > 0) {
            new ChartCls(canvasActividades, {
              type: 'bar',
              data: {
                labels: porActividad.map(a => NOMBRES_ACTIVIDADES[a.actividad] || a.actividad),
                datasets: [{
                  label: 'Promedio sobre 10',
                  data: porActividad.map(a => a.promedio),
                  backgroundColor: colores.primario,
                  borderRadius: 6,
                  borderSkipped: false
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: animacion,
                scales: {
                  y: {
                    min: 0,
                    max: 10,
                    ticks: {
                      stepSize: 2,
                      color: colores.texto,
                      font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                    },
                    grid: {
                      color: colores.borde
                    }
                  },
                  x: {
                    ticks: {
                      color: colores.texto,
                      font: { family: "'Poppins', Arial, sans-serif", size: 12 }
                    },
                    grid: {
                      display: false
                    }
                  }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: ctx => {
                        const item = porActividad[ctx.dataIndex];
                        return ` Promedio: ${ctx.parsed.y} / 10 (${item.intentos} intento${item.intentos === 1 ? '' : 's'})`;
                      }
                    }
                  }
                }
              }
            });
          }
        }
      } catch (errChart) {
        console.warn('No se pudo inicializar Chart.js:', errChart);
      }
    }
  } catch (error) {
    console.error('Error al cargar progreso del estudiante:', error);
    contenido.innerHTML = `
      <div class="vacio" role="alert">
        <span class="vacio__icono" aria-hidden="true">⚠️</span>
        <h2 class="vacio__titulo">No se pudo cargar tu progreso</h2>
        <p class="vacio__texto">${ui.escapar(error.message || 'Ocurrió un error al consultar tus datos de avance.')}</p>
        <button type="button" class="btn btn--primario" onclick="location.reload()">
          Intentar nuevamente
        </button>
      </div>
    `;
  }
}
