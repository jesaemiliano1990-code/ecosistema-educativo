/**
 * servidor/ganchos/alertas.js
 * Gancho para la colección 'alertas': filtra por los grupos del docente y solo permite modificar el campo estado.
 */

import { gruposDe } from '../acceso.js';

/**
 * Filtra el listado de alertas según el rol del usuario
 * - admin: ve todas las alertas
 * - docente: ve solo las alertas pertenecientes a sus grupos asignados
 * @param {Array} lista
 * @param {Object} usuario
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misGrupos = await gruposDe(usuario);
    const misGruposIds = new Set(misGrupos.map(g => g && g.id).filter(Boolean));
    return lista.filter(a => a && misGruposIds.has(a.grupoId));
  }

  return [];
}

/**
 * Valida los datos antes de persistir una alerta
 * Solo permite modificar el campo 'estado' al actualizar una alerta existente.
 * @param {Object} datos
 * @param {Object} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (anterior) {
    // Si es docente, verificar que sea el docente asignado a la alerta
    if (usuario.rol === 'docente' && anterior.docenteId && anterior.docenteId !== usuario.id) {
      const error = new Error('No tienes permiso para modificar alertas de otros docentes');
      error.estado = 403;
      throw error;
    }

    // Solo se permite modificar el campo 'estado'
    if (datos.estado && !['activa', 'atendida'].includes(datos.estado)) {
      const error = new Error("El estado de la alerta debe ser 'activa' o 'atendida'");
      error.estado = 400;
      throw error;
    }

    return {
      ...anterior,
      estado: datos.estado || anterior.estado
    };
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
