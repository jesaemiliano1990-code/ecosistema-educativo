/**
 * servidor/rutas/agenda.js
 * GET /agenda/recordatorios: crea las notificaciones de los avisos de agenda que ya llegaron.
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { notificar } from '../notificar.js';

const router = Router();

const ZONA = 'America/Guayaquil'; // Ecuador no tiene horario de verano: UTC-05:00 fijo
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Todos los usuarios comparten un candado: el campo "avisados" es de todo el evento y dos personas
// consultando a la vez podrían pisarse al guardar.
let cola = Promise.resolve();
function enSerie(tarea) {
  const siguiente = cola.then(tarea, tarea);
  cola = siguiente.catch(() => {});
  return siguiente;
}

// Los eventos de todo el día empiezan a las 00:00 de Ecuador.
function inicioEn(evento) {
  return new Date(SOLO_FECHA.test(evento.inicio) ? `${evento.inicio}T00:00:00-05:00` : evento.inicio).getTime();
}

function cuando(ms) {
  const minutos = Math.max(1, Math.round(ms / 60000));
  if (minutos < 60) return `en ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `en ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.round(horas / 24);
  return `en ${dias} día${dias === 1 ? '' : 's'}`;
}

function textoFecha(evento) {
  const opciones = SOLO_FECHA.test(evento.inicio)
    ? { dateStyle: 'full', timeZone: ZONA }
    : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA };
  return new Intl.DateTimeFormat('es-EC', opciones).format(new Date(inicioEn(evento)));
}

// Eventos propios y de los grupos donde la persona es docente o estudiante (el admin no recibe los de todos).
async function eventosDe(usuario) {
  const grupos = (await almacen.leer('distributivo')).filter(
    (g) => g && (g.docenteId === usuario.id || (Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)))
  );
  const ids = new Set(grupos.map((g) => g.id));
  return (await almacen.leer('agenda')).filter(
    (e) => e && Array.isArray(e.recordatorios) && e.recordatorios.length && (e.propietarioId === usuario.id || (e.grupoId && ids.has(e.grupoId)))
  );
}

async function procesar(usuario) {
  const ahora = Date.now();
  const creados = [];

  for (const evento of await eventosDe(usuario)) {
    const inicio = inicioEn(evento);
    if (!Number.isFinite(inicio) || inicio <= ahora) continue; // los eventos que ya empezaron no avisan

    const avisados = { ...(evento.avisados || {}) };
    const mios = new Set((avisados[usuario.id] || []).map(Number));
    // Si llegaron varios avisos a la vez (p. ej., "1 día" y "1 hora"), se envía solo el más cercano al evento.
    const pendientes = evento.recordatorios.map(Number).filter((m) => ahora >= inicio - m * 60000 && !mios.has(m));
    if (!pendientes.length) continue;
    const minutos = Math.min(...pendientes);

    const notificacion = await notificar(usuario.id, {
      tipo: 'recordatorio',
      mensaje: `Recordatorio: "${evento.titulo}" empieza ${cuando(inicio - ahora)} (${textoFecha(evento)}).`,
      enlace: '/paginas/agenda.html'
    });
    avisados[usuario.id] = [...new Set([...mios, ...pendientes])];
    await almacen.actualizar('agenda', evento.id, { avisados });

    creados.push({ eventoId: evento.id, titulo: evento.titulo, minutos, mensaje: notificacion.mensaje, notificacionId: notificacion.id });
  }
  return creados;
}

// GET /agenda/recordatorios → [{ eventoId, titulo, minutos, mensaje, notificacionId }] (solo los nuevos)
router.get('/agenda/recordatorios', async (req, res, next) => {
  try {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    res.json(await enSerie(() => procesar(req.usuario)));
  } catch (error) {
    next(error);
  }
});

export default router;
