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
import * as almacen from '../almacen.js';

const router = Router();

const FORMATO_TEXTO = ['tutor', 'rol-simulacion'];
const MAX_RESPUESTA_TUTOR = 700;
const MAX_RESPUESTA_ROL = 700;
const ZONA = 'America/Guayaquil'; // el "día" del tutor es el día de Ecuador

// Recorta a un máximo de caracteres, preferiblemente en el final de una oración.
export function recortar(texto, max) {
  const limpio = String(texto).trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const fin = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '), corte.lastIndexOf('! '), corte.lastIndexOf('.\n'));
  return fin > max * 0.6 ? corte.slice(0, fin + 1) : `${corte.slice(0, max - 1).trimEnd()}…`;
}

// La IA puede equivocarse con los puntos: se ajustan a la rúbrica real de la simulación.
export function ajustarEvaluacion(evaluacion, rubrica) {
  const norm = (t) => String(t ?? '').trim().toLowerCase();
  const criterios = rubrica.map((r, i) => {
    const dado = evaluacion.criterios.find((c) => norm(c?.criterio) === norm(r.criterio)) || evaluacion.criterios[i] || {};
    const puntos = Math.round(Number(dado.puntos));
    return {
      criterio: r.criterio,
      puntos: Number.isFinite(puntos) ? Math.max(0, Math.min(r.puntos, puntos)) : 0,
      maximo: r.puntos,
      comentario: typeof dado.comentario === 'string' ? dado.comentario.trim() : ''
    };
  });
  return {
    criterios,
    puntaje: criterios.reduce((s, c) => s + c.puntos, 0),
    maximo: criterios.reduce((s, c) => s + c.maximo, 0),
    comentarioGeneral: evaluacion.comentarioGeneral
  };
}

// Una fila por persona, tema y día, con el número de consultas; en serie para no perder cuentas.
let colaConsultas = Promise.resolve();
function registrarConsultaTutor(usuarioId, temaId) {
  const tarea = colaConsultas.then(async () => {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date()); // AAAA-MM-DD
    const existente = (await almacen.buscar('consultas-tutor', { usuarioId, temaId, dia }))[0];
    if (existente) await almacen.actualizar('consultas-tutor', existente.id, { mensajes: (existente.mensajes || 0) + 1 });
    else await almacen.agregar('consultas-tutor', { usuarioId, temaId, dia, mensajes: 1 });
  });
  colaConsultas = tarea.catch(() => {});
  return tarea;
}

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

    if (tarea === 'tutor') {
      // Solo se cuenta la consulta (sin textos) cuando el tutor sí respondió.
      await registrarConsultaTutor(req.usuario.id, req.body.temaId).catch((e) => console.warn('Tutor: no se pudo registrar el uso:', e.message));
      return res.json({ respuesta: recortar(resultado, MAX_RESPUESTA_TUTOR) });
    }
    if (tarea === 'rol-simulacion') return res.json({ texto: recortar(resultado, MAX_RESPUESTA_ROL) });
    if (tarea === 'evaluar-rol') return res.json(ajustarEvaluacion(resultado, datos._rubrica));
    res.json(formato === 'texto' ? { texto: resultado } : resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
