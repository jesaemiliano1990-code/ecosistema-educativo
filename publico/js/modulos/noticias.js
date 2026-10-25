// publico/js/modulos/noticias.js
// Catálogo de noticias para usuarios autenticados: tarjetas paginadas de 9 con filtros y estado de lectura

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Noticias', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

if (contenido) {
  contenido.innerHTML = `
    <div class="modulo-noticias">
      <header class="noticias-header">
        <div>
          <h1>Cartelera de Noticias y Novedades</h1>
          <p>Entérate de los comunicados institucionales, logros y actividades del ecosistema</p>
        </div>
        ${esDocenteOAdmin ? `
          <div>
            <a href="/paginas/editor-noticia.html" class="btn btn--primario">
              + Nueva noticia
            </a>
          </div>
        ` : ''}
      </header>

      <!-- Barra de filtros -->
      <section class="noticias-filtros-barra" aria-label="Filtros de noticias">
        <div class="campo">
          <label for="inputBuscar">Buscar noticia:</label>
          <input type="search" id="inputBuscar" placeholder="Palabra clave en título o resumen..." autocomplete="off">
        </div>

        <div class="campo">
          <label for="selectFiltroCategoria">Categoría:</label>
          <select id="selectFiltroCategoria">
            <option value="todas">Todas las categorías</option>
            <option value="Institucional">Institucional</option>
            <option value="Académica">Académica</option>
            <option value="Eventos">Eventos</option>
            <option value="Logros">Logros</option>
          </select>
        </div>

        <div class="campo">
          <label for="selectFiltroTema">Tema pedagógico:</label>
          <select id="selectFiltroTema">
            <option value="todos">Todos los temas</option>
          </select>
        </div>
      </section>

      <!-- Grilla de tarjetas paginadas -->
      <section id="contenedorNoticias" class="grid-noticias" aria-label="Listado de noticias">
        <div class="vacio" style="grid-column: 1 / -1;">
          <div class="vacio__icono">📰</div>
          <h2 class="vacio__titulo">Cargando noticias...</h2>
        </div>
      </section>

      <!-- Controles de paginación -->
      <nav id="contenedorPaginacion" class="noticias-paginacion" aria-label="Paginación de noticias" style="display: none;">
        <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaAnt" disabled>
          « Anterior
        </button>
        <span class="noticias-paginacion__info" id="textoPaginacion">Página 1 de 1</span>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaSig" disabled>
          Siguiente »
        </button>
      </nav>
    </div>
  `;

  let listaNoticias = [];
  let listaLecturas = [];
  let mapaTemas = new Map();

  let paginaActual = 1;
  const NOTICIAS_POR_PAGINA = 9;

  const inputBuscar = document.getElementById('inputBuscar');
  const selectCategoria = document.getElementById('selectFiltroCategoria');
  const selectTema = document.getElementById('selectFiltroTema');
  const contenedorNoticias = document.getElementById('contenedorNoticias');
  const contenedorPaginacion = document.getElementById('contenedorPaginacion');
  const btnAnt = document.getElementById('btnPaginaAnt');
  const btnSig = document.getElementById('btnPaginaSig');
  const textoPaginacion = document.getElementById('textoPaginacion');

  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [noticias, lecturas, temas] = await Promise.all([
        api.listar('noticias'),
        api.listar('lecturas-noticias'),
        api.listar('temas')
      ]);

      listaNoticias = Array.isArray(noticias) ? noticias : [];
      listaLecturas = Array.isArray(lecturas) ? lecturas : [];

      if (Array.isArray(temas)) {
        temas.forEach(t => {
          if (t && t.id) {
            mapaTemas.set(t.id, t.titulo);
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.titulo;
            selectTema.appendChild(opt);
          }
        });
      }

      renderizar();
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar las noticias.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function renderizar() {
    const q = inputBuscar.value.trim().toLowerCase();
    const cat = selectCategoria.value;
    const temaFiltro = selectTema.value;

    const idsLeidos = new Set(listaLecturas.map(l => l && l.noticiaId).filter(Boolean));

    // 1. Filtrar
    const filtradas = listaNoticias.filter(n => {
      if (!n) return false;

      // Filtrar por texto
      if (q) {
        const tit = (n.titulo || '').toLowerCase();
        const res = (n.resumen || '').toLowerCase();
        if (!tit.includes(q) && !res.includes(q)) return false;
      }

      // Filtrar por categoría
      if (cat !== 'todas' && n.categoria !== cat) {
        return false;
      }

      // Filtrar por tema
      if (temaFiltro !== 'todos' && n.temaId !== temaFiltro) {
        return false;
      }

      return true;
    });

    // 2. Ordenar: destacadas primero, luego por fecha de publicación (o fecha) descendente
    filtradas.sort((a, b) => {
      const destA = Boolean(a.destacada);
      const destB = Boolean(b.destacada);
      if (destA && !destB) return -1;
      if (!destA && destB) return 1;

      const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fB - fA;
    });

    // 3. Paginación de 9 en 9
    const totalPaginas = Math.ceil(filtradas.length / NOTICIAS_POR_PAGINA) || 1;
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    const inicio = (paginaActual - 1) * NOTICIAS_POR_PAGINA;
    const itemsPagina = filtradas.slice(inicio, inicio + NOTICIAS_POR_PAGINA);

    if (filtradas.length === 0) {
      contenedorNoticias.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1;">
          <div class="vacio__icono">📭</div>
          <h2 class="vacio__titulo">No se encontraron noticias</h2>
          <p class="vacio__texto">No hay comunicados que coincidan con los filtros seleccionados.</p>
        </div>
      `;
      contenedorPaginacion.style.display = 'none';
      return;
    }

    contenedorNoticias.innerHTML = itemsPagina.map(n => {
      const esLeida = idsLeidos.has(n.id);
      const esDestacada = Boolean(n.destacada);
      const esBorrador = n.estado === 'borrador';
      const fechaTxt = util.fechaRelativa(n.fechaPublicacion || n.fecha) || 'Reciente';

      let imgHtml = '';
      if (n.imagen) {
        imgHtml = `
          <div class="tarjeta-noticia__img-wrap">
            <img src="${ui.escapar(n.imagen)}" alt="${ui.escapar(n.titulo)}" class="tarjeta-noticia__img" loading="lazy">
          </div>
        `;
      }

      return `
        <article class="tarjeta-noticia ${esDestacada ? 'tarjeta-noticia--destacada' : ''}" data-id="${ui.escapar(n.id)}">
          ${imgHtml}
          <div class="tarjeta-noticia__cuerpo">
            <div class="tarjeta-noticia__meta">
              <div class="tarjeta-noticia__insignias">
                <span class="insignia insignia--info">${ui.escapar(n.categoria || 'General')}</span>
                ${!esLeida ? '<span class="insignia insignia--acento">Nuevo</span>' : ''}
                ${esDestacada ? '<span class="insignia insignia--advertencia">⭐ Destacada</span>' : ''}
                ${esBorrador ? '<span class="insignia">Borrador</span>' : ''}
              </div>
              <time datetime="${ui.escapar(n.fechaPublicacion || n.fecha || '')}">${fechaTxt}</time>
            </div>

            <h2 class="tarjeta-noticia__titulo">
              <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}">
                ${ui.escapar(n.titulo)}
              </a>
            </h2>

            <p class="tarjeta-noticia__resumen">
              ${ui.escapar(n.resumen)}
            </p>

            <div class="tarjeta-noticia__pie">
              <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">
                Leer noticia →
              </a>
              ${esDocenteOAdmin ? `
                <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno" title="Editar noticia">
                  ✏️ Editar
                </a>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Actualizar controles de paginación
    if (totalPaginas > 1) {
      contenedorPaginacion.style.display = 'flex';
      textoPaginacion.textContent = `Página ${paginaActual} de ${totalPaginas} (${filtradas.length} noticias)`;
      btnAnt.disabled = paginaActual <= 1;
      btnSig.disabled = paginaActual >= totalPaginas;
    } else {
      contenedorPaginacion.style.display = 'none';
    }
  }

  // Eventos de filtros
  inputBuscar.addEventListener('input', () => { paginaActual = 1; renderizar(); });
  selectCategoria.addEventListener('change', () => { paginaActual = 1; renderizar(); });
  selectTema.addEventListener('change', () => { paginaActual = 1; renderizar(); });

  // Paginación
  btnAnt.addEventListener('click', () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  btnSig.addEventListener('click', () => {
    paginaActual++;
    renderizar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  cargarDatos();
}
