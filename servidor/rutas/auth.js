import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 fallos por correo en 15 minutos)
const fallosPorCorreo = new Map();
const VENTANA_FALLOS_MS = 15 * 60 * 1000;
const MAX_FALLOS = 5;

function registrarFallo(correoNorm) {
  if (!correoNorm) return;
  const ahora = Date.now();
  const intentos = (fallosPorCorreo.get(correoNorm) || []).filter(t => ahora - t < VENTANA_FALLOS_MS);
  intentos.push(ahora);
  fallosPorCorreo.set(correoNorm, intentos);
}

function esBloqueado(correoNorm) {
  if (!correoNorm) return false;
  const ahora = Date.now();
  const intentos = (fallosPorCorreo.get(correoNorm) || []).filter(t => ahora - t < VENTANA_FALLOS_MS);
  fallosPorCorreo.set(correoNorm, intentos);
  return intentos.length >= MAX_FALLOS;
}

function limpiarFallos(correoNorm) {
  if (correoNorm) {
    fallosPorCorreo.delete(correoNorm);
  }
}

function validarClave(clave) {
  return typeof clave === 'string' && clave.length >= 8 && /[a-zA-Z]/.test(clave) && /[0-9]/.test(clave);
}

// POST /auth/registro
router.post('/auth/registro', async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }

    const correoNorm = (correo || '').trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correoNorm)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    const usuarios = await almacen.leer('usuarios');
    const existente = usuarios.find(u => u && u.correo && u.correo.toLowerCase() === correoNorm);
    if (existente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    if (!validarClave(clave)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar el consentimiento para registrarse' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const fecha = new Date().toISOString();

    const nuevoUsuario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoUsuario);
    const { claveHash: _, ...usuarioSinHash } = creado;

    res.status(201).json(usuarioSinHash);
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, clave } = req.body || {};
    const correoNorm = (correo || '').trim().toLowerCase();

    if (esBloqueado(correoNorm)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.' });
    }

    if (!correoNorm || !clave) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => {
      if (!u || !u.correo) return false;
      const c = u.correo.toLowerCase();
      if (c === correoNorm) return true;
      if (Array.isArray(u.correosAlternativos) && u.correosAlternativos.some(alt => (alt || '').toLowerCase() === correoNorm)) return true;
      return false;
    });

    if (!usuario || usuario.activo === false) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Solo vale la clave guardada (hash); no hay claves por defecto.
    const coincide = typeof clave === 'string' && usuario.claveHash ? await bcrypt.compare(clave, usuario.claveHash) : false;

    if (!coincide) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Login exitoso: restablecer intentos fallidos
    limpiarFallos(correoNorm);

    // Crear sesión (32 bytes aleatorios en hex, 8 horas)
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Registrar en bitácora automáticamente
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    const infoUsuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      correo: usuario.correo,
      foto: usuario.foto || null
    };

    res.json({ token, usuario: infoUsuario });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
router.post('/auth/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find(s => s && s.token === token);
      if (sesion) {
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// GET /auth/yo
router.get('/auth/yo', exigirRol(), async (req, res, next) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === req.usuario.id);

    if (!usuario || usuario.activo === false) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const { claveHash, ...datos } = usuario;
    res.json(datos);
  } catch (error) {
    next(error);
  }
});

// PUT /auth/perfil { nombre, apellido, foto }
router.put('/auth/perfil', exigirRol(), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body || {};
    const cambios = {};

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      cambios.nombre = nombre.trim();
    }

    if (apellido !== undefined) {
      if (typeof apellido !== 'string' || !apellido.trim()) {
        return res.status(400).json({ error: 'El apellido no puede estar vacío' });
      }
      cambios.apellido = apellido.trim();
    }

    if (foto !== undefined) {
      // Solo una ruta de la plataforma (p. ej., una subida) o una dirección https; vacío quita la foto.
      if (foto !== null && foto !== '' && !(typeof foto === 'string' && foto.length <= 300 && /^(https:\/\/|\/(?!\/))/i.test(foto))) {
        return res.status(400).json({ error: 'La foto debe ser una imagen subida a la plataforma' });
      }
      cambios.foto = foto || null;
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    const { claveHash, ...datos } = actualizado;

    res.json(datos);
  } catch (error) {
    next(error);
  }
});

// POST /auth/clave { actual, nueva }
router.post('/auth/clave', exigirRol(), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};

    if (!actual || !nueva) {
      return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva contraseña' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = usuario.claveHash ? await bcrypt.compare(actual, usuario.claveHash) : false;
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    if (!validarClave(nueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// POST /admin/usuarios/:id/restablecer (admin)
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Clave temporal aleatoria de 10 caracteres alfanuméricos
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(10);
    let claveTemporal = '';
    for (let i = 0; i < 10; i++) {
      claveTemporal += chars[bytes[i] % chars.length];
    }
    // Asegurar que contenga letras y números
    if (!/[a-zA-Z]/.test(claveTemporal)) claveTemporal = 'A' + claveTemporal.slice(1);
    if (!/[0-9]/.test(claveTemporal)) claveTemporal = claveTemporal.slice(0, 9) + '7';

    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', id, { claveHash });

    res.json({ claveTemporal });
  } catch (error) {
    next(error);
  }
});

// POST /eventos { tipo, recurso }
router.post('/eventos', async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body || {};

    if (!tipo || typeof tipo !== 'string' || !recurso || typeof recurso !== 'string') {
      return res.status(400).json({ error: 'Los campos tipo y recurso son obligatorios' });
    }

    const fecha = new Date().toISOString();
    const evento = {
      usuarioId: req.usuario ? req.usuario.id : null,
      tipo,
      recurso,
      fecha
    };

    await almacen.anexarLinea('bitacora.jsonl', evento);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
