// publico/js/modulos/noticia.js
// Detalle de noticia con registro automático de lectura y temas vinculados

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Noticia', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

if (!noticiaId) {
  ui.aviso('No se especificó la noticia a consultar.', 'error');
  if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Noticia no encontrada</h2>
        <p class="vacio__texto">Selecciona una noticia desde la cartelera de novedades.</p>
        <a href="/paginas/noticias.html" class="btn btn--primario">Ir a Noticias</a>
      </div>
    `;
  }
} else if (contenido) {
  contenido.innerHTML = `
    <div class="detalle-noticia">
      <div class="detalle-noticia__barra">
        <a href="/paginas/noticias.html" class="detalle-noticia__volver">
          ← Volver a Noticias
        </a>
        ${esDocenteOAdmin ? `
          <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(noticiaId)}" class="btn btn--secundario btn--pequeno" id="btnEditarNoticia">
            ✏️ Editar noticia
          </a>
        ` : ''}
      </div>

      <article class="tarjeta detalle-noticia__articulo" id="articuloNoticia">
        <div class="vacio">
          <div class="vacio__icono">📰</div>
          <h2 class="vacio__titulo">Cargando noticia...</h2>
        </div>
      </article>
    </div>
  `;

  const articulo = document.getElementById('articuloNoticia');

  async function cargarNoticia() {
    ui.cargando(true);
    try {
      // 1. Obtener la noticia
      const noticia = await api.obtener('noticias', noticiaId);

      // 2. Registrar la lectura de inmediato si no existe
      // (el gancho lecturas-noticias.js rechaza duplicados con 400, que se capturan de forma silenciosa)
      api.crear('lecturas-noticias', { noticiaId }).catch(() => {});

      // 3. Si tiene tema vinculado, consultar su información
      let temaVinculado = null;
      if (noticia.temaId) {
        try {
          temaVinculado = await api.obtener('temas', noticia.temaId);
        } catch {
          temaVinculado = null;
        }
      }

      // 4. Renderizar artículo
      const fechaTxt = util.fechaLarga(noticia.fechaPublicacion || noticia.fecha) || 'Fecha no registrada';
      const esDestacada = Boolean(noticia.destacada);
      const esBorrador = noticia.estado === 'borrador';

      let imagenHtml = '';
      if (noticia.imagen) {
        imagenHtml = `
          <div class="detalle-noticia__img-wrap">
            <img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="detalle-noticia__img">
          </div>
        `;
      }

      let temaHtml = '';
      if (temaVinculado) {
        temaHtml = `
          <aside class="noticia-tema-vinculado" aria-label="Tema pedagógico relacionado">
            <div class="noticia-tema-vinculado__info">
              <span class="noticia-tema-vinculado__etiqueta">Tema relacionado</span>
              <h3 class="noticia-tema-vinculado__titulo">${ui.escapar(temaVinculado.titulo)}</h3>
            </div>
            <a href="/paginas/tema.html?id=${encodeURIComponent(temaVinculado.id)}" class="btn btn--primario btn--pequeno">
              Ver tema de estudio →
            </a>
          </aside>
        `;
      }

      const cuerpoHtml = util.formatoBasico(noticia.cuerpo || '');

      articulo.innerHTML = `
        <header class="detalle-noticia__meta">
          <div class="detalle-noticia__insignias">
            <span class="insignia insignia--info">${ui.escapar(noticia.categoria || 'General')}</span>
            ${esDestacada ? '<span class="insignia insignia--advertencia">⭐ Destacada</span>' : ''}
            ${esBorrador ? '<span class="insignia">Borrador</span>' : ''}
          </div>
          <time datetime="${ui.escapar(noticia.fechaPublicacion || noticia.fecha || '')}">${fechaTxt}</time>
        </header>

        <h1 class="detalle-noticia__titulo">${ui.escapar(noticia.titulo)}</h1>

        ${imagenHtml}

        <p class="noticia-lead">${ui.escapar(noticia.resumen)}</p>

        <div class="noticia-cuerpo">
          ${cuerpoHtml}
        </div>

        ${temaHtml}
      `;
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar la noticia.', 'error');
      articulo.innerHTML = `
        <div class="vacio">
          <div class="vacio__icono">⚠️</div>
          <h2 class="vacio__titulo">No se pudo cargar la noticia</h2>
          <p class="vacio__texto">${ui.escapar(error.message || 'La noticia solicitada no existe o no tienes permisos para verla.')}</p>
        </div>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  cargarNoticia();
}
