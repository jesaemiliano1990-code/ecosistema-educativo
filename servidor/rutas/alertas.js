/**
 * servidor/rutas/alertas.js
 * Rutas para la consulta y gestión de alertas tempranas pedagógicas
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';

const router = Router();

// GET /alertas?grupoId= (docente del grupo o admin) → { alertas, mensajesApoyo }
router.get('/alertas', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.usuario.rol !== 'docente' && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const { grupoId } = req.query;

    const [distributivo, todasAlertas, confAlertas] = await Promise.all([
      almacen.leer('distributivo'),
      almacen.leer('alertas'),
      almacen.leerConfig('reglas-alertas')
    ]);

    let alertas = [];

    if (grupoId) {
      const grupo = distributivo.find(g => g && g.id === grupoId);
      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      // Si es docente, debe ser el docente de dicho grupo
      if (req.usuario.rol === 'docente' && grupo.docenteId !== req.usuario.id) {
        return res.status(403).json({ error: 'Acceso no autorizado a este grupo' });
      }

      alertas = todasAlertas.filter(a => a && a.grupoId === grupoId);
    } else {
      if (req.usuario.rol === 'admin') {
        alertas = todasAlertas;
      } else {
        const misGruposIds = new Set(distributivo.filter(g => g && g.docenteId === req.usuario.id).map(g => g.id));
        alertas = todasAlertas.filter(a => a && misGruposIds.has(a.grupoId));
      }
    }

    const mensajesApoyo = Array.isArray(confAlertas?.mensajesApoyo) ? confAlertas.mensajesApoyo : [];

    res.json({
      alertas,
      mensajesApoyo
    });
  } catch (error) {
    next(error);
  }
});

export default router;
