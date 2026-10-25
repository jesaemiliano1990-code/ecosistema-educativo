/**
 * servidor/rutas/gamificacion.js
 * Rutas de gamificación: registro de intentos y consulta de logros
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';

const router = Router();

// POST /intentos (y /api/intentos)
router.post('/intentos', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(201).json(resultado);
  } catch (error) {
    const estado = error.estado || 400;
    res.status(estado).json({ error: error.message });
  }
});

// GET /logros/:usuarioId (y /api/logros/:usuarioId)
router.get('/logros/:usuarioId', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    let objetivoId = req.params.usuarioId;
    if (objetivoId === 'yo') {
      objetivoId = req.usuario.id;
    }

    // Permisos: propio usuario, admin, o docente de sus grupos
    if (req.usuario.rol === 'admin' || objetivoId === req.usuario.id) {
      // Acceso concedido
    } else if (req.usuario.rol === 'docente') {
      const misEstudiantes = await estudiantesDe(req.usuario.id);
      const setEst = new Set(misEstudiantes);
      if (!setEst.has(objetivoId)) {
        return res.status(403).json({ error: 'No tienes permiso para consultar los logros de este estudiante' });
      }
    } else {
      return res.status(403).json({ error: 'No tienes permiso para consultar estos logros' });
    }

    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find(l => l && l.usuarioId === objetivoId);

    if (!logro) {
      return res.json({
        usuarioId: objetivoId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      });
    }

    res.json(logro);
  } catch (error) {
    next(error);
  }
});

export default router;
