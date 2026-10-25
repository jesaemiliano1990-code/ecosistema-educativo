import * as almacen from './almacen.js';

/**
 * Obtiene los grupos del distributivo a los que tiene acceso el usuario.
 * - admin: ve todos los grupos.
 * - docente: grupos donde es docenteId.
 * - estudiante: grupos donde figura en la lista de estudiantes.
 * @param {Object|null} usuario - { id, rol, ... }
 * @returns {Promise<Array>} Lista de grupos
 */
export async function gruposDe(usuario) {
  if (!usuario || !usuario.rol) return [];

  const distributivo = await almacen.leer('distributivo');

  if (usuario.rol === 'admin') {
    return distributivo;
  }

  if (usuario.rol === 'docente') {
    return distributivo.filter(g => g && g.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id));
  }

  return [];
}

/**
 * Obtiene las asignaturas a las que tiene acceso el usuario.
 * - admin: todas las asignaturas.
 * - docente / estudiante: asignaturas asociadas a sus grupos en el distributivo.
 * El arreglo devuelto incluye compatibilidad para .includes(id).
 * @param {Object|null} usuario - { id, rol, ... }
 * @returns {Promise<Array>} Lista de asignaturas
 */
export async function asignaturasDe(usuario) {
  if (!usuario || !usuario.rol) {
    const vacio = [];
    vacio.includes = () => false;
    return vacio;
  }

  const todas = await almacen.leer('asignaturas');

  let resultado = [];
  if (usuario.rol === 'admin') {
    resultado = todas;
  } else {
    const misGrupos = await gruposDe(usuario);
    const idsAsignaturas = new Set(misGrupos.map(g => g && g.asignaturaId).filter(Boolean));
    resultado = todas.filter(a => a && idsAsignaturas.has(a.id));
  }

  // Compatibilidad: permite hacer resultado.includes('asg_000001') directamente
  const idsSet = new Set(resultado.map(a => a && a.id).filter(Boolean));
  resultado.includes = function (val) {
    if (idsSet.has(val)) return true;
    return Array.prototype.includes.call(this, val);
  };

  return resultado;
}

/**
 * Resuelve la cadena tema → unidad → asignatura y devuelve el asignaturaId.
 * @param {string} temaId
 * @returns {Promise<string|null>} asignaturaId o null si no se encuentra
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find(t => t && t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u && u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  return unidad.asignaturaId;
}

/**
 * Verifica si un usuario tiene permisos de edición sobre una asignatura.
 * - admin: siempre true.
 * - docente: true si la asignatura está asignada a uno de sus grupos en el distributivo.
 * - estudiante / otros: false.
 * @param {Object|null} usuario - { id, rol, ... }
 * @param {string} asignaturaId
 * @returns {Promise<boolean>}
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !usuario.rol || !asignaturaId) return false;

  if (usuario.rol === 'admin') {
    return true;
  }

  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    return distributivo.some(g => g && g.docenteId === usuario.id && g.asignaturaId === asignaturaId);
  }

  return false;
}

/**
 * Obtiene la lista única de IDs de estudiantes asignados a un docente.
 * @param {string} docenteId
 * @returns {Promise<Array<string>>} Lista de IDs de estudiantes
 */
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const gruposDocente = distributivo.filter(g => g && g.docenteId === docenteId);

  const ids = new Set();
  for (const grupo of gruposDocente) {
    if (Array.isArray(grupo.estudiantes)) {
      for (const estId of grupo.estudiantes) {
        if (estId) ids.add(estId);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Obtiene la lista única de IDs de docentes asignados a un estudiante.
 * @param {string} estudianteId
 * @returns {Promise<Array<string>>} Lista de IDs de docentes
 */
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const gruposEstudiante = distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId));

  const ids = new Set();
  for (const grupo of gruposEstudiante) {
    if (grupo && grupo.docenteId) {
      ids.add(grupo.docenteId);
    }
  }

  return Array.from(ids);
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
