import * as almacen from './almacen.js';

/**
 * Limpia de la colección de sesiones aquellas cuya fecha de expiración haya pasado.
 */
export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date();
    const validas = sesiones.filter(s => s && s.expira && new Date(s.expira) > ahora);
    if (validas.length !== sesiones.length) {
      await almacen.escribir('sesiones', validas);
    }
  } catch (error) {
    console.error('Error al limpiar sesiones vencidas:', error);
  }
}

// Al cargarse el módulo, borra las sesiones vencidas
limpiarSesionesVencidas();

/**
 * Middleware que lee el encabezado "Authorization: Bearer <token>",
 * valida su vencimiento y asigna req.usuario = { id, nombre, apellido, rol } o null.
 */
export async function cargarUsuario(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      req.usuario = null;
      return next();
    }

    const sesiones = await almacen.leer('sesiones');
    const sesion = sesiones.find(s => s && s.token === token);

    if (!sesion || !sesion.expira || new Date(sesion.expira) <= new Date()) {
      req.usuario = null;
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === sesion.usuarioId);

    if (!usuario || usuario.activo === false) {
      req.usuario = null;
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };

    next();
  } catch (error) {
    req.usuario = null;
    next();
  }
}

/**
 * Middleware que exige una sesión válida y restringe por roles.
 * Responde 401 si no hay sesión y 403 si el rol del usuario no está permitido.
 * Si roles contiene "sesion" o está vacío, cualquier usuario autenticado es admitido.
 * @param  {...string} roles
 */
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (roles.length > 0) {
      const permitido = roles.includes('sesion') || roles.includes(req.usuario.rol);
      if (!permitido) {
        return res.status(403).json({ error: 'Acceso no autorizado' });
      }
    }

    next();
  };
}
