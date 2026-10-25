// publico/js/modulos/editor-tema.js
// Editor de ficha pedagógica y glosario de términos para un tema

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de Tema', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

if (!temaId) {
  ui.aviso('No se especificó un identificador de tema.', 'error');
  if (contenido) {
    contenido.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Tema no especificado</h2>
        <p class="vacio__texto">Debes acceder a esta página seleccionando un tema en el editor de contenidos.</p>
        <a href="/paginas/editor-contenidos.html" class="btn btn--primario">Volver al Editor de Contenidos</a>
      </div>
    `;
  }
} else if (contenido) {
  contenido.innerHTML = `
    <div class="editor-tema">
      <!-- Barra superior de navegación y acciones -->
      <div class="editor-tema__barra-superior">
        <a href="#" id="btnVolver" class="editor-tema__volver">
          ← Volver a Contenidos
        </a>
        <div class="editor-tema__acciones-principales">
          <button type="button" id="btnGuardarFicha" class="btn btn--primario">
            💾 Guardar ficha
          </button>
        </div>
      </div>

      <!-- Encabezado del tema -->
      <header class="editor-tema__encabezado">
        <div class="editor-tema__migas" id="migasTema">Cargando ubicación...</div>
        <div class="editor-tema__titulo-fila">
          <h1 id="tituloTemaPrincipal">Cargando tema...</h1>
          <span class="insignia" id="badgeEstadoTema">...</span>
          <span class="insignia insignia--info" id="badgeDificultadTema">...</span>
        </div>
      </header>

      <!-- Pestañas de sección: Ficha pedagógica y Glosario -->
      <nav class="pestanas-tema" aria-label="Secciones del tema">
        <button type="button" class="pestana-btn activa" id="tabFicha" data-panel="panelFicha">
          📋 Ficha Pedagógica
        </button>
        <button type="button" class="pestana-btn" id="tabGlosario" data-panel="panelGlosario">
          📖 Glosario de Términos (<span id="contadorPestanaGlosario">0</span>)
        </button>
      </nav>

      <!-- Panel 1: Ficha Pedagógica -->
      <section id="panelFicha" class="panel-seccion activo" aria-label="Ficha pedagógica">
        <!-- Datos generales -->
        <article class="tarjeta">
          <h2 class="tarjeta__titulo">Datos Generales</h2>
          <div class="grid-campos">
            <div class="campo">
              <label for="inputTitulo">Título del tema *</label>
              <input type="text" id="inputTitulo" required>
            </div>
            <div class="campo">
              <label for="selectEstado">Estado del tema *</label>
              <select id="selectEstado">
                <option value="borrador">Borrador (oculto a estudiantes)</option>
                <option value="publicado">Publicado (visible)</option>
              </select>
            </div>
            <div class="campo">
              <label for="selectDificultad">Nivel de dificultad *</label>
              <select id="selectDificultad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div class="campo">
              <label for="inputFuentes">Fuentes y referencias</label>
              <input type="text" id="inputFuentes" placeholder="Ej. Ministerio de Educación del Ecuador - Texto de Biología">
            </div>
          </div>
        </article>

        <!-- Resumen con contador y preview -->
        <article class="tarjeta">
          <div class="tarjeta__encabezado">
            <h2 class="tarjeta__titulo">Resumen del Contenido</h2>
            <button type="button" class="btn btn--texto btn--pequeno" id="btnTogglePreviewResumen">
              👁️ Ver formato formateado
            </button>
          </div>
          <p class="campo__ayuda"><small>Admite formato básico: párrafos separados por doble salto de línea, texto en <strong>**negrita**</strong> y viñetas iniciando la línea con <strong>- elemento</strong>.</small></p>
          <div class="campo">
            <textarea id="textareaResumen" rows="8" placeholder="Escribe el resumen conceptual del tema..."></textarea>
            <div class="contador-palabras">
              <span id="textoContadorPalabras">0 palabras</span>
              <span id="estadoContadorPalabras" class="contador-palabras__estado">Recomendado: 300 a 800 palabras</span>
            </div>
          </div>
          <div id="previewResumen" class="vista-previa-resumen" style="display: none;">
            <p><em>Aquí se mostrará la vista previa del resumen formateado.</em></p>
          </div>
        </article>

        <!-- Objetivos y Ejemplos -->
        <div class="grid-campos">
          <!-- Objetivos -->
          <article class="tarjeta">
            <h2 class="tarjeta__titulo">Objetivos de Aprendizaje</h2>
            <div class="lista-dinamica" id="contenedorObjetivos">
              <div class="lista-dinamica__items" id="listaObjetivos"></div>
              <div class="lista-dinamica__agregar">
                <input type="text" id="inputNuevoObjetivo" placeholder="Nuevo objetivo...">
                <button type="button" class="btn btn--secundario" id="btnAgregarObjetivo">+ Agregar</button>
              </div>
            </div>
          </article>

          <!-- Ejemplos -->
          <article class="tarjeta">
            <h2 class="tarjeta__titulo">Ejemplos Prácticos</h2>
            <div class="lista-dinamica" id="contenedorEjemplos">
              <div class="lista-dinamica__items" id="listaEjemplos"></div>
              <div class="lista-dinamica__agregar">
                <input type="text" id="inputNuevoEjemplo" placeholder="Nuevo ejemplo...">
                <button type="button" class="btn btn--secundario" id="btnAgregarEjemplo">+ Agregar</button>
              </div>
            </div>
          </article>
        </div>

        <!-- Errores frecuentes y Preguntas guía -->
        <div class="grid-campos">
          <!-- Errores frecuentes -->
          <article class="tarjeta">
            <h2 class="tarjeta__titulo">Errores Frecuentes</h2>
            <div class="lista-dinamica" id="contenedorErrores">
              <div class="lista-dinamica__items" id="listaErrores"></div>
              <div class="lista-dinamica__agregar">
                <input type="text" id="inputNuevoError" placeholder="Nuevo error común...">
                <button type="button" class="btn btn--secundario" id="btnAgregarError">+ Agregar</button>
              </div>
            </div>
          </article>

          <!-- Preguntas guía -->
          <article class="tarjeta">
            <h2 class="tarjeta__titulo">Preguntas Guía (Socráticas)</h2>
            <div class="lista-dinamica" id="contenedorPreguntas">
              <div class="lista-dinamica__items" id="listaPreguntas"></div>
              <div class="lista-dinamica__agregar">
                <input type="text" id="inputNuevaPregunta" placeholder="Nueva pregunta reflexiva...">
                <button type="button" class="btn btn--secundario" id="btnAgregarPregunta">+ Agregar</button>
              </div>
            </div>
          </article>
        </div>

        <!-- Recursos multimedia -->
        <article class="tarjeta">
          <div class="tarjeta__encabezado">
            <h2 class="tarjeta__titulo">Recursos Multimedia y Documentos</h2>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarRecurso">
              + Agregar recurso
            </button>
          </div>
          <div id="listaRecursos" class="lista-recursos"></div>
        </article>

        <!-- Palabras clave -->
        <article class="tarjeta">
          <h2 class="tarjeta__titulo">Palabras Clave</h2>
          <div class="campo">
            <label for="inputPalabrasClave">Términos clave separados por coma:</label>
            <input type="text" id="inputPalabrasClave" placeholder="Ej. genética, alelos, herencia, cromosoma">
            <small>Ayudan a la indexación del tema y a las actividades de búsqueda de términos.</small>
          </div>
        </article>
      </section>

      <!-- Panel 2: Glosario de Términos -->
      <section id="panelGlosario" class="panel-seccion" aria-label="Glosario del tema">
        <!-- Tarjetas de métricas -->
        <div class="glosario-metricas-barra">
          <div class="metrica-card">
            <span class="metrica-card__etiqueta">Total Términos</span>
            <span class="metrica-card__valor" id="metricaTotalTerminos">0</span>
          </div>
          <div class="metrica-card">
            <span class="metrica-card__etiqueta">De 6 letras</span>
            <span class="metrica-card__valor" id="metrica6Letras">0</span>
          </div>
          <div class="metrica-card">
            <span class="metrica-card__etiqueta">Condición de Juegos</span>
            <div id="metricaIndicadorJuegos" style="margin-top: 4px;">
              <span class="insignia">Evaluando...</span>
            </div>
          </div>
        </div>

        <!-- Controles de Glosario -->
        <div class="glosario-controles-fila">
          <h2>Términos Aprobados</h2>
          <div class="glosario-acciones">
            <button type="button" id="btn-generar-ia" class="btn btn--secundario btn--pequeno" disabled title="Disponible próximamente con IA (P07.2)">
              ✨ Generar con IA
            </button>
            <button type="button" id="btnNuevoTermino" class="btn btn--primario btn--pequeno">
              + Agregar término
            </button>
          </div>
        </div>

        <!-- Tabla de Glosario -->
        <div class="tabla">
          <table class="tabla-glosario">
            <thead>
              <tr>
                <th scope="col" style="width: 15%;">Término</th>
                <th scope="col" style="width: 35%;">Definición (máx 25 pal.)</th>
                <th scope="col" style="width: 20%;">Pista (máx 10 pal.)</th>
                <th scope="col" style="width: 20%;">Retroalimentación</th>
                <th scope="col" style="width: 10%; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoTablaGlosario">
              <tr>
                <td colspan="5" style="text-align: center; padding: var(--espacio-l);">Cargando glosario...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // Variables de estado local
  let temaActual = null;
  let unidadActual = null;
  let listaGlosario = [];
  let hayCambiosSinGuardar = false;

  // Referencias DOM
  const btnVolver = document.getElementById('btnVolver');
  const btnGuardarFicha = document.getElementById('btnGuardarFicha');
  const migasTema = document.getElementById('migasTema');
  const tituloTemaPrincipal = document.getElementById('tituloTemaPrincipal');
  const badgeEstadoTema = document.getElementById('badgeEstadoTema');
  const badgeDificultadTema = document.getElementById('badgeDificultadTema');

  const tabFicha = document.getElementById('tabFicha');
  const tabGlosario = document.getElementById('tabGlosario');
  const panelFicha = document.getElementById('panelFicha');
  const panelGlosario = document.getElementById('panelGlosario');
  const contadorPestanaGlosario = document.getElementById('contadorPestanaGlosario');

  // Campos Ficha
  const inputTitulo = document.getElementById('inputTitulo');
  const selectEstado = document.getElementById('selectEstado');
  const selectDificultad = document.getElementById('selectDificultad');
  const inputFuentes = document.getElementById('inputFuentes');
  const inputPalabrasClave = document.getElementById('inputPalabrasClave');
  const textareaResumen = document.getElementById('textareaResumen');
  const textoContadorPalabras = document.getElementById('textoContadorPalabras');
  const estadoContadorPalabras = document.getElementById('estadoContadorPalabras');
  const btnTogglePreviewResumen = document.getElementById('btnTogglePreviewResumen');
  const previewResumen = document.getElementById('previewResumen');

  // Listas interactivas
  const listaObjetivos = document.getElementById('listaObjetivos');
  const inputNuevoObjetivo = document.getElementById('inputNuevoObjetivo');
  const btnAgregarObjetivo = document.getElementById('btnAgregarObjetivo');

  const listaEjemplos = document.getElementById('listaEjemplos');
  const inputNuevoEjemplo = document.getElementById('inputNuevoEjemplo');
  const btnAgregarEjemplo = document.getElementById('btnAgregarEjemplo');

  const listaErrores = document.getElementById('listaErrores');
  const inputNuevoError = document.getElementById('inputNuevoError');
  const btnAgregarError = document.getElementById('btnAgregarError');

  const listaPreguntas = document.getElementById('listaPreguntas');
  const inputNuevaPregunta = document.getElementById('inputNuevaPregunta');
  const btnAgregarPregunta = document.getElementById('btnAgregarPregunta');

  const listaRecursos = document.getElementById('listaRecursos');
  const btnAgregarRecurso = document.getElementById('btnAgregarRecurso');

  // Glosario DOM
  const metricaTotalTerminos = document.getElementById('metricaTotalTerminos');
  const metrica6Letras = document.getElementById('metrica6Letras');
  const metricaIndicadorJuegos = document.getElementById('metricaIndicadorJuegos');
  const cuerpoTablaGlosario = document.getElementById('cuerpoTablaGlosario');
  const btnNuevoTermino = document.getElementById('btnNuevoTermino');

  // Listas en memoria para la ficha
  let arrayObjetivos = [];
  let arrayEjemplos = [];
  let arrayErrores = [];
  let arrayPreguntas = [];
  let arrayRecursos = [];

  // Marcar cambios pendientes
  function marcarCambios(modificado = true) {
    hayCambiosSinGuardar = modificado;
    if (modificado) {
      btnGuardarFicha.classList.add('btn--acento');
      btnGuardarFicha.textContent = '💾 Guardar cambios *';
    } else {
      btnGuardarFicha.classList.remove('btn--acento');
      btnGuardarFicha.textContent = '💾 Guardar ficha';
    }
  }

  // Interceptar beforeunload
  window.addEventListener('beforeunload', (e) => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Botón Volver con verificación
  btnVolver.addEventListener('click', async (e) => {
    e.preventDefault();
    if (hayCambiosSinGuardar) {
      const salir = await ui.confirmar('Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?');
      if (!salir) return;
    }
    const destino = unidadActual && unidadActual.asignaturaId
      ? `/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(unidadActual.asignaturaId)}&unidadId=${encodeURIComponent(unidadActual.id)}`
      : '/paginas/editor-contenidos.html';
    window.location.href = destino;
  });

  // Pestañas
  tabFicha.addEventListener('click', () => cambiarPestana('panelFicha'));
  tabGlosario.addEventListener('click', () => cambiarPestana('panelGlosario'));

  function cambiarPestana(panelId) {
    if (panelId === 'panelFicha') {
      tabFicha.classList.add('activa');
      tabGlosario.classList.remove('activa');
      panelFicha.classList.add('activo');
      panelGlosario.classList.remove('activo');
    } else {
      tabGlosario.classList.add('activa');
      tabFicha.classList.remove('activa');
      panelGlosario.classList.add('activo');
      panelFicha.classList.remove('activo');
    }
  }

  // Contador de palabras
  function contarPalabras(texto) {
    if (!texto) return 0;
    return texto.trim().split(/\s+/).filter(Boolean).length;
  }

  function actualizarContadorResumen() {
    const palabras = contarPalabras(textareaResumen.value);
    textoContadorPalabras.textContent = `${palabras} palabra${palabras === 1 ? '' : 's'}`;

    if (palabras >= 300 && palabras <= 800) {
      estadoContadorPalabras.textContent = 'Longitud adecuada (300 a 800 palabras)';
      estadoContadorPalabras.className = 'contador-palabras__estado contador-palabras__estado--ok';
    } else if (palabras > 800) {
      estadoContadorPalabras.textContent = 'Excede la recomendación (> 800 palabras)';
      estadoContadorPalabras.className = 'contador-palabras__estado contador-palabras__estado--alerta';
    } else {
      estadoContadorPalabras.textContent = 'Recomendado: 300 a 800 palabras';
      estadoContadorPalabras.className = 'contador-palabras__estado contador-palabras__estado--alerta';
    }
  }

  textareaResumen.addEventListener('input', () => {
    actualizarContadorResumen();
    marcarCambios(true);
    if (previewResumen.style.display !== 'none') {
      previewResumen.innerHTML = util.formatoBasico(textareaResumen.value) || '<p><em>Sin contenido</em></p>';
    }
  });

  // Toggle preview resumen
  btnTogglePreviewResumen.addEventListener('click', () => {
    if (previewResumen.style.display === 'none') {
      previewResumen.innerHTML = util.formatoBasico(textareaResumen.value) || '<p><em>Sin contenido</em></p>';
      previewResumen.style.display = 'block';
      btnTogglePreviewResumen.textContent = '❌ Ocultar vista previa';
    } else {
      previewResumen.style.display = 'none';
      btnTogglePreviewResumen.textContent = '👁️ Ver formato formateado';
    }
  });

  // Escuchar cambios en inputs simples
  [inputTitulo, selectEstado, selectDificultad, inputFuentes, inputPalabrasClave].forEach(el => {
    el.addEventListener('input', () => marcarCambios(true));
    el.addEventListener('change', () => marcarCambios(true));
  });

  // Carga inicial de datos
  async function cargarDatos() {
    ui.cargando(true);
    try {
      const [tema, glosario] = await Promise.all([
        api.obtener('temas', temaId),
        api.listar('glosario', { temaId })
      ]);

      temaActual = tema;
      listaGlosario = Array.isArray(glosario) ? glosario : [];

      if (tema.unidadId) {
        try {
          unidadActual = await api.obtener('unidades', tema.unidadId);
        } catch {
          unidadActual = null;
        }
      }

      poblarFicha(tema);
      poblarGlosario(listaGlosario);
      marcarCambios(false);
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar los datos del tema.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Llenar formulario de la ficha
  function poblarFicha(tema) {
    tituloTemaPrincipal.textContent = tema.titulo || 'Sin título';
    badgeEstadoTema.textContent = (tema.estado === 'publicado') ? 'Publicado' : 'Borrador';
    badgeEstadoTema.className = `insignia ${tema.estado === 'publicado' ? 'insignia--exito' : 'insignia--advertencia'}`;

    badgeDificultadTema.textContent = `Dificultad: ${tema.dificultad || 'media'}`;

    if (unidadActual) {
      migasTema.textContent = `Unidad: ${unidadActual.titulo || unidadActual.id}`;
      btnVolver.href = `/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(unidadActual.asignaturaId)}&unidadId=${encodeURIComponent(unidadActual.id)}`;
    } else {
      migasTema.textContent = 'Tema de contenido';
    }

    inputTitulo.value = tema.titulo || '';
    selectEstado.value = tema.estado || 'borrador';
    selectDificultad.value = tema.dificultad || 'media';
    inputFuentes.value = tema.fuentes || '';
    inputPalabrasClave.value = Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : '';
    textareaResumen.value = tema.resumen || '';
    actualizarContadorResumen();

    arrayObjetivos = Array.isArray(tema.objetivos) ? [...tema.objetivos] : [];
    renderizarListaSimple(listaObjetivos, arrayObjetivos, 'arrayObjetivos');

    arrayEjemplos = Array.isArray(tema.ejemplos) ? [...tema.ejemplos] : [];
    renderizarListaSimple(listaEjemplos, arrayEjemplos, 'arrayEjemplos');

    arrayErrores = Array.isArray(tema.erroresFrecuentes) ? [...tema.erroresFrecuentes] : [];
    renderizarListaSimple(listaErrores, arrayErrores, 'arrayErrores');

    arrayPreguntas = Array.isArray(tema.preguntasGuia) ? [...tema.preguntasGuia] : [];
    renderizarListaSimple(listaPreguntas, arrayPreguntas, 'arrayPreguntas');

    arrayRecursos = Array.isArray(tema.recursos) ? JSON.parse(JSON.stringify(tema.recursos)) : [];
    renderizarRecursos();
  }

  // Renderizar listas simples (objetivos, ejemplos, errores, preguntas)
  function renderizarListaSimple(contenedorDom, arrayDatos, nombreArray) {
    if (arrayDatos.length === 0) {
      contenedorDom.innerHTML = '<p class="campo__ayuda"><small>Sin elementos añadidos.</small></p>';
      return;
    }

    contenedorDom.innerHTML = arrayDatos.map((item, idx) => `
      <div class="lista-dinamica__item">
        <span class="lista-dinamica__item-texto">${ui.escapar(item)}</span>
        <button type="button" class="btn btn--peligro btn--pequeno btn-quitar-item" 
                data-array="${nombreArray}" 
                data-idx="${idx}" 
                title="Quitar elemento" 
                aria-label="Quitar">
          ×
        </button>
      </div>
    `).join('');
  }

  // Delegación de eventos para eliminar elementos de listas simples
  document.addEventListener('click', (e) => {
    const btnQuitar = e.target.closest('.btn-quitar-item');
    if (!btnQuitar) return;

    const nombre = btnQuitar.dataset.array;
    const idx = parseInt(btnQuitar.dataset.idx, 10);

    if (nombre === 'arrayObjetivos') {
      arrayObjetivos.splice(idx, 1);
      renderizarListaSimple(listaObjetivos, arrayObjetivos, 'arrayObjetivos');
    } else if (nombre === 'arrayEjemplos') {
      arrayEjemplos.splice(idx, 1);
      renderizarListaSimple(listaEjemplos, arrayEjemplos, 'arrayEjemplos');
    } else if (nombre === 'arrayErrores') {
      arrayErrores.splice(idx, 1);
      renderizarListaSimple(listaErrores, arrayErrores, 'arrayErrores');
    } else if (nombre === 'arrayPreguntas') {
      arrayPreguntas.splice(idx, 1);
      renderizarListaSimple(listaPreguntas, arrayPreguntas, 'arrayPreguntas');
    }
    marcarCambios(true);
  });

  // Agregar a listas simples
  function asociarAgregar(inputEl, btnEl, arrayDatos, contenedorDom, nombreArray) {
    const agregar = () => {
      const val = inputEl.value.trim();
      if (!val) return;
      arrayDatos.push(val);
      inputEl.value = '';
      renderizarListaSimple(contenedorDom, arrayDatos, nombreArray);
      marcarCambios(true);
      inputEl.focus();
    };

    btnEl.addEventListener('click', agregar);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        agregar();
      }
    });
  }

  asociarAgregar(inputNuevoObjetivo, btnAgregarObjetivo, arrayObjetivos, listaObjetivos, 'arrayObjetivos');
  asociarAgregar(inputNuevoEjemplo, btnAgregarEjemplo, arrayEjemplos, listaEjemplos, 'arrayEjemplos');
  asociarAgregar(inputNuevoError, btnAgregarError, arrayErrores, listaErrores, 'arrayErrores');
  asociarAgregar(inputNuevaPregunta, btnAgregarPregunta, arrayPreguntas, listaPreguntas, 'arrayPreguntas');

  // Renderizar Recursos
  function renderizarRecursos() {
    if (arrayRecursos.length === 0) {
      listaRecursos.innerHTML = '<p class="campo__ayuda"><small>No se han registrado recursos multimedia ni documentos. Pulsa "+ Agregar recurso" para añadir uno.</small></p>';
      return;
    }

    listaRecursos.innerHTML = arrayRecursos.map((rec, idx) => {
      const admiteSubida = rec.tipo === 'pdf' || rec.tipo === 'imagen';

      return `
        <div class="recurso-card" data-idx="${idx}">
          <div class="recurso-card__fila">
            <div class="campo" style="margin: 0;">
              <label for="recTipo_${idx}"><small>Tipo</small></label>
              <select id="recTipo_${idx}" class="rec-tipo" data-idx="${idx}">
                <option value="video"${rec.tipo === 'video' ? ' selected' : ''}>Video</option>
                <option value="pdf"${rec.tipo === 'pdf' ? ' selected' : ''}>PDF</option>
                <option value="imagen"${rec.tipo === 'imagen' ? ' selected' : ''}>Imagen</option>
                <option value="enlace"${rec.tipo === 'enlace' ? ' selected' : ''}>Enlace web</option>
              </select>
            </div>

            <div class="campo" style="margin: 0;">
              <label for="recTitulo_${idx}"><small>Título del recurso</small></label>
              <input type="text" id="recTitulo_${idx}" class="rec-titulo" data-idx="${idx}" value="${ui.escapar(rec.titulo || '')}" placeholder="Ej. Guía ilustrada, Video explicativo...">
            </div>

            <div>
              <button type="button" class="btn btn--peligro btn--pequeno btn-quitar-recurso" data-idx="${idx}" title="Eliminar recurso">
                🗑️
              </button>
            </div>
          </div>

          <div class="campo" style="margin: 0;">
            <label for="recUrl_${idx}"><small>URL o archivo</small></label>
            <div class="recurso-card__url-fila">
              <input type="text" id="recUrl_${idx}" class="rec-url" data-idx="${idx}" value="${ui.escapar(rec.url || '')}" placeholder="https://... o sube un archivo">
              <button type="button" class="btn btn--secundario btn--pequeno btn-subir-recurso" data-idx="${idx}" style="${admiteSubida ? '' : 'display: none;'}">
                📤 Subir
              </button>
              <input type="file" class="input-archivo-oculto" data-idx="${idx}" style="display: none;" accept="${rec.tipo === 'pdf' ? 'application/pdf' : 'image/*'}">
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Delegación de eventos para recursos
  listaRecursos.addEventListener('change', (e) => {
    const idx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(idx) || !arrayRecursos[idx]) return;

    if (e.target.classList.contains('rec-tipo')) {
      arrayRecursos[idx].tipo = e.target.value;
      renderizarRecursos();
      marcarCambios(true);
    }
  });

  listaRecursos.addEventListener('input', (e) => {
    const idx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(idx) || !arrayRecursos[idx]) return;

    if (e.target.classList.contains('rec-titulo')) {
      arrayRecursos[idx].titulo = e.target.value;
      marcarCambios(true);
    } else if (e.target.classList.contains('rec-url')) {
      arrayRecursos[idx].url = e.target.value;
      marcarCambios(true);
    }
  });

  listaRecursos.addEventListener('click', async (e) => {
    const btnQuitar = e.target.closest('.btn-quitar-recurso');
    if (btnQuitar) {
      const idx = parseInt(btnQuitar.dataset.idx, 10);
      arrayRecursos.splice(idx, 1);
      renderizarRecursos();
      marcarCambios(true);
      return;
    }

    const btnSubir = e.target.closest('.btn-subir-recurso');
    if (btnSubir) {
      const card = btnSubir.closest('.recurso-card');
      const fileInput = card.querySelector('.input-archivo-oculto');
      if (fileInput) fileInput.click();
      return;
    }
  });

  // Manejar subida de archivo para recursos
  listaRecursos.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('input-archivo-oculto')) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const idx = parseInt(e.target.dataset.idx, 10);
    if (isNaN(idx) || !arrayRecursos[idx]) return;

    ui.cargando(true);
    try {
      const respuesta = await api.subir(file);
      if (respuesta && respuesta.url) {
        arrayRecursos[idx].url = respuesta.url;
        renderizarRecursos();
        marcarCambios(true);
        ui.aviso('Archivo subido con éxito.', 'exito');
      } else {
        throw new Error('Respuesta inesperada al subir el archivo.');
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al subir el archivo.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Agregar recurso vacío
  btnAgregarRecurso.addEventListener('click', () => {
    arrayRecursos.push({
      tipo: 'enlace',
      titulo: '',
      url: ''
    });
    renderizarRecursos();
    marcarCambios(true);
  });

  // Guardar Ficha
  btnGuardarFicha.addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      ui.aviso('El título del tema es obligatorio.', 'error');
      inputTitulo.focus();
      return;
    }

    const palabrasClave = inputPalabrasClave.value
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const datosActualizados = {
      titulo,
      estado: selectEstado.value,
      dificultad: selectDificultad.value,
      fuentes: inputFuentes.value.trim(),
      resumen: textareaResumen.value.trim(),
      palabrasClave,
      objetivos: arrayObjetivos,
      ejemplos: arrayEjemplos,
      erroresFrecuentes: arrayErrores,
      preguntasGuia: arrayPreguntas,
      recursos: arrayRecursos
    };

    ui.cargando(true);
    try {
      const temaActualizado = await api.actualizar('temas', temaId, datosActualizados);
      temaActual = temaActualizado;
      tituloTemaPrincipal.textContent = temaActualizado.titulo;
      badgeEstadoTema.textContent = (temaActualizado.estado === 'publicado') ? 'Publicado' : 'Borrador';
      badgeEstadoTema.className = `insignia ${temaActualizado.estado === 'publicado' ? 'insignia--exito' : 'insignia--advertencia'}`;
      badgeDificultadTema.textContent = `Dificultad: ${temaActualizado.dificultad || 'media'}`;

      marcarCambios(false);
      ui.aviso('Ficha pedagógica guardada con éxito.', 'exito');
    } catch (error) {
      ui.aviso(error.message || 'Error al guardar la ficha.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // ----------------------------------------------------
  // GESTIÓN DE GLOSARIO
  // ----------------------------------------------------

  function poblarGlosario(glosario) {
    listaGlosario = Array.isArray(glosario) ? glosario : [];
    actualizarMetricasGlosario();
    renderizarTablaGlosario();
  }

  function actualizarMetricasGlosario() {
    const total = listaGlosario.length;
    // Conteo de términos con exactamente 6 letras usando util.normalizar
    const terminos6 = listaGlosario.filter(g => {
      const norm = util.normalizar(g.termino || '');
      return norm.length === 6;
    }).length;

    metricaTotalTerminos.textContent = total;
    metrica6Letras.textContent = terminos6;
    contadorPestanaGlosario.textContent = total;

    // Condición: 12 o más términos y al menos 3 de 6 letras
    const esApto = total >= 12 && terminos6 >= 3;
    if (esApto) {
      metricaIndicadorJuegos.innerHTML = `
        <span class="insignia insignia--exito" title="Cumple con los requisitos mínimos para crucigramas, sopa de letras y ruleta">
          🎮 Apto para juegos
        </span>
      `;
    } else {
      const faltanTerminos = Math.max(0, 12 - total);
      const faltan6 = Math.max(0, 3 - terminos6);
      let detalle = [];
      if (faltanTerminos > 0) detalle.push(`${faltanTerminos} término(s) más`);
      if (faltan6 > 0) detalle.push(`${faltan6} de 6 letras`);

      metricaIndicadorJuegos.innerHTML = `
        <span class="insignia insignia--advertencia" title="Faltan: ${detalle.join(' y ')}">
          ⚠️ Incompleto (${total}/12 términos, ${terminos6}/3 de 6 letras)
        </span>
      `;
    }
  }

  function renderizarTablaGlosario() {
    if (listaGlosario.length === 0) {
      cuerpoTablaGlosario.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: var(--espacio-xl);">
            <div class="vacio" style="border: 0; padding: var(--espacio-m);">
              <div class="vacio__icono">📖</div>
              <h3 class="vacio__titulo">Sin términos en el glosario</h3>
              <p class="vacio__texto">Agrega al menos 12 términos pedagógicos con definición y pistas para habilitar los juegos interactivos del tema.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTablaGlosario.innerHTML = listaGlosario.map(item => {
      const longitudNorm = util.normalizar(item.termino || '').length;
      const es6Letras = longitudNorm === 6;

      return `
        <tr data-id="${ui.escapar(item.id)}">
          <td>
            <span class="glosario-termino">${ui.escapar(item.termino)}</span>
            <span class="glosario-longitud ${es6Letras ? 'glosario-longitud--6' : ''}" title="${longitudNorm} letras">
              ${longitudNorm}l
            </span>
          </td>
          <td>${ui.escapar(item.definicion)}</td>
          <td><small>${ui.escapar(item.pista || '-')}</small></td>
          <td><small>${ui.escapar(item.retroalimentacion || '-')}</small></td>
          <td style="text-align: right;">
            <div class="tabla-acciones" style="justify-content: flex-end;">
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar-termino" data-id="${ui.escapar(item.id)}" title="Editar término">
                ✏️
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-termino" data-id="${ui.escapar(item.id)}" title="Eliminar término">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Delegación de eventos en tabla de glosario
  cuerpoTablaGlosario.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('.btn-editar-termino');
    const btnEliminar = e.target.closest('.btn-eliminar-termino');

    if (btnEditar) {
      const item = listaGlosario.find(g => g.id === btnEditar.dataset.id);
      if (item) await abrirModalTermino(item);
      return;
    }

    if (btnEliminar) {
      const item = listaGlosario.find(g => g.id === btnEliminar.dataset.id);
      if (item) await eliminarTermino(item);
      return;
    }
  });

  // Modal para agregar o editar término de glosario
  async function abrirModalTermino(item = null) {
    const esEdicion = Boolean(item);

    const form = document.createElement('form');
    form.className = 'modal-form-glosario';
    form.innerHTML = `
      <div class="campo">
        <label for="inputTermino">Término (palabra clave) *</label>
        <input type="text" id="inputTermino" required placeholder="Ej. genoma, alelos, biotopo..." value="${ui.escapar(item?.termino || '')}">
        <div class="campo__contador-modal">
          <span>Letras: <strong id="contadorLetrasTermino">0</strong></span>
          <span id="badge6LetrasModal" style="display: none;" class="insignia insignia--exito">¡Exactamente 6 letras!</span>
        </div>
      </div>

      <div class="campo">
        <label for="textareaDefinicion">Definición (máximo 25 palabras) *</label>
        <textarea id="textareaDefinicion" rows="3" required placeholder="Definición clara y concisa...">${ui.escapar(item?.definicion || '')}</textarea>
        <div class="campo__contador-modal">
          <span>Palabras: <strong id="contadorPalabrasDefinicion">0</strong> / 25</span>
          <span id="avisoExcesoDefinicion" style="color: var(--color-error); display: none;">Excede el límite de 25 palabras</span>
        </div>
      </div>

      <div class="campo">
        <label for="textareaPista">Pista para juegos (máximo 10 palabras)</label>
        <textarea id="textareaPista" rows="2" placeholder="Pista breve para adivinar el término...">${ui.escapar(item?.pista || '')}</textarea>
        <div class="campo__contador-modal">
          <span>Palabras: <strong id="contadorPalabrasPista">0</strong> / 10</span>
          <span id="avisoExcesoPista" style="color: var(--color-error); display: none;">Excede el límite de 10 palabras</span>
        </div>
      </div>

      <div class="campo">
        <label for="inputRetroalimentacion">Retroalimentación al responder</label>
        <input type="text" id="inputRetroalimentacion" placeholder="Ej. ¡Correcto! Los alelos son variantes del gen." value="${ui.escapar(item?.retroalimentacion || '')}">
      </div>
    `;

    const inputTermino = form.querySelector('#inputTermino');
    const contadorLetras = form.querySelector('#contadorLetrasTermino');
    const badge6LetrasModal = form.querySelector('#badge6LetrasModal');

    const textareaDef = form.querySelector('#textareaDefinicion');
    const contadorPalabrasDef = form.querySelector('#contadorPalabrasDefinicion');
    const avisoExcesoDef = form.querySelector('#avisoExcesoDefinicion');

    const textareaPista = form.querySelector('#textareaPista');
    const contadorPalabrasPista = form.querySelector('#contadorPalabrasPista');
    const avisoExcesoPista = form.querySelector('#avisoExcesoPista');

    // Actualización de contadores en vivo
    function actualizarContadoresModal() {
      const norm = util.normalizar(inputTermino.value.trim());
      contadorLetras.textContent = norm.length;
      badge6LetrasModal.style.display = (norm.length === 6) ? 'inline-flex' : 'none';

      const palDef = contarPalabras(textareaDef.value);
      contadorPalabrasDef.textContent = palDef;
      if (palDef > 25) {
        contadorPalabrasDef.style.color = 'var(--color-error)';
        avisoExcesoDef.style.display = 'inline';
      } else {
        contadorPalabrasDef.style.color = 'inherit';
        avisoExcesoDef.style.display = 'none';
      }

      const palPista = contarPalabras(textareaPista.value);
      contadorPalabrasPista.textContent = palPista;
      if (palPista > 10) {
        contadorPalabrasPista.style.color = 'var(--color-error)';
        avisoExcesoPista.style.display = 'inline';
      } else {
        contadorPalabrasPista.style.color = 'inherit';
        avisoExcesoPista.style.display = 'none';
      }
    }

    inputTermino.addEventListener('input', actualizarContadoresModal);
    textareaDef.addEventListener('input', actualizarContadoresModal);
    textareaPista.addEventListener('input', actualizarContadoresModal);

    actualizarContadoresModal();

    const accion = await ui.modal({
      titulo: esEdicion ? 'Editar término del glosario' : 'Nuevo término del glosario',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: esEdicion ? 'Guardar cambios' : 'Agregar término', valor: 'guardar', clase: 'btn--primario' }
      ]
    });

    if (accion === 'guardar') {
      const termino = inputTermino.value.trim();
      const definicion = textareaDef.value.trim();
      const pista = textareaPista.value.trim();
      const retroalimentacion = form.querySelector('#inputRetroalimentacion').value.trim();

      if (!termino) {
        ui.aviso('El término es obligatorio.', 'error');
        return;
      }
      if (!definicion) {
        ui.aviso('La definición es obligatoria.', 'error');
        return;
      }

      const palabrasDef = contarPalabras(definicion);
      if (palabrasDef > 25) {
        ui.aviso(`La definición tiene ${palabrasDef} palabras y el límite máximo es 25.`, 'error');
        return;
      }

      const palabrasPista = contarPalabras(pista);
      if (palabrasPista > 10) {
        ui.aviso(`La pista tiene ${palabrasPista} palabras y el límite máximo es 10.`, 'error');
        return;
      }

      ui.cargando(true);
      try {
        if (esEdicion) {
          await api.actualizar('glosario', item.id, {
            termino,
            definicion,
            pista,
            retroalimentacion
          });
          ui.aviso('Término actualizado con éxito.', 'exito');
        } else {
          await api.crear('glosario', {
            temaId,
            termino,
            definicion,
            pista,
            retroalimentacion,
            origen: 'docente',
            estado: 'aprobado'
          });
          ui.aviso('Término agregado al glosario.', 'exito');
        }

        const actualizado = await api.listar('glosario', { temaId });
        poblarGlosario(actualizado);
      } catch (error) {
        ui.aviso(error.message || 'Error al guardar término de glosario.', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  }

  // Eliminar término
  async function eliminarTermino(item) {
    const seguro = await ui.confirmar(`¿Estás seguro de que deseas eliminar el término "${item.termino}" del glosario?`);
    if (!seguro) return;

    ui.cargando(true);
    try {
      await api.eliminar('glosario', item.id);
      ui.aviso('Término eliminado del glosario.', 'exito');
      const actualizado = await api.listar('glosario', { temaId });
      poblarGlosario(actualizado);
    } catch (error) {
      ui.aviso(error.message || 'Error al eliminar término.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  btnNuevoTermino.addEventListener('click', () => abrirModalTermino());

  // Iniciar carga
  cargarDatos();
}
