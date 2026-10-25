/**
 * servidor/rutas/ia.js
 * POST /ia/:tarea carga el preparador de la tarea y llama al servicio de IA.
 * El navegador solo envía datos; las instrucciones viven en servidor/prompts/.
 */

import { Router } from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ejecutarTarea, probarConexion } from '../ia.js';
import { exigirRol } from '../auth.js';

const router = Router();

const FORMATO_TEXTO = ['tutor', 'rol-simulacion'];

// GET /ia/prueba (admin) → confirma que la conexión con la IA funciona
router.get('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    res.json({ respuesta: await probarConexion(req.usuario) });
  } catch (error) {
    next(error);
  }
});

// POST /ia/:tarea → generar-* solo docente y admin; el resto, con sesión
router.post('/ia/:tarea', async (req, res, next) => {
  try {
    const { tarea } = req.params;
    if (!/^[a-z-]+$/.test(tarea)) return res.status(404).json({ error: 'Tarea de IA no encontrada' });
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (tarea.startsWith('generar-') && !['docente', 'admin'].includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    let preparador;
    try {
      preparador = (await import(pathToFileURL(path.resolve('servidor', 'preparadores', `${tarea}.js`)).href)).default;
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') return res.status(404).json({ error: 'Tarea de IA no encontrada' });
      throw e;
    }

    const datos = await preparador(req.body || {}, req.usuario);
    const formato = FORMATO_TEXTO.includes(tarea) ? 'texto' : 'json';
    const resultado = await ejecutarTarea(tarea, datos, req.usuario, { formato });
    res.json(formato === 'texto' ? { texto: resultado } : resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
