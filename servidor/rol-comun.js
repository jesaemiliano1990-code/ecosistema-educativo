// Utilidades compartidas por los preparadores del modo rol (no es una tarea de IA).
import * as almacen from './almacen.js';
import { filtrarLista } from './ganchos/simulaciones.js';

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

const MAX_TEXTO = 1000;
export const ETIQUETA_ROL = { estudiante: () => 'Estudiante', personaje: (p) => p.nombre || 'Personaje' };

// Devuelve la simulación de rol si la persona puede verla (los estudiantes, solo publicadas de sus asignaturas).
export async function cargarSimulacionDeRol(simulacionId, usuario) {
  if (typeof simulacionId !== 'string' || !simulacionId) throw fallo('Falta la simulación', 400);
  const sim = (await almacen.leer('simulaciones')).find((s) => s && s.id === simulacionId);
  if (!sim || (await filtrarLista([sim], usuario)).length === 0) throw fallo('Simulación no encontrada', 404);
  if (sim.modo !== 'rol') throw fallo('Esta simulación no es de tipo juego de rol', 400);
  const p = sim.personaje || {};
  if (!p.nombre || !p.descripcion || !p.contexto || !p.objetivo) throw fallo('La simulación de rol está incompleta', 400);
  return { ...sim, personaje: p, rubrica: Array.isArray(sim.rubrica) ? sim.rubrica : [], maxTurnos: Number(sim.maxTurnos) || 8 };
}

// Roles válidos, hasta 1.000 caracteres por mensaje y como máximo maxTurnos intervenciones del estudiante.
export function limpiarHistorial(historial, maxTurnos, { ultimoEsEstudiante }) {
  if (!Array.isArray(historial)) throw fallo('Falta la conversación', 400);
  const limpio = [];
  for (const m of historial) {
    if (!m || !ETIQUETA_ROL[m.rol] || typeof m.texto !== 'string') continue;
    const texto = m.texto.trim().slice(0, MAX_TEXTO);
    if (texto) limpio.push({ rol: m.rol, texto });
  }
  const turnos = limpio.filter((m) => m.rol === 'estudiante').length;
  if (!turnos) throw fallo('Escribe algo para el personaje', 400);
  if (turnos > maxTurnos) throw fallo(`La práctica admite hasta ${maxTurnos} turnos`, 400);
  if (ultimoEsEstudiante && limpio[limpio.length - 1].rol !== 'estudiante') throw fallo('El último mensaje debe ser del estudiante', 400);
  return limpio;
}
