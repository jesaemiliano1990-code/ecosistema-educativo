// publico/js/modulos/editor-cancion.js
// Editor de canciones educativas para docentes y administradores

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de Canción', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const cancionId = util.parametro('id');
const temaIdUrl = util.parametro('temaId');

if (contenido) {
  const esEdicion = Boolean(cancionId);

  contenido.innerHTML = `
    <div class="editor-cancion">
      <div class="editor-cancion__barra">
        <a href="/paginas/canciones.html${temaIdUrl ? '?temaId=' + temaIdUrl : ''}" class="editor-cancion__volver">
          ← Volver a Canciones
        </a>
        <button type="button" id="btnGuardarCancion" class="btn btn--primario">
          💾 ${esEdicion ? 'Guardar cambios' : 'Guardar canción'}
        </button>
      </div>

      <header>
        <h1>${esEdicion ? 'Editar Canción' : 'Nueva Canción Educativa'}</h1>
        <p>Publica canciones formativas con letra y sincronización LRC para apoyar el aprendizaje.</p>
      </header>

      <div class="editor-cancion__grid">
        <!-- Formulario principal -->
        <form class="tarjeta editor-cancion__form" id="formCancion" novalidate>
          <div class="campo">
            <label for="inputTitulo">Título de la canción *</label>
            <input type="text" id="inputTitulo" required placeholder="Ej. El Ciclo del Agua en Rima">
          </div>

          <div class="campo">
            <label for="selectTema">Tema pedagógico (Mis temas) *</label>
            <select id="selectTema" required>
              <option value="">Selecciona un tema...</option>
            </select>
          </div>

          <div class="campo">
            <label for="inputAudio">Archivo de audio MP3 *</label>
            <div class="editor-cancion__audio-box">
              <div class="editor-cancion__audio-inputs">
                <input type="url" id="inputAudio" required placeholder="URL del archivo MP3 o sube uno local">
                <button type="button" class="btn btn--secundario" id="btnSubirAudio">
                  🎵 Subir MP3
                </button>
                <input type="file" id="fileAudioOculto" accept=".mp3,audio/mpeg,audio/mp3" style="display: none;">
              </div>
              <audio id="audioPreview" class="editor-cancion__preview-audio" controls style="display: none;"></audio>
            </div>
            <small>Formato recomendado: MP3 de alta fidelidad.</small>
          </div>

          <div class="campo">
            <label for="textareaLetra">Letra de la canción *</label>
            <textarea id="textareaLetra" rows="8" required placeholder="Escribe aquí las estrofas y versos de la canción..."></textarea>
          </div>

          <div class="campo">
            <label for="textareaLrc">Letra sincronizada LRC (opcional)</label>
            <textarea id="textareaLrc" rows="6" placeholder="[00:10.00] Primera estrofa...&#10;[00:15.50] Segunda estrofa..."></textarea>
            <div class="editor-cancion__guia-lrc">
              <strong>💡 Formato LRC estándar:</strong> Incluye marcas de tiempo como <code>[mm:ss.xx]</code> al inicio de cada verso para sincronizar el resaltado y desplazamiento con la música.
            </div>
          </div>

          <div class="campo">
            <label for="inputAutoria">Autoría / Compositor *</label>
            <input type="text" id="inputAutoria" required placeholder="Ej. Prof. María Rodríguez / Ecosistema Educativo">
          </div>

          <div class="campo">
            <label for="selectLicencia">Licencia de uso *</label>
            <select id="selectLicencia" required>
              <option value="">Selecciona una licencia...</option>
              <option value="Propia">Propia</option>
              <option value="CC BY">Creative Commons Atribución (CC BY)</option>
              <option value="CC BY-SA">Creative Commons Atribución-CompartirIgual (CC BY-SA)</option>
              <option value="Otra">Otra (especificar)</option>
            </select>
          </div>

          <div class="campo" id="campoLicenciaOtra" style="display: none;">
            <label for="inputLicenciaOtra">Descripción de la licencia *</label>
            <input type="text" id="inputLicenciaOtra" placeholder="Detalla los términos o fuente de la licencia">
          </div>
        </form>

        <!-- Panel lateral informativo y de ayuda -->
        <aside class="editor-cancion__panel-lateral">
          <div class="tarjeta editor-cancion__ayuda-card">
            <h3>🎵 Buenas prácticas pedagógicas</h3>
            <p>La música facilita la retención nemotécnica de conceptos científicos y literarios.</p>
            <ul>
              <li>Usa canciones con ritmo pausado y pronunciación clara.</li>
              <li>Sincroniza la letra con LRC para que los estudiantes sigan la lectura palabra por palabra.</li>
              <li>Asegúrate de contar con los derechos o usar licencias abiertas (CC BY).</li>
            </ul>
          </div>

          <div class="tarjeta editor-cancion__ayuda-card">
            <h3>⚖️ Licencias admitidas</h3>
            <p><strong>Propia:</strong> Material original creado por el docente para el aula.</p>
            <p><strong>CC BY / CC BY-SA:</strong> Obras libres que permiten compartir reconociendo la autoría.</p>
            <p><strong>Otra:</strong> Licencias institucionales o de dominio público con descripción expresa.</p>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Referencias a elementos
  const btnGuardar = document.getElementById('btnGuardarCancion');
  const inputTitulo = document.getElementById('inputTitulo');
  const selectTema = document.getElementById('selectTema');
  const inputAudio = document.getElementById('inputAudio');
  const btnSubirAudio = document.getElementById('btnSubirAudio');
  const fileAudioOculto = document.getElementById('fileAudioOculto');
  const audioPreview = document.getElementById('audioPreview');
  const textareaLetra = document.getElementById('textareaLetra');
  const textareaLrc = document.getElementById('textareaLrc');
  const inputAutoria = document.getElementById('inputAutoria');
  const selectLicencia = document.getElementById('selectLicencia');
  const campoLicenciaOtra = document.getElementById('campoLicenciaOtra');
  const inputLicenciaOtra = document.getElementById('inputLicenciaOtra');

  // Control del campo "Otra" licencia
  selectLicencia.addEventListener('change', () => {
    if (selectLicencia.value === 'Otra') {
      campoLicenciaOtra.style.display = 'block';
      inputLicenciaOtra.setAttribute('required', 'required');
    } else {
      campoLicenciaOtra.style.display = 'none';
      inputLicenciaOtra.removeAttribute('required');
      inputLicenciaOtra.value = '';
    }
  });

  // Previsualización de audio cuando cambia la URL
  function actualizarPreviewAudio() {
    const url = inputAudio.value.trim();
    if (url) {
      audioPreview.src = url;
      audioPreview.style.display = 'block';
    } else {
      audioPreview.src = '';
      audioPreview.style.display = 'none';
    }
  }

  inputAudio.addEventListener('input', actualizarPreviewAudio);
  inputAudio.addEventListener('change', actualizarPreviewAudio);

  // Subida de archivo de audio
  btnSubirAudio.addEventListener('click', () => fileAudioOculto.click());

  fileAudioOculto.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio')) {
      ui.aviso('Solo se admiten archivos de audio en formato MP3.', 'error');
      return;
    }

    ui.cargando(true);
    try {
      const res = await api.subir(file);
      if (res && res.url) {
        inputAudio.value = res.url;
        actualizarPreviewAudio();
        ui.aviso('Archivo de audio subido correctamente.', 'exito');
      } else {
        throw new Error('No se recibió la URL del audio subido.');
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al subir el archivo de audio.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Carga inicial de datos
  async function iniciar() {
    ui.cargando(true);
    try {
      // Cargar mis temas disponibles
      const [temas, unidades, asignaturas] = await Promise.all([
        api.listar('temas'),
        api.listar('unidades'),
        api.listar('asignaturas')
      ]);

      const asigMap = new Map((asignaturas || []).map(a => [a.id, a.nombre]));
      const unidadMap = new Map((unidades || []).map(u => [u.id, u]));

      // Agrupar temas por asignatura para una selección clara
      const gruposAsignatura = new Map();

      (temas || []).forEach(t => {
        if (!t || !t.id) return;
        const u = unidadMap.get(t.unidadId);
        const asigNombre = (u && asigMap.get(u.asignaturaId)) || 'Otras asignaturas';
        if (!gruposAsignatura.has(asigNombre)) {
          gruposAsignatura.set(asigNombre, []);
        }
        gruposAsignatura.get(asigNombre).push(t);
      });

      selectTema.innerHTML = '<option value="">Selecciona un tema...</option>';
      for (const [asigNombre, listaTemas] of gruposAsignatura.entries()) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = asigNombre;
        listaTemas.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.titulo;
          optgroup.appendChild(opt);
        });
        selectTema.appendChild(optgroup);
      }

      // Preseleccionar si viene temaId en la URL
      if (temaIdUrl) {
        selectTema.value = temaIdUrl;
      }

      // Si es edición, cargar la canción existente
      if (esEdicion) {
        const cancion = await api.obtener('canciones', cancionId);
        if (cancion) {
          inputTitulo.value = cancion.titulo || '';
          if (cancion.temaId) selectTema.value = cancion.temaId;
          inputAudio.value = cancion.audio || '';
          textareaLetra.value = cancion.letra || '';
          textareaLrc.value = cancion.lrc || '';
          inputAutoria.value = cancion.autoria || '';

          // Manejar licencia
          const lic = cancion.licencia || '';
          if (['Propia', 'CC BY', 'CC BY-SA'].includes(lic)) {
            selectLicencia.value = lic;
            campoLicenciaOtra.style.display = 'none';
          } else if (lic.startsWith('Otra')) {
            selectLicencia.value = 'Otra';
            campoLicenciaOtra.style.display = 'block';
            inputLicenciaOtra.value = lic.replace(/^Otra:\s*/, '');
          } else if (lic) {
            selectLicencia.value = 'Otra';
            campoLicenciaOtra.style.display = 'block';
            inputLicenciaOtra.value = lic;
          }

          actualizarPreviewAudio();
        }
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al cargar datos del editor.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  // Guardar canción
  btnGuardar.addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    const temaId = selectTema.value;
    const audio = inputAudio.value.trim();
    const letra = textareaLetra.value.trim();
    const lrc = textareaLrc.value.trim();
    const autoria = inputAutoria.value.trim();
    const licenciaTipo = selectLicencia.value;
    const licenciaOtra = inputLicenciaOtra.value.trim();

    // Validaciones
    if (!titulo) {
      ui.aviso('El título de la canción es obligatorio.', 'advertencia');
      inputTitulo.focus();
      return;
    }

    if (!temaId) {
      ui.aviso('Debes seleccionar un tema pedagógico.', 'advertencia');
      selectTema.focus();
      return;
    }

    if (!audio) {
      ui.aviso('Debes proporcionar o subir un archivo MP3 de audio.', 'advertencia');
      inputAudio.focus();
      return;
    }

    if (!letra) {
      ui.aviso('La letra de la canción es obligatoria.', 'advertencia');
      textareaLetra.focus();
      return;
    }

    if (!autoria) {
      ui.aviso('La autoría de la canción es obligatoria.', 'advertencia');
      inputAutoria.focus();
      return;
    }

    if (!licenciaTipo) {
      ui.aviso('Debes seleccionar una licencia de uso.', 'advertencia');
      selectLicencia.focus();
      return;
    }

    if (licenciaTipo === 'Otra' && !licenciaOtra) {
      ui.aviso('Debes describir la licencia personalizada en el campo correspondiente.', 'advertencia');
      inputLicenciaOtra.focus();
      return;
    }

    const licenciaFinal = licenciaTipo === 'Otra' ? `Otra: ${licenciaOtra}` : licenciaTipo;

    const datos = {
      titulo,
      temaId,
      audio,
      letra,
      lrc,
      autoria,
      licencia: licenciaFinal
    };

    ui.cargando(true);
    try {
      if (esEdicion) {
        await api.actualizar('canciones', cancionId, datos);
        ui.aviso('Canción actualizada con éxito.', 'exito');
      } else {
        await api.crear('canciones', datos);
        ui.aviso('Canción guardada con éxito.', 'exito');
      }

      setTimeout(() => {
        window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
      }, 1200);
    } catch (error) {
      ui.aviso(error.message || 'Error al guardar la canción.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  iniciar();
}
