// publico/js/modulos/editor-noticia.js
// Editor de noticias para docentes y administradores con subida de imagen y vista previa

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de Noticia', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');

if (contenido) {
  const esEdicion = Boolean(noticiaId);

  contenido.innerHTML = `
    <div class="editor-noticia">
      <!-- Barra superior de navegación y guardado -->
      <div class="editor-noticia__barra">
        <a href="/paginas/noticias.html" class="editor-noticia__volver">
          ← Volver a Noticias
        </a>
        <button type="button" id="btnGuardarNoticia" class="btn btn--primario">
          💾 ${esEdicion ? 'Guardar cambios' : 'Publicar noticia'}
        </button>
      </div>

      <header>
        <h1>${esEdicion ? 'Editar Noticia' : 'Nueva Noticia'}</h1>
        <p>Publica comunicados, logros o novedades académicas para la comunidad educativa.</p>
      </header>

      <div class="editor-noticia__grid">
        <!-- Columna 1: Formulario -->
        <form class="tarjeta editor-noticia__form" id="formNoticia" novalidate>
          <div class="campo">
            <label for="inputTitulo">Título de la noticia *</label>
            <input type="text" id="inputTitulo" required placeholder="Ej. Presentación del nuevo simulador interactivo">
          </div>

          <div class="campo">
            <label for="textareaResumen">Resumen de portada * (máx. 200 caracteres)</label>
            <textarea id="textareaResumen" rows="3" maxlength="200" required placeholder="Síntesis breve que aparecerá en la tarjeta de noticias..."></textarea>
            <div class="campo__contador-char">
              <span>Caracteres: <strong id="contadorResumen">0</strong> / 200</span>
              <span id="alertaExcesoResumen" style="color: var(--color-error); display: none;">Límite alcanzado</span>
            </div>
          </div>

          <div class="campo">
            <label for="textareaCuerpo">Cuerpo de la noticia *</label>
            <textarea id="textareaCuerpo" rows="8" required placeholder="Redacta la noticia completa. Admite saltos de párrafo, **negrita** y listas con - viñeta."></textarea>
            <small>Admite formato con <strong>**texto en negrita**</strong> y listas iniciando con <strong>- elemento</strong>.</small>
          </div>

          <!-- Imagen con subida -->
          <div class="campo">
            <label for="inputImagen">Imagen de portada</label>
            <div class="editor-noticia__subida-img">
              <input type="url" id="inputImagen" placeholder="https://... o sube una imagen">
              <button type="button" class="btn btn--secundario" id="btnSubirImagen">
                📤 Subir
              </button>
              <input type="file" id="fileImagenOculto" accept="image/*" style="display: none;">
            </div>
            <div class="editor-noticia__preview-img-box" id="boxPreviewImg" style="display: none;">
              <img id="imgThumbnail" src="" alt="Vista previa de imagen">
            </div>
          </div>

          <!-- Categoría y Tema -->
          <div class="campo">
            <label for="selectCategoria">Categoría *</label>
            <select id="selectCategoria" required>
              <option value="Institucional">Institucional</option>
              <option value="Académica">Académica</option>
              <option value="Eventos">Eventos</option>
              <option value="Logros">Logros</option>
            </select>
          </div>

          <div class="campo">
            <label for="selectTemaId">Tema pedagógico vinculado (opcional)</label>
            <select id="selectTemaId">
              <option value="">Ninguno (Noticia general)</option>
            </select>
          </div>

          <label class="campo-checkbox">
            <input type="checkbox" id="checkDestacada">
            <span><strong>⭐ Destacar noticia</strong> (se mostrará en los primeros lugares de portada)</span>
          </label>

          <div class="campo">
            <label for="selectEstado">Estado de publicación *</label>
            <select id="selectEstado" required>
              <option value="borrador">Borrador (oculta para estudiantes)</option>
              <option value="publicado" selected>Publicado (visible en cartelera)</option>
            </select>
          </div>
        </form>

        <!-- Columna 2: Vista previa interactiva en vivo -->
        <aside class="tarjeta-preview-noticia">
          <div class="tarjeta-preview-noticia__encabezado">
            <h2>Vista Previa</h2>
            <span class="insignia insignia--info">En tiempo real</span>
          </div>

          <article class="tarjeta-preview-noticia__card">
            <img id="previewCardImg" class="tarjeta-preview-noticia__img" src="" alt="" style="display: none;">
            <div class="tarjeta-preview-noticia__cuerpo">
              <div class="tarjeta-preview-noticia__meta">
                <span class="insignia insignia--acento" id="previewBadgeCategoria">Institucional</span>
                <span id="previewBadgeDestacada" class="insignia insignia--advertencia" style="display: none;">⭐ Destacada</span>
                <span id="previewFecha">Hoy</span>
              </div>
              <h3 class="tarjeta-preview-noticia__titulo" id="previewTitulo">Título de la noticia</h3>
              <p class="tarjeta-preview-noticia__resumen" id="previewResumen">Aquí se mostrará el resumen de la noticia...</p>
              
              <div class="tarjeta-preview-noticia__detalle-cuerpo" id="previewCuerpo">
                <em>Aquí se mostrará el cuerpo formateado.</em>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  `;

  // Referencias DOM
  const btnGuardar = document.getElementById('btnGuardarNoticia');
  const inputTitulo = document.getElementById('inputTitulo');
  const textareaResumen = document.getElementById('textareaResumen');
  const contadorResumen = document.getElementById('contadorResumen');
  const alertaExcesoResumen = document.getElementById('alertaExcesoResumen');
  const textareaCuerpo = document.getElementById('textareaCuerpo');
  const inputImagen = document.getElementById('inputImagen');
  const btnSubirImagen = document.getElementById('btnSubirImagen');
  const fileImagenOculto = document.getElementById('fileImagenOculto');
  const boxPreviewImg = document.getElementById('boxPreviewImg');
  const imgThumbnail = document.getElementById('imgThumbnail');
  const selectCategoria = document.getElementById('selectCategoria');
  const selectTemaId = document.getElementById('selectTemaId');
  const checkDestacada = document.getElementById('checkDestacada');
  const selectEstado = document.getElementById('selectEstado');

  // Preview DOM
  const previewCardImg = document.getElementById('previewCardImg');
  const previewBadgeCategoria = document.getElementById('previewBadgeCategoria');
  const previewBadgeDestacada = document.getElementById('previewBadgeDestacada');
  const previewTitulo = document.getElementById('previewTitulo');
  const previewResumen = document.getElementById('previewResumen');
  const previewCuerpo = document.getElementById('previewCuerpo');

  function actualizarPreview() {
    const tit = inputTitulo.value.trim() || 'Título de la noticia';
    const res = textareaResumen.value.trim() || 'Resumen de la noticia...';
    const cue = textareaCuerpo.value.trim();
    const imgUrl = inputImagen.value.trim();
    const cat = selectCategoria.value;
    const dest = checkDestacada.checked;

    previewTitulo.textContent = tit;
    previewResumen.textContent = res;
    previewBadgeCategoria.textContent = cat;

    if (dest) {
      previewBadgeDestacada.style.display = 'inline-flex';
    } else {
      previewBadgeDestacada.style.display = 'none';
    }

    if (imgUrl) {
      previewCardImg.src = imgUrl;
      previewCardImg.style.display = 'block';
      boxPreviewImg.style.display = 'flex';
      imgThumbnail.src = imgUrl;
    } else {
      previewCardImg.style.display = 'none';
      boxPreviewImg.style.display = 'none';
    }

    if (cue) {
      previewCuerpo.innerHTML = util.formatoBasico(cue);
    } else {
      previewCuerpo.innerHTML = '<em>Sin contenido en el cuerpo aún.</em>';
    }

    // Contador de caracteres en resumen
    const cantRes = textareaResumen.value.length;
    contadorResumen.textContent = cantRes;
    if (cantRes >= 200) {
      alertaExcesoResumen.style.display = 'inline';
    } else {
      alertaExcesoResumen.style.display = 'none';
    }
  }

  // Eventos de entrada para actualización en vivo
  [inputTitulo, textareaResumen, textareaCuerpo, inputImagen, selectCategoria, checkDestacada].forEach(el => {
    el.addEventListener('input', actualizarPreview);
    el.addEventListener('change', actualizarPreview);
  });

  // Subida de imagen
  btnSubirImagen.addEventListener('click', () => fileImagenOculto.click());

  fileImagenOculto.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    ui.cargando(true);
    try {
      const res = await api.subir(file);
      if (res && res.url) {
        inputImagen.value = res.url;
        actualizarPreview();
        ui.aviso('Imagen subida con éxito.', 'exito');
      } else {
        throw new Error('No se recibió la URL de la imagen.');
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al subir la imagen.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Cargar datos iniciales
  async function iniciar() {
    ui.cargando(true);
    try {
      // 1. Cargar temas disponibles para el selector
      const temas = await api.listar('temas');
      if (Array.isArray(temas)) {
        temas.forEach(t => {
          if (t && t.id && t.titulo) {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.titulo;
            selectTemaId.appendChild(opt);
          }
        });
      }

      // 2. Si estamos en modo edición, cargar la noticia
      if (esEdicion) {
        const noti = await api.obtener('noticias', noticiaId);
        inputTitulo.value = noti.titulo || '';
        textareaResumen.value = noti.resumen || '';
        textareaCuerpo.value = noti.cuerpo || '';
        inputImagen.value = noti.imagen || '';
        selectCategoria.value = noti.categoria || 'Institucional';
        selectTemaId.value = noti.temaId || '';
        checkDestacada.checked = Boolean(noti.destacada);
        selectEstado.value = noti.estado || 'publicado';
        actualizarPreview();
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar datos del editor.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Guardar noticia
  btnGuardar.addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    const resumen = textareaResumen.value.trim();
    const cuerpo = textareaCuerpo.value.trim();
    const categoria = selectCategoria.value;
    const temaId = selectTemaId.value || null;
    const destacada = checkDestacada.checked;
    const estado = selectEstado.value;
    const imagen = inputImagen.value.trim() || null;

    if (!titulo) {
      ui.aviso('El título es obligatorio.', 'error');
      inputTitulo.focus();
      return;
    }
    if (!resumen) {
      ui.aviso('El resumen es obligatorio.', 'error');
      textareaResumen.focus();
      return;
    }
    if (resumen.length > 200) {
      ui.aviso('El resumen no puede superar los 200 caracteres.', 'error');
      textareaResumen.focus();
      return;
    }
    if (!cuerpo) {
      ui.aviso('El cuerpo de la noticia es obligatorio.', 'error');
      textareaCuerpo.focus();
      return;
    }

    const payload = {
      titulo,
      resumen,
      cuerpo,
      categoria,
      temaId,
      destacada,
      estado,
      imagen
    };

    ui.cargando(true);
    try {
      if (esEdicion) {
        await api.actualizar('noticias', noticiaId, payload);
        ui.aviso('Noticia actualizada con éxito.', 'exito');
      } else {
        await api.crear('noticias', payload);
        ui.aviso('Noticia creada con éxito.', 'exito');
      }
      setTimeout(() => {
        window.location.href = '/paginas/noticias.html';
      }, 500);
    } catch (error) {
      ui.aviso(error.message || 'Error al guardar la noticia.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  iniciar();
}
