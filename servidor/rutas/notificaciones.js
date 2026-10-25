/**
 * servidor/rutas/notificaciones.js
 * Centro de notificaciones: cada persona ve y marca las suyas; docente y admin envían mensajes.
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';
import { notificar } from '../notificar.js';

const router = Router();
const MAX_LISTA = 30;
const MAX_MENSAJE = 500;

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

function exigirSesion(req) {
  if (!req.usuario) throw fallo('No autenticado', 401);
}

// Los enlaces deben ser rutas de esta plataforma: nada de http://… ni javascript:…
function enlaceValido(enlace) {
  if (enlace === undefined || enlace === null || enlace === '') return null;
  if (typeof enlace !== 'string' || enlace.length > 300 || !/^\/(?!\/)[^\s]*$/.test(enlace)) {
    throw fallo('El enlace debe ser una ruta interna de la plataforma', 400);
  }
  return enlace;
}

// GET /notificaciones → { notificaciones (mis 30 más recientes), noLeidas (total) }
router.get('/notificaciones', async (req, res, next) => {
  try {
    exigirSesion(req);
    const mias = await almacen.buscar('notificaciones', { usuarioId: req.usuario.id });
    mias.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    res.json({
      notificaciones: mias.slice(0, MAX_LISTA),
      noLeidas: mias.filter((n) => !n.leida).length
    });
  } catch (error) {
    next(error);
  }
});

// POST /notificaciones { usuarioId, mensaje, enlace } → mensaje del docente a sus estudiantes (admin: a cualquiera)
router.post('/notificaciones', async (req, res, next) => {
  try {
    exigirSesion(req);
    if (req.usuario.rol !== 'docente' && req.usuario.rol !== 'admin') {
      throw fallo('Solo docentes y administradores envían mensajes', 403);
    }
    const { usuarioId, mensaje } = req.body || {};
    if (typeof usuarioId !== 'string' || !usuarioId) throw fallo('Falta el destinatario', 400);
    if (typeof mensaje !== 'string' || !mensaje.trim()) throw fallo('Escribe el mensaje', 400);
    if (mensaje.trim().length > MAX_MENSAJE) throw fallo(`El mensaje supera los ${MAX_MENSAJE} caracteres`, 400);
    const enlace = enlaceValido(req.body.enlace);

    const destino = (await almacen.leer('usuarios')).find((u) => u.id === usuarioId);
    if (!destino || destino.activo === false) throw fallo('Destinatario no encontrado', 404);
    if (req.usuario.rol === 'docente' && !(await estudiantesDe(req.usuario.id)).includes(usuarioId)) {
      throw fallo('Solo puedes escribir a tus estudiantes', 403);
    }

    const creada = await notificar(usuarioId, { tipo: 'mensaje-docente', mensaje: mensaje.trim(), enlace });
    res.status(201).json(creada);
  } catch (error) {
    next(error);
  }
});

// POST /notificaciones/leidas → marca todas las mías como leídas
router.post('/notificaciones/leidas', async (req, res, next) => {
  try {
    exigirSesion(req);
    const pendientes = (await almacen.buscar('notificaciones', { usuarioId: req.usuario.id })).filter((n) => !n.leida);
    for (const n of pendientes) await almacen.actualizar('notificaciones', n.id, { leida: true });
    res.json({ marcadas: pendientes.length, noLeidas: 0 });
  } catch (error) {
    next(error);
  }
});

// POST /notificaciones/:id/leida → marca una (solo si es mía)
router.post('/notificaciones/:id/leida', async (req, res, next) => {
  try {
    exigirSesion(req);
    const n = (await almacen.leer('notificaciones')).find((x) => x.id === req.params.id);
    if (!n || n.usuarioId !== req.usuario.id) throw fallo('Notificación no encontrada', 404);
    if (!n.leida) await almacen.actualizar('notificaciones', n.id, { leida: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
