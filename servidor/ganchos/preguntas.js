import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';
import { normalizarPregunta } from '../esquemas-ia.js';

/**
 * Gancho para la colección 'preguntas' (banco del quiz). Los estudiantes nunca la leen (permisos.json).
 */

const ESTADOS = ['aprobado', 'borrador'];
const ORIGENES = ['docente', 'ia'];

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

async function exigirEdicion(usuario, temaId) {
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) {
    throw fallo('No tienes permiso para editar las preguntas de esta asignatura', 403);
  }
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente') return [];

  const unidades = new Map((await almacen.leer('unidades')).map((u) => [u.id, u.asignaturaId]));
  const temas = new Map((await almacen.leer('temas')).map((t) => [t.id, unidades.get(t.unidadId)]));
  const misIds = new Set((await asignaturasDe(usuario)).map((a) => (typeof a === 'string' ? a : a?.id)).filter(Boolean));
  return lista.filter((p) => p && misIds.has(temas.get(p.temaId)));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) throw fallo('temaId es requerido', 400);
  // Si la pregunta cambia de tema, debe poder editar ambos.
  await exigirEdicion(usuario, temaId);
  if (anterior) await exigirEdicion(usuario, anterior.temaId);

  const unida = { ...(anterior || {}), ...datos };
  const nivel = Number(unida.nivel);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) throw fallo('El nivel debe estar entre 1 y 5', 400);

  let pregunta;
  try {
    pregunta = normalizarPregunta(unida);
  } catch (e) {
    throw fallo(e.message, 400);
  }

  const estado = unida.estado ?? 'aprobado';
  const origen = anterior?.origen ?? unida.origen ?? 'docente';
  if (!ESTADOS.includes(estado)) throw fallo('Estado de pregunta no válido', 400);
  if (!ORIGENES.includes(origen)) throw fallo('Origen de pregunta no válido', 400);

  return { temaId, nivel, ...pregunta, origen, estado };
}

// Evita que un docente borre preguntas de asignaturas que no son suyas.
export async function antesDeEliminar(registro, usuario) {
  await exigirEdicion(usuario, registro.temaId);
}

export default {
  filtrarLista,
  antesDeGuardar,
  antesDeEliminar
};
