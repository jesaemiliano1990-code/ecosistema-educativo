// publico/js/modulos/ingreso.js
// Módulo de inicio de sesión con validación en vivo y redirección a inicio

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Iniciar sesión', roles: ['publico'] });

// Si ya está autenticado, redirigir a inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="auth-contenedor">
      <div class="auth-tarjeta">
        <header class="auth-header">
          <h1>Iniciar sesión</h1>
          <p>Ingresa tus credenciales para acceder a tus contenidos y actividades</p>
        </header>

        <form id="formIngreso" class="auth-formulario" novalidate>
          <div class="campo" id="campoCorreo">
            <label for="correo">Correo electrónico</label>
            <input type="email" id="correo" name="correo" required autocomplete="email" placeholder="ejemplo@educacion.ec">
            <span class="campo__error" id="errorCorreo" role="alert"></span>
          </div>

          <div class="campo" id="campoClave">
            <label for="clave">Contraseña</label>
            <input type="password" id="clave" name="clave" required autocomplete="current-password" placeholder="Tu contraseña">
            <span class="campo__error" id="errorClave" role="alert"></span>
          </div>

          <button type="submit" id="btnSubmit" class="btn btn--primario btn--bloque">
            Ingresar
          </button>
        </form>

        <div class="auth-pie">
          <p>¿No tienes una cuenta aún? <a href="/paginas/registro.html">Regístrate aquí</a></p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('formIngreso');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const btnSubmit = document.getElementById('btnSubmit');

  const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function establecerError(campoId, errorId, mensaje) {
    const contenedor = document.getElementById(campoId);
    const spanError = document.getElementById(errorId);
    if (!contenedor || !spanError) return;

    if (mensaje) {
      contenedor.classList.add('campo--error');
      spanError.textContent = mensaje;
    } else {
      contenedor.classList.remove('campo--error');
      spanError.textContent = '';
    }
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      establecerError('campoCorreo', 'errorCorreo', 'Ingresa tu correo electrónico.');
      return false;
    }
    if (!REGEX_CORREO.test(val)) {
      establecerError('campoCorreo', 'errorCorreo', 'Ingresa un correo electrónico válido.');
      return false;
    }
    establecerError('campoCorreo', 'errorCorreo', '');
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      establecerError('campoClave', 'errorClave', 'Ingresa tu contraseña.');
      return false;
    }
    establecerError('campoClave', 'errorClave', '');
    return true;
  }

  // Validación en vivo
  inputCorreo.addEventListener('input', validarCorreo);
  inputCorreo.addEventListener('blur', validarCorreo);

  inputClave.addEventListener('input', validarClave);
  inputClave.addEventListener('blur', validarClave);

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      if (!okCorreo) inputCorreo.focus();
      else if (!okClave) inputClave.focus();
      return;
    }

    // Deshabilitar botón mientras envía
    btnSubmit.disabled = true;
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.textContent = 'Ingresando...';
    ui.cargando(true);

    try {
      const correo = inputCorreo.value.trim().toLowerCase();
      const clave = inputClave.value;

      await sesion.iniciar(correo, clave);

      ui.aviso('Has iniciado sesión con éxito.', 'exito');

      // Redirigir a inicio tras ingresar
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 300);
    } catch (error) {
      ui.cargando(false);
      btnSubmit.disabled = false;
      btnSubmit.textContent = textoOriginal;
      ui.aviso(error.message || 'No se pudo iniciar sesión. Verifique sus credenciales.', 'error');
    }
  });
}
