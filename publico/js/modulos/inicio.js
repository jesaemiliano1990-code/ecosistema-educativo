// publico/js/modulos/inicio.js
// Controlador para la página principal del Ecosistema Educativo

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();

if (contenido) {
  if (!usuario) {
    // -------------------------------------------------------------
    // 1. VISTA SIN SESIÓN: Presentación breve y botones de acción
    // -------------------------------------------------------------
    contenido.innerHTML = `
      <div class="inicio-contenedor">
        <!-- Banner Héroe -->
        <section class="inicio-heroe">
          <div class="inicio-heroe__contenido">
            <span class="inicio-heroe__insignia">Plataforma Académica UNEMI</span>
            <h1 class="inicio-heroe__titulo">Bienvenido al Ecosistema Educativo</h1>
            <p class="inicio-heroe__subtitulo">
              Aprende, refuerza y domina tus asignaturas con contenidos formativos, actividades interactivas, canciones pedagógicas y seguimiento continuo de tu aprendizaje.
            </p>
            <div class="inicio-heroe__acciones">
              <a href="/paginas/ingreso.html" class="btn btn--primario inicio-heroe__btn-primario" id="btnInicioIngresar">
                🔑 Ingresar
              </a>
              <a href="/paginas/registro.html" class="btn btn--secundario inicio-heroe__btn-secundario" id="btnInicioRegistrarse">
                📝 Registrarse
              </a>
            </div>
          </div>
        </section>

        <!-- Pilares destacados de la plataforma -->
        <section class="inicio-pilares" aria-label="Características de la plataforma">
          <div class="inicio-pilar-card">
            <div class="inicio-pilar-card__icono">📚</div>
            <h2 class="inicio-pilar-card__titulo">Contenidos Curriculares</h2>
            <p class="inicio-pilar-card__texto">
              Unidades y temas organizados por competencias con objetivos claros, resúmenes interactivos, ejemplos didácticos y glosario pedagógico.
            </p>
          </div>

          <div class="inicio-pilar-card">
            <div class="inicio-pilar-card__icono">🎵</div>
            <h2 class="inicio-pilar-card__titulo">Canciones Educativas</h2>
            <p class="inicio-pilar-card__texto">
              Aprende conceptos clave a través de música con letras sincronizadas en tiempo real mediante formato LRC y reproductor integrado.
            </p>
          </div>

          <div class="inicio-pilar-card">
            <div class="inicio-pilar-card__icono">📰</div>
            <h2 class="inicio-pilar-card__titulo">Cartelera de Noticias</h2>
            <p class="inicio-pilar-card__texto">
              Mantente informado con los comunicados institucionales, novedades pedagógicas, eventos y logros de la comunidad universitaria.
            </p>
          </div>

          <div class="inicio-pilar-card">
            <div class="inicio-pilar-card__icono">📈</div>
            <h2 class="inicio-pilar-card__titulo">Avance Pedagógico</h2>
            <p class="inicio-pilar-card__texto">
              Seguimiento personalizado de tu progreso tema por tema, con la posibilidad de retomar tu sesión exactamente donde la dejaste.
            </p>
          </div>
        </section>
      </div>
    `;
  } else {
    // -------------------------------------------------------------
    // 2. VISTA CON SESIÓN: Saludo, retomar tema, avance y noticias
    // -------------------------------------------------------------
    const esDocenteOAdmin = usuario.rol === 'docente' || usuario.rol === 'admin';

    // Comprobar si existe un último tema visitado en localStorage
    let bannerRetomarHtml = '';
    try {
      const rawUltimo = localStorage.getItem('ultimoTema');
      if (rawUltimo) {
        const ultimo = JSON.parse(rawUltimo);
        if (ultimo && ultimo.id && ultimo.titulo) {
          bannerRetomarHtml = `
            <section class="inicio-retomar" role="region" aria-label="Continuar donde te quedaste">
              <div class="inicio-retomar__info">
                <div class="inicio-retomar__icono" aria-hidden="true">🚀</div>
                <div class="inicio-retomar__textos">
                  <span class="inicio-retomar__etiqueta">Continuar donde te quedaste</span>
                  <h2 class="inicio-retomar__titulo">${ui.escapar(ultimo.titulo)}</h2>
                </div>
              </div>
              <a href="/paginas/tema.html?id=${encodeURIComponent(ultimo.id)}" class="btn btn--primario">
                Continuar tema →
              </a>
            </section>
          `;
        }
      }
    } catch {
      // Ignorar error al acceder a localStorage
    }

    contenido.innerHTML = `
      <div class="inicio-contenedor">
        <!-- Saludo de bienvenida -->
        <header class="inicio-saludo">
          <div class="inicio-saludo__texto">
            <h1>¡Hola, ${ui.escapar(usuario.nombre)} ${ui.escapar(usuario.apellido)}! 👋</h1>
            <p>Bienvenido de vuelta a tu espacio pedagógico. Continúa tu formación y revisa tus materias y novedades.</p>
          </div>
          <div class="inicio-saludo__meta">
            <span class="insignia insignia--acento">${ui.escapar(usuario.rol.toUpperCase())}</span>
          </div>
        </header>

        <!-- "Continuar donde te quedaste" si existe -->
        ${bannerRetomarHtml}

        <!-- Accesos rápidos para docentes y admin -->
        ${esDocenteOAdmin ? `
          <section class="inicio-seccion" aria-label="Accesos rápidos de gestión">
            <div class="inicio-seccion__cabecera">
              <h2>⚡ Accesos Rápidos de Gestión</h2>
            </div>
            <div class="inicio-accesos-grid">
              <a href="/paginas/editor-contenidos.html" class="tarjeta-acceso-rapido">
                <div class="tarjeta-acceso-rapido__icono">📝</div>
                <div class="tarjeta-acceso-rapido__textos">
                  <span class="tarjeta-acceso-rapido__titulo">Contenidos</span>
                  <span class="tarjeta-acceso-rapido__desc">Gestiona unidades, temas y fichas</span>
                </div>
              </a>

              <a href="/paginas/noticias.html" class="tarjeta-acceso-rapido">
                <div class="tarjeta-acceso-rapido__icono">📰</div>
                <div class="tarjeta-acceso-rapido__textos">
                  <span class="tarjeta-acceso-rapido__titulo">Noticias</span>
                  <span class="tarjeta-acceso-rapido__desc">Ver cartelera y publicar novedades</span>
                </div>
              </a>

              <a href="/paginas/editor-cancion.html" class="tarjeta-acceso-rapido">
                <div class="tarjeta-acceso-rapido__icono">🎵</div>
                <div class="tarjeta-acceso-rapido__textos">
                  <span class="tarjeta-acceso-rapido__titulo">Canciones</span>
                  <span class="tarjeta-acceso-rapido__desc">Crear canciones con letras LRC</span>
                </div>
              </a>

              ${usuario.rol === 'admin' ? `
                <a href="/paginas/admin-usuarios.html" class="tarjeta-acceso-rapido">
                  <div class="tarjeta-acceso-rapido__icono">👥</div>
                  <div class="tarjeta-acceso-rapido__textos">
                    <span class="tarjeta-acceso-rapido__titulo">Usuarios</span>
                    <span class="tarjeta-acceso-rapido__desc">Administración de cuentas</span>
                  </div>
                </a>
              ` : ''}
            </div>
          </section>
        ` : ''}

        <!-- Mis Asignaturas con su avance -->
        <section class="inicio-seccion" aria-label="Mis asignaturas y avance">
          <div class="inicio-seccion__cabecera">
            <h2>📚 Mis Asignaturas</h2>
            <a href="/paginas/asignaturas.html" class="inicio-seccion__enlace-ver-mas">
              Ver todas las asignaturas →
            </a>
          </div>
          <div class="inicio-grid-asignaturas" id="gridInicioAsignaturas">
            <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
              Cargando tus asignaturas y cálculo de avance...
            </div>
          </div>
        </section>

        <!-- Últimas 3 Noticias publicadas (destacadas primero) -->
        <section class="inicio-seccion" aria-label="Noticias recientes">
          <div class="inicio-seccion__cabecera">
            <h2>📰 Noticias Recientes</h2>
            <a href="/paginas/noticias.html" class="inicio-seccion__enlace-ver-mas">
              Ir a la cartelera de noticias →
            </a>
          </div>
          <div class="inicio-grid-noticias" id="gridInicioNoticias">
            <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
              Cargando noticias recientes...
            </div>
          </div>
        </section>
      </div>
    `;

    // Cargar datos dinámicos del dashboard
    cargarDashboardConSesion();
  }
}

async function cargarDashboardConSesion() {
  const gridAsignaturas = document.getElementById('gridInicioAsignaturas');
  const gridNoticias = document.getElementById('gridInicioNoticias');

  // 1. Cargar Asignaturas y calcular avances en paralelo
  (async () => {
    try {
      const listaAsignaturas = await api.listar('asignaturas');
      const asignaturas = Array.isArray(listaAsignaturas) ? listaAsignaturas : [];

      if (asignaturas.length === 0) {
        gridAsignaturas.innerHTML = `
          <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            <p>No tienes asignaturas registradas actualmente en tu distributivo académico.</p>
          </div>
        `;
        return;
      }

      // Calcular avance de cada asignatura con calcularAvance importada
      const tarjetasHtml = await Promise.all(asignaturas.map(async (asig) => {
        let avance = { porcentaje: 0, revisados: 0, total: 0 };
        try {
          avance = await calcularAvance(asig.id);
        } catch {
          // Fallback a 0%
        }

        return `
          <article class="tarjeta-inicio-asignatura">
            <div class="tarjeta-inicio-asignatura__cabecera">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espacio-xs);">
                <h3 class="tarjeta-inicio-asignatura__titulo">${ui.escapar(asig.nombre)}</h3>
                ${asig.nivel ? `<span class="insignia insignia--secundario">${ui.escapar(asig.nivel)}</span>` : ''}
              </div>
              <p class="tarjeta-inicio-asignatura__descripcion">${ui.escapar(asig.descripcion || 'Sin descripción disponible')}</p>
            </div>

            <div class="tarjeta-inicio-asignatura__avance-box">
              <div class="tarjeta-inicio-asignatura__avance-labels">
                <span>Progreso: ${avance.revisados} de ${avance.total} tema${avance.total === 1 ? '' : 's'}</span>
                <span class="tarjeta-inicio-asignatura__avance-porcentaje">${avance.porcentaje}%</span>
              </div>
              <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                <span class="progreso__barra" style="width: ${avance.porcentaje}%;"></span>
              </div>
            </div>

            <div class="tarjeta-inicio-asignatura__pie">
              <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario btn--pequeno">
                Ver contenidos →
              </a>
            </div>
          </article>
        `;
      }));

      gridAsignaturas.innerHTML = tarjetasHtml.join('');
    } catch (error) {
      gridAsignaturas.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
          <p>No fue posible cargar tus asignaturas: ${ui.escapar(error.message)}</p>
        </div>
      `;
    }
  })();

  // 2. Cargar Noticias: las 3 más recientes (destacadas primero)
  (async () => {
    try {
      const listaNoticias = await api.listar('noticias');
      const noticias = Array.isArray(listaNoticias) ? listaNoticias : [];

      // Filtrar solo publicadas
      const publicadas = noticias.filter(n => n && n.estado === 'publicado');

      // Ordenar: destacadas primero, luego por fecha descendente
      publicadas.sort((a, b) => {
        const destA = a.destacada ? 1 : 0;
        const destB = b.destacada ? 1 : 0;
        if (destA !== destB) return destB - destA;

        const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
        const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
        return fB - fA;
      });

      // Tomar hasta 3 noticias
      const ultimas3 = publicadas.slice(0, 3);

      if (ultimas3.length === 0) {
        gridNoticias.innerHTML = `
          <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            <p>No hay noticias publicadas en este momento.</p>
          </div>
        `;
        return;
      }

      gridNoticias.innerHTML = ultimas3.map(n => {
        const fechaTexto = n.fechaPublicacion || n.fecha ? util.fechaRelativa(n.fechaPublicacion || n.fecha) : 'Reciente';

        return `
          <article class="tarjeta-inicio-noticia ${n.destacada ? 'tarjeta-inicio-noticia--destacada' : ''}">
            ${n.imagen ? `
              <div class="tarjeta-inicio-noticia__img-wrap">
                <img src="${ui.escapar(n.imagen)}" alt="${ui.escapar(n.titulo)}" class="tarjeta-inicio-noticia__img" loading="lazy">
              </div>
            ` : ''}
            <div class="tarjeta-inicio-noticia__cuerpo">
              <div class="tarjeta-inicio-noticia__tags">
                <span class="insignia insignia--info">${ui.escapar(n.categoria || 'Institucional')}</span>
                ${n.destacada ? '<span class="insignia insignia--advertencia">⭐ Destacada</span>' : ''}
              </div>
              <h3 class="tarjeta-inicio-noticia__titulo">${ui.escapar(n.titulo)}</h3>
              <p class="tarjeta-inicio-noticia__resumen">${ui.escapar(n.resumen || '')}</p>
              <div class="tarjeta-inicio-noticia__pie">
                <span>🕒 ${ui.escapar(fechaTexto)}</span>
                <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno">
                  Leer noticia →
                </a>
              </div>
            </div>
          </article>
        `;
      }).join('');
    } catch (error) {
      gridNoticias.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
          <p>No fue posible cargar las noticias: ${ui.escapar(error.message)}</p>
        </div>
      `;
    }
  })();
}
