/**
 * servidor/foros.js
 * Utilidades compartidas por los ganchos de foros-hilos, foros-respuestas y reportes.
 */

import * as almacen from './almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from './acceso.js';

export const VENTANA_EDICION_MS = 15 * 60 * 1000;
export const MAX_TEXTO = 5000;

export const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

export const enlaceHilo = (hiloId) => `/paginas/hilo.html?id=${encodeURIComponent(hiloId)}`;

export function nombreDe(usuario) {
  return `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
}

// El autor edita su publicación solo durante los primeros 15 minutos.
export function dentroDeVentana(registro) {
  const creado = new Date(registro.fecha).getTime();
  return Number.isFinite(creado) && Date.now() - creado <= VENTANA_EDICION_MS;
}

export async function idsDeAsignaturas(usuario) {
  const lista = await asignaturasDe(usuario);
  return new Set(lista.map((a) => (typeof a === 'string' ? a : a?.id)).filter(Boolean));
}

// Docente de la asignatura o admin: puede fijar, cerrar, destacar, ocultar y borrar.
export async function esModerador(usuario, asignaturaId) {
  return puedeEditarAsignatura(usuario, asignaturaId);
}

// Texto obligatorio, recortado, con largo mínimo y máximo.
export function textoValido(valor, campo, min, max) {
  if (typeof valor !== 'string') throw fallo(`Falta ${campo}`, 400);
  const limpio = valor.trim();
  if (limpio.length < min) throw fallo(`${campo[0].toUpperCase()}${campo.slice(1)} es demasiado corto`, 400);
  if (limpio.length > max) throw fallo(`${campo[0].toUpperCase()}${campo.slice(1)} supera los ${max} caracteres`, 400);
  return limpio;
}

export function booleano(valor, campo) {
  if (typeof valor !== 'boolean') throw fallo(`${campo} debe ser verdadero o falso`, 400);
  return valor;
}

// Mantiene al día el contador de respuestas visibles y el último movimiento de un hilo.
export async function recalcularHilo(hiloId, { movimiento = false } = {}) {
  const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === hiloId);
  if (!hilo) return;
  const total = (await almacen.buscar('foros-respuestas', { hiloId })).filter((r) => !r.oculta).length;
  const cambios = { totalRespuestas: total };
  if (movimiento) cambios.ultimoMovimiento = new Date().toISOString();
  await almacen.actualizar('foros-hilos', hiloId, cambios);
}
