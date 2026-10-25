// publico/js/modulos/registro.js
// Módulo de registro de usuarios con validación en vivo y sesión automática

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Registro de usuario', roles: ['publico'] });

// Si el usuario ya tiene sesión activa, redirigir a inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="auth-contenedor">
      <div class="auth-tarjeta">
        <header class="auth-header">
          <h1>Crear una cuenta</h1>
          <p>Únete a la plataforma para acceder a tus contenidos y actividades educativas</p>
        </header>

        <form id="formRegistro" class="auth-formulario" novalidate>
          <div class="campo" id="campoNombre">
            <label for="nombre">Nombre <span class="requerido" aria-hidden="true">*</span></label>
            <input type="text" id="nombre" name="nombre" required autocomplete="given-name" placeholder="Tu nombre">
            <span class="campo__error" id="errorNombre" role="alert"></span>
          </div>

          <div class="campo" id="campoApellido">
            <label for="apellido">Apellido <span class="requerido" aria-hidden="true">*</span></label>
            <input type="text" id="apellido" name="apellido" required autocomplete="family-name" placeholder="Tu apellido">
            <span class="campo__error" id="errorApellido" role="alert"></span>
          </div>

          <div class="campo" id="campoCorreo">
            <label for="correo">Correo electrónico <span class="requerido" aria-hidden="true">*</span></label>
            <input type="email" id="correo" name="correo" required autocomplete="email" placeholder="ejemplo@educacion.ec">
            <span class="campo__error" id="errorCorreo" role="alert"></span>
          </div>

          <div class="campo" id="campoClave">
            <label for="clave">Contraseña <span class="requerido" aria-hidden="true">*</span></label>
            <input type="password" id="clave" name="clave" required autocomplete="new-password" placeholder="Mínimo 8 caracteres">
            <span class="campo__ayuda">Debe contener al menos 8 caracteres, combinando letras y números.</span>
            <span class="campo__error" id="errorClave" role="alert"></span>
          </div>

          <div class="campo campo--checkbox" id="campoConsentimiento">
            <label class="checkbox-etiqueta" for="consentimiento">
              <input type="checkbox" id="consentimiento" name="consentimiento" required>
              <span>Acepto el <a href="/paginas/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a> y tratamiento de datos <span class="requerido" aria-hidden="true">*</span></span>
            </label>
            <span class="campo__error" id="errorConsentimiento" role="alert"></span>
          </div>

          <button type="submit" id="btnSubmit" class="btn btn--primario btn--bloque">
            Registrarse
          </button>
        </form>

        <div class="auth-pie">
          <p>¿Ya tienes una cuenta registrada? <a href="/paginas/ingreso.html">Inicia sesión aquí</a></p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('formRegistro');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const inputConsentimiento = document.getElementById('consentimiento');
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

  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) {
      establecerError('campoNombre', 'errorNombre', 'El nombre es obligatorio.');
      return false;
    }
    if (val.length < 2) {
      establecerError('campoNombre', 'errorNombre', 'El nombre debe tener al menos 2 caracteres.');
      return false;
    }
    establecerError('campoNombre', 'errorNombre', '');
    return true;
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) {
      establecerError('campoApellido', 'errorApellido', 'El apellido es obligatorio.');
      return false;
    }
    if (val.length < 2) {
      establecerError('campoApellido', 'errorApellido', 'El apellido debe tener al menos 2 caracteres.');
      return false;
    }
    establecerError('campoApellido', 'errorApellido', '');
    return true;
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      establecerError('campoCorreo', 'errorCorreo', 'El correo electrónico es obligatorio.');
      return false;
    }
    if (!REGEX_CORREO.test(val)) {
      establecerError('campoCorreo', 'errorCorreo', 'Ingresa una dirección de correo válida.');
      return false;
    }
    establecerError('campoCorreo', 'errorCorreo', '');
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      establecerError('campoClave', 'errorClave', 'La contraseña es obligatoria.');
      return false;
    }
    if (val.length < 8) {
      establecerError('campoClave', 'errorClave', 'La contraseña debe tener al menos 8 caracteres.');
      return false;
    }
    if (!/[a-zA-Z]/.test(val) || !/[0-9]/.test(val)) {
      establecerError('campoClave', 'errorClave', 'La contraseña debe incluir al menos una letra y un número.');
      return false;
    }
    establecerError('campoClave', 'errorClave', '');
    return true;
  }

  function validarConsentimiento() {
    if (!inputConsentimiento.checked) {
      establecerError('campoConsentimiento', 'errorConsentimiento', 'Debes aceptar el aviso de privacidad.');
      return false;
    }
    establecerError('campoConsentimiento', 'errorConsentimiento', '');
    return true;
  }

  // Validación en vivo
  inputNombre.addEventListener('input', validarNombre);
  inputNombre.addEventListener('blur', validarNombre);

  inputApellido.addEventListener('input', validarApellido);
  inputApellido.addEventListener('blur', validarApellido);

  inputCorreo.addEventListener('input', validarCorreo);
  inputCorreo.addEventListener('blur', validarCorreo);

  inputClave.addEventListener('input', validarClave);
  inputClave.addEventListener('blur', validarClave);

  inputConsentimiento.addEventListener('change', validarConsentimiento);

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okConsentimiento = validarConsentimiento();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okConsentimiento) {
      if (!okNombre) inputNombre.focus();
      else if (!okApellido) inputApellido.focus();
      else if (!okCorreo) inputCorreo.focus();
      else if (!okClave) inputClave.focus();
      else if (!okConsentimiento) inputConsentimiento.focus();
      return;
    }

    // Deshabilitar botón mientras envía
    btnSubmit.disabled = true;
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.textContent = 'Registrando...';
    ui.cargando(true);

    try {
      await sesion.registrar({
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        correo: inputCorreo.value.trim().toLowerCase(),
        clave: inputClave.value,
        consentimiento: true
      });

      ui.aviso('¡Cuenta creada con éxito! Bienvenido al ecosistema.', 'exito');

      // Tras registrar e iniciar sesión, redirigir a inicio
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 300);
    } catch (error) {
      ui.cargando(false);
      btnSubmit.disabled = false;
      btnSubmit.textContent = textoOriginal;
      ui.aviso(error.message || 'No se pudo completar el registro. Intente de nuevo.', 'error');
    }
  });
}
