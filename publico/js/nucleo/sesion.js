// publico/js/nucleo/sesion.js
// Manejo de sesión de usuario en el navegador (sessionStorage)

import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Obtiene el token de autenticación guardado en sessionStorage (con respaldo en localStorage entre pestañas).
 * @returns {string|null}
 */
export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  let tok = sessionStorage.getItem('token');
  if (!tok && typeof localStorage !== 'undefined') {
    tok = localStorage.getItem('token');
    if (tok) {
      sessionStorage.setItem('token', tok);
    }
  }
  return tok;
}

/**
 * Obtiene el usuario actual en sesión desde sessionStorage (con respaldo en localStorage entre pestañas).
 * @returns {{ id: string, nombre: string, apellido: string, rol: string }|null}
 */
export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    let raw = sessionStorage.getItem('usuario');
    if (!raw && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem('usuario');
      if (raw) {
        sessionStorage.setItem('usuario', raw);
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Inicia sesión enviando credenciales a /api/auth/login y guardando token y usuario.
 * @param {string} correo
 * @param {string} clave
 * @returns {Promise<Object>} Usuario autenticado
 */
export async function iniciar(correo, clave) {
  const respuesta = await api.llamar('POST', '/api/auth/login', { correo, clave });
  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem('token', respuesta.token);
    sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', respuesta.token);
      localStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    }
    return respuesta.usuario;
  }
  throw new Error('Respuesta inválida del servidor al iniciar sesión');
}


/**
 * Registra un nuevo usuario en /api/auth/registro e inicia sesión automáticamente.
 * @param {Object} datos - { nombre, apellido, correo, clave, consentimiento }
 * @returns {Promise<Object>} Usuario registrado
 */
export async function registrar(datos) {
  const usuarioCreado = await api.llamar('POST', '/api/auth/registro', datos);
  if (datos.correo && datos.clave) {
    try {
      await iniciar(datos.correo, datos.clave);
    } catch (err) {
      console.warn('Registro exitoso, pero falló el inicio automático de sesión:', err);
    }
  }
  return usuarioCreado;
}

/**
 * Cierra la sesión activa en el servidor y limpia sessionStorage.
 */
export async function cerrar() {
  try {
    await api.llamar('POST', '/api/auth/logout');
  } catch (err) {
    console.warn('Error al cerrar sesión en el servidor:', err);
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/index.html';
    }
  }
}


/**
 * Valida los roles permitidos para la página actual.
 * - Sin sesión → redirige a /paginas/ingreso.html.
 * - Rol no permitido → redirige a /index.html con un aviso.
 * @param {Array<string>|string} roles
 * @returns {boolean} true si el acceso es permitido, false si redirige.
 */
export function exigirRol(roles = []) {
  const listaRoles = Array.isArray(roles) ? roles : (roles ? [roles] : []);
  if (listaRoles.length === 0 || listaRoles.includes('publico')) {
    return true;
  }

  const tok = token();
  const usuario = usuarioActual();

  if (!tok || !usuario) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
    return false;
  }

  const permitido = listaRoles.includes('sesion') || (usuario.rol && listaRoles.includes(usuario.rol));
  if (!permitido) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: 'No tienes permisos suficientes para acceder a esta página.',
        tipo: 'advertencia'
      }));
    }
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
        window.location.href = '/index.html';
      } else {
        ui.aviso('No tienes permisos suficientes para acceder a esta página.', 'advertencia');
      }
    }
    return false;
  }

  return true;
}

export default {
  token,
  usuarioActual,
  iniciar,
  registrar,
  cerrar,
  exigirRol
};
