// publico/js/modulos/prueba-datos.js
// Controlador para el módulo de prueba de datos con api.crear y api.listar

import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, llamar } from '../nucleo/api.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { fechaRelativa, fechaLarga } from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Prueba de datos', roles: ['publico'] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();

if (contenido) {
  contenido.innerHTML = `
    <section class="pila">
      <form id="formPrueba" class="tarjeta prueba-datos__formulario pila">
        <h2>Guardar nuevo registro</h2>
        <p>Ingresa un texto para persistirlo en el almacenamiento JSON de la colección "prueba".</p>
        <div class="campo">
          <label for="campoTexto">Texto del registro</label>
          <input type="text" id="campoTexto" name="texto" placeholder="Escribe algo aquí..." required autofocus>
        </div>
        <div class="fila">
          <button type="submit" id="btnGuardar" class="btn btn--primario">Guardar registro</button>
        </div>
      </form>

      <section class="prueba-datos__seccion pila">
        <div class="fila" style="justify-content: space-between;">
          <h2>Registros almacenados</h2>
          <button type="button" id="btnRecargar" class="btn btn--secundario btn--pequeno">🔄 Actualizar</button>
        </div>
        <div id="contenedorLista" class="prueba-datos__lista">
          <p>Cargando registros...</p>
        </div>
      </section>

      <!-- Sección interactiva para probar el motor de gamificación -->
      <section class="tarjeta pila" style="margin-top: var(--espacio-l);">
        <h2>🎮 Prueba del Motor de Gamificación</h2>
        <p>Prueba el endpoint <code>POST /api/intentos</code> y la consulta <code>GET /api/logros/yo</code> con tu sesión activa.</p>

        ${usuario ? `
          <div style="background: rgba(29, 101, 64, 0.1); border-left: 4px solid var(--color-exito); padding: var(--espacio-s) var(--espacio-m); border-radius: 0 var(--radio-s) var(--radio-s) 0; font-size: var(--texto-s);">
            <span>✅ Sesión activa: <strong>${escapar(usuario.nombre)} ${escapar(usuario.apellido)}</strong> (rol: <code>${escapar(usuario.rol)}</code>)</span>
          </div>
        ` : `
          <div style="background: rgba(205, 85, 0, 0.1); border-left: 4px solid var(--color-advertencia); padding: var(--espacio-s) var(--espacio-m); border-radius: 0 var(--radio-s) var(--radio-s) 0; font-size: var(--texto-s); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
            <span>⚠️ <strong>Sin sesión activa:</strong> Para registrar intentos y consultar logros debes ingresar al sistema primero.</span>
            <a href="/paginas/ingreso.html" class="btn btn--primario btn--pequeno">Iniciar sesión →</a>
          </div>
        `}

        <div class="fila" style="gap: var(--espacio-m); flex-wrap: wrap; margin-top: var(--espacio-xs);">
          <button type="button" id="btnProbarIntento" class="btn btn--primario">
            🚀 Enviar intento de prueba (Ahorcado 10/10)
          </button>
          <button type="button" id="btnConsultarLogros" class="btn btn--secundario">
            🏆 Consultar mis logros (/api/logros/yo)
          </button>
        </div>

        <div style="margin-top: var(--espacio-m); border-top: 1px dashed var(--color-borde); padding-top: var(--espacio-m);">
          <h3>✨ Tarea P04.2: Componentes del Navegador</h3>
          <p>Prueba directamente los módulos cliente de gamificación, retroalimentación y selector modal de temas:</p>
          <div class="fila" style="gap: var(--espacio-s); flex-wrap: wrap;">
            <button type="button" id="btnProbarRegistrarIntento" class="btn btn--primario btn--pequeno">
              🎯 Probar registrarIntento() + celebraciones
            </button>
            <button type="button" id="btnProbarRetro" class="btn btn--secundario btn--pequeno">
              💬 Probar mostrarRetro()
            </button>
            <button type="button" id="btnProbarResumen" class="btn btn--secundario btn--pequeno">
              📊 Probar mostrarResumen()
            </button>
            <button type="button" id="btnProbarSelectorTema" class="btn btn--secundario btn--pequeno">
              🔍 Probar selector-tema.js
            </button>
          </div>
          <div id="contenedorRetroPrueba" style="margin-top: var(--espacio-s);"></div>
        </div>

        <div style="margin-top: var(--espacio-m); border-top: 1px dashed var(--color-borde); padding-top: var(--espacio-m);">
          <h3>🎓 Tarea P05.2: Certificados y Diplomas PDF</h3>
          <p>Prueba la emisión de certificados oficiales, descarga de diploma A4 en PDF y verificación pública:</p>
          <div class="fila" style="gap: var(--espacio-s); flex-wrap: wrap;">
            <button type="button" id="btnGenerarDiploma" class="btn btn--primario">
              📜 Descargar Diploma PDF Oficial (jsPDF)
            </button>
            <a href="/paginas/verificar.html" target="_blank" rel="noopener noreferrer" class="btn btn--secundario">
              🔍 Ir a Página de Verificación Pública
            </a>
          </div>
        </div>

        <div id="resultadoGamificacion" style="background: var(--color-fondo); padding: var(--espacio-m); border-radius: var(--radio-s); font-family: monospace; font-size: var(--texto-xs); white-space: pre-wrap; display: none; margin-top: var(--espacio-m);"></div>
      </section>
    </section>
  `;

  const form = document.getElementById('formPrueba');
  const inputTexto = document.getElementById('campoTexto');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnRecargar = document.getElementById('btnRecargar');
  const contenedorLista = document.getElementById('contenedorLista');

  async function cargarRegistros() {
    try {
      const registros = await listar('prueba');

      if (!Array.isArray(registros) || registros.length === 0) {
        contenedorLista.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">📂</div>
            <h3 class="vacio__titulo">No hay registros en la colección</h3>
            <p class="vacio__texto">Aún no se ha creado ningún registro. Completa el campo de texto superior para agregar el primero.</p>
          </div>
        `;
        return;
      }

      contenedorLista.innerHTML = `
        <div class="tabla" tabindex="0" role="region" aria-label="Registros de la colección prueba">
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Texto</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${registros.map(r => `
                <tr>
                  <td><code>${escapar(r.id || '')}</code></td>
                  <td>${escapar(r.texto || '')}</td>
                  <td>${escapar(fechaRelativa(r.fecha) || fechaLarga(r.fecha) || r.fecha || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      aviso(error.message || 'Error al obtener registros', 'error');
      contenedorLista.innerHTML = `
        <div class="alerta alerta--error">
          <p>Error al cargar los datos: ${escapar(error.message)}</p>
        </div>
      `;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputTexto.value.trim();
    if (!texto) {
      aviso('El campo de texto no puede estar vacío', 'advertencia');
      return;
    }

    btnGuardar.disabled = true;
    try {
      await crear('prueba', { texto });
      aviso('Registro guardado con éxito', 'exito');
      inputTexto.value = '';
      inputTexto.focus();
      await cargarRegistros();
    } catch (error) {
      aviso(error.message || 'Error al guardar el registro', 'error');
    } finally {
      btnGuardar.disabled = false;
    }
  });

  btnRecargar.addEventListener('click', async () => {
    await cargarRegistros();
    aviso('Lista actualizada', 'info');
  });

  // Manejo de prueba interactiva de gamificación
  const btnProbarIntento = document.getElementById('btnProbarIntento');
  const btnConsultarLogros = document.getElementById('btnConsultarLogros');
  const resultadoGamificacion = document.getElementById('resultadoGamificacion');

  if (btnProbarIntento) {
    btnProbarIntento.addEventListener('click', async () => {
      const u = usuarioActual();
      if (!u) {
        aviso('Debes iniciar sesión para registrar intentos en el motor de gamificación.', 'advertencia');
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = '⚠️ Inicia sesión en /paginas/ingreso.html (ej. estudiante1@demo.ec / Demo12345) para enviar intentos.';
        return;
      }

      try {
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = 'Enviando POST /api/intentos...';
        const res = await llamar('POST', '/api/intentos', {
          actividad: 'ahorcado',
          puntaje: 10,
          maximo: 10,
          errores: 0,
          duracionSeg: 25
        });
        resultadoGamificacion.textContent = '✔ Respuesta de POST /api/intentos:\n' + JSON.stringify(res, null, 2);
        aviso(`¡Intento registrado! Ganaste ${res.puntosGanados} puntos.`, 'exito');
      } catch (err) {
        resultadoGamificacion.textContent = '❌ Error al enviar intento:\n' + err.message;
        aviso(err.message, 'error');
      }
    });
  }

  if (btnConsultarLogros) {
    btnConsultarLogros.addEventListener('click', async () => {
      const u = usuarioActual();
      if (!u) {
        aviso('Debes iniciar sesión para consultar tus logros.', 'advertencia');
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = '⚠️ Inicia sesión en /paginas/ingreso.html para consultar tus logros.';
        return;
      }

      try {
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = 'Consultando GET /api/logros/yo...';
        const logros = await llamar('GET', '/api/logros/yo');
        resultadoGamificacion.textContent = '✔ Respuesta de GET /api/logros/yo:\n' + JSON.stringify(logros, null, 2);
        aviso('Logros consultados con éxito', 'info');
      } catch (err) {
        resultadoGamificacion.textContent = '❌ Error al consultar logros:\n' + err.message;
        aviso(err.message, 'error');
      }
    });
  }

  // Eventos para probar componentes P04.2
  const btnProbarRegistrarIntento = document.getElementById('btnProbarRegistrarIntento');
  const btnProbarRetro = document.getElementById('btnProbarRetro');
  const btnProbarResumen = document.getElementById('btnProbarResumen');
  const btnProbarSelectorTema = document.getElementById('btnProbarSelectorTema');
  const contenedorRetroPrueba = document.getElementById('contenedorRetroPrueba');

  if (btnProbarRegistrarIntento) {
    btnProbarRegistrarIntento.addEventListener('click', async () => {
      const u = usuarioActual();
      if (!u) {
        aviso('Inicia sesión para probar registrarIntento()', 'advertencia');
        return;
      }
      try {
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = 'Ejecutando registrarIntento({ actividad: "memoria", puntaje: 10, maximo: 10, errores: 0, duracionSeg: 15 })...';
        const res = await registrarIntento({
          actividad: 'memoria',
          puntaje: 10,
          maximo: 10,
          errores: 0,
          duracionSeg: 15
        });
        resultadoGamificacion.textContent = '✔ Resultado de registrarIntento():\n' + JSON.stringify(res, null, 2);
      } catch (err) {
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = '❌ Error al registrar intento: ' + err.message;
        aviso(err.message, 'error');
      }
    });
  }

  if (btnProbarRetro) {
    btnProbarRetro.addEventListener('click', () => {
      if (!contenedorRetroPrueba) return;
      contenedorRetroPrueba.innerHTML = '';
      const retro1 = mostrarRetro({
        correcto: true,
        explicacion: '¡Excelente! Los bucles for permiten iterar secuencias con un número fijo de repeticiones.',
        sugerencia: 'Puedes anidar bucles si requieres recorrer matrices.',
        enlaceTema: '/paginas/tema.html?id=tem_000001'
      });
      const retro2 = mostrarRetro({
        correcto: false,
        explicacion: 'Una condición booleana solo puede evaluarse como verdadera o falsa, no numérica.',
        sugerencia: 'Revisa las tablas de verdad y los operadores de comparación lógica.',
        enlaceTema: '/paginas/tema.html?id=tem_000001'
      });
      contenedorRetroPrueba.appendChild(retro1);
      contenedorRetroPrueba.appendChild(retro2);
      aviso('Paneles de retroalimentación generados abajo', 'info');
    });
  }

  if (btnProbarResumen) {
    btnProbarResumen.addEventListener('click', async () => {
      const decision = await mostrarResumen({
        titulo: 'Resultados del Desafío',
        aciertos: 8,
        errores: 2,
        recomendaciones: [
          'Repasa las estructuras condicionales anidadas.',
          'Practica con la actividad de Ahorcado para reforzar vocabulario técnico.'
        ],
        enlaceTema: '/paginas/tema.html?id=tem_000001'
      });
      aviso(`El usuario eligió: "${decision}"`, 'info');
      if (resultadoGamificacion) {
        resultadoGamificacion.style.display = 'block';
        resultadoGamificacion.textContent = `Resultado de mostrarResumen(): "${decision}"`;
      }
    });
  }

  if (btnProbarSelectorTema) {
    btnProbarSelectorTema.addEventListener('click', async () => {
      const tema = await obtenerTemaActividad();
      if (tema) {
        aviso(`Tema elegido: ${tema.titulo} (${tema.id})`, 'exito');
        if (resultadoGamificacion) {
          resultadoGamificacion.style.display = 'block';
          resultadoGamificacion.textContent = '✔ Tema seleccionado con obtenerTemaActividad():\n' + JSON.stringify(tema, null, 2);
        }
      } else {
        aviso('Selección cancelada o sin tema', 'advertencia');
      }
    });
  }

  // Evento para probar generarDiploma() de P05.2
  const btnGenerarDiploma = document.getElementById('btnGenerarDiploma');
  if (btnGenerarDiploma) {
    btnGenerarDiploma.addEventListener('click', async () => {
      const u = usuarioActual();
      if (!u) {
        aviso('Inicia sesión (ej. estudiante1@demo.ec / Demo12345) para generar diplomas.', 'advertencia');
        return;
      }

      try {
        if (resultadoGamificacion) {
          resultadoGamificacion.style.display = 'block';
          resultadoGamificacion.textContent = 'Generando certificado y construyendo PDF con jsPDF...';
        }
        const { codigo } = await generarDiploma({ tipo: 'cumplimiento' });
        aviso(`¡Diploma generado y descargado! Código: ${codigo}`, 'exito');
        if (resultadoGamificacion) {
          resultadoGamificacion.innerHTML = `
            ✔ <strong>Diploma generado y descargado con éxito:</strong><br>
            • Código de certificado: <code>${codigo}</code><br>
            • Archivo: <code>diploma-${codigo}.pdf</code><br>
            • <a href="/paginas/verificar.html?codigo=${encodeURIComponent(codigo)}" target="_blank" style="color: var(--color-acento); font-weight: bold; text-decoration: underline;">
                🔗 Hacer clic aquí para validar este certificado en vivo
              </a>
          `;
        }
      } catch (err) {
        aviso(err.message || 'Error al generar diploma', 'error');
        if (resultadoGamificacion) {
          resultadoGamificacion.style.display = 'block';
          resultadoGamificacion.textContent = '❌ Error al generar diploma: ' + err.message;
        }
      }
    });
  }

  // Carga inicial
  await cargarRegistros();
}


