/**
 * servidor/rutas/resumen.js
 * Rutas de resúmenes de progreso académico para estudiantes y grupos
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { evaluarInactividad } from '../alertas.js';

const router = Router();

/**
 * Obtiene el formato de semana ISO (YYYY-Www) para una fecha ISO
 * @param {string} fechaIso
 * @returns {string|null}
 */
function obtenerSemanaISO(fechaIso) {
  if (!fechaIso) return null;
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return null;

  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7; // Lunes = 0, Domingo = 6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Calcula el promedio (media de puntaje / maximo * 10 con un decimal, sin contar "tema-revisado")
 * @param {Array<Object>} intentosLista
 * @returns {number}
 */
function calcularPromedio(intentosLista) {
  const validos = intentosLista.filter(it =>
    it &&
    it.actividad !== 'tema-revisado' &&
    typeof it.maximo === 'number' &&
    it.maximo > 0 &&
    typeof it.puntaje === 'number'
  );

  if (validos.length === 0) return 0;

  const suma = validos.reduce((acc, it) => acc + (it.puntaje / it.maximo) * 10, 0);
  const media = suma / validos.length;
  return Number(media.toFixed(1));
}

/**
 * Agrupa intentos por actividad y calcula su promedio e intentos (sin contar tema-revisado)
 * @param {Array<Object>} intentosLista
 * @returns {Array<{ actividad: string, promedio: number, intentos: number }>}
 */
function agruparPorActividad(intentosLista) {
  const grupos = new Map();

  for (const it of intentosLista) {
    if (!it || it.actividad === 'tema-revisado') continue;
    const act = it.actividad || 'general';
    if (!grupos.has(act)) {
      grupos.set(act, []);
    }
    grupos.get(act).push(it);
  }

  const resultado = [];
  for (const [actividad, lista] of grupos.entries()) {
    resultado.push({
      actividad,
      promedio: calcularPromedio(lista),
      intentos: lista.length
    });
  }

  resultado.sort((a, b) => a.actividad.localeCompare(b.actividad));
  return resultado;
}

/**
 * Agrupa intentos por tema con título, promedio e intentos (sin contar tema-revisado)
 * @param {Array<Object>} intentosLista
 * @param {Map<string, Object>} mapaTemas
 * @returns {Array<{ temaId: string, titulo: string, promedio: number, intentos: number }>}
 */
function agruparPorTema(intentosLista, mapaTemas) {
  const grupos = new Map();

  for (const it of intentosLista) {
    if (!it || it.actividad === 'tema-revisado' || !it.temaId) continue;
    const tid = it.temaId;
    if (!grupos.has(tid)) {
      grupos.set(tid, []);
    }
    grupos.get(tid).push(it);
  }

  const resultado = [];
  for (const [temaId, lista] of grupos.entries()) {
    const tema = mapaTemas.get(temaId);
    resultado.push({
      temaId,
      titulo: tema?.titulo || temaId,
      promedio: calcularPromedio(lista),
      intentos: lista.length
    });
  }

  resultado.sort((a, b) => a.titulo.localeCompare(b.titulo));
  return resultado;
}

/**
 * Calcula la evolución por semana (últimas 8 semanas con datos)
 * @param {Array<Object>} intentosLista
 * @returns {Array<{ semana: string, promedio: number }>}
 */
function calcularEvolucion(intentosLista) {
  const validos = intentosLista.filter(it =>
    it &&
    it.actividad !== 'tema-revisado' &&
    it.fecha &&
    typeof it.maximo === 'number' &&
    it.maximo > 0 &&
    typeof it.puntaje === 'number'
  );

  const semanasMap = new Map();
  for (const it of validos) {
    const sem = obtenerSemanaISO(it.fecha);
    if (!sem) continue;
    if (!semanasMap.has(sem)) {
      semanasMap.set(sem, []);
    }
    semanasMap.get(sem).push(it);
  }

  const semanasOrdenadas = Array.from(semanasMap.keys()).sort();
  const ultimas8 = semanasOrdenadas.slice(-8);

  return ultimas8.map(semana => ({
    semana,
    promedio: calcularPromedio(semanasMap.get(semana))
  }));
}

/**
 * Obtiene la última conexión de un usuario a partir de las líneas de bitácora
 * @param {string} usuarioId
 * @param {Array<Object>} bitacora
 * @returns {string|null}
 */
function obtenerUltimaConexion(usuarioId, bitacora) {
  const logs = bitacora.filter(b => b && b.usuarioId === usuarioId);
  if (logs.length === 0) return null;

  let maxFecha = null;
  let maxTime = -Infinity;
  for (const log of logs) {
    if (log && log.fecha) {
      const t = new Date(log.fecha).getTime();
      if (!isNaN(t) && t > maxTime) {
        maxTime = t;
        maxFecha = log.fecha;
      }
    }
  }
  return maxFecha;
}

// --------------------------------------------------------------------------
// 1. GET /resumen/estudiante/:id ("yo" permitido)
// --------------------------------------------------------------------------
router.get('/resumen/estudiante/:id', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const estudianteId = req.params.id === 'yo' ? req.usuario.id : req.params.id;

    // Leer colecciones y bitacora.jsonl exactamente una sola vez por petición
    const [
      usuarios,
      distributivo,
      unidades,
      temas,
      progresoTemas,
      intentos,
      logros,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('logros'),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    // Verificar si el estudiante existe
    const estudiante = usuarios.find(u => u && u.id === estudianteId);
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Comprobación de acceso: el propio estudiante, un docente de sus grupos o el admin
    const esPropio = req.usuario.id === estudianteId;
    const esAdmin = req.usuario.rol === 'admin';
    const esDocenteDelEstudiante = req.usuario.rol === 'docente' && distributivo.some(g =>
      g && g.docenteId === req.usuario.id && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
    );

    if (!esPropio && !esAdmin && !esDocenteDelEstudiante) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // 1. Puntos y nivelQuizMax
    const logro = logros.find(l => l && l.usuarioId === estudianteId);
    const puntos = Number(logro?.puntos) || 0;
    const niveles = Object.values(logro?.nivelQuiz || {}).filter(n => typeof n === 'number');
    const nivelQuizMax = niveles.length > 0 ? Math.max(...niveles) : 0;

    // 2. Temas publicados de sus asignaturas y progreso
    const misGrupos = distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId));
    const misAsignaturasIds = new Set(misGrupos.map(g => g.asignaturaId).filter(Boolean));

    let unidadesValidas = [];
    if (misAsignaturasIds.size > 0) {
      unidadesValidas = unidades.filter(u => u && misAsignaturasIds.has(u.asignaturaId));
    } else {
      unidadesValidas = unidades;
    }
    const unidadesIdsSet = new Set(unidadesValidas.map(u => u.id));

    const temasPublicados = temas.filter(t => t && unidadesIdsSet.has(t.unidadId) && t.estado === 'publicado');
    const totalPublicados = temasPublicados.length;

    const revisadosSet = new Set(progresoTemas.filter(p => p && p.usuarioId === estudianteId).map(p => p.temaId));
    const temasRevisados = temasPublicados.filter(t => revisadosSet.has(t.id));
    const pctTemas = totalPublicados > 0 ? Math.round((temasRevisados.length / totalPublicados) * 100) : 0;

    // pendientes: [{ temaId, titulo }] (temas publicados sin revisar)
    const pendientes = temasPublicados
      .filter(t => !revisadosSet.has(t.id))
      .map(t => ({ temaId: t.id, titulo: t.titulo }));

    // 3. Intentos del estudiante
    const intentosEstudiante = intentos.filter(it => it && it.usuarioId === estudianteId);

    // Promedio general (sin contar tema-revisado)
    const promedio = calcularPromedio(intentosEstudiante);

    // Mapa de temas para resolver títulos
    const mapaTemas = new Map(temas.map(t => [t.id, t]));

    // porActividad y porTema
    const porActividad = agruparPorActividad(intentosEstudiante);
    const porTema = agruparPorTema(intentosEstudiante, mapaTemas);

    // evolucion (últimas 8 semanas con datos)
    const evolucion = calcularEvolucion(intentosEstudiante);

    // última conexión
    const ultimaConexion = obtenerUltimaConexion(estudianteId, bitacora);

    // tiempoMin (duración total en minutos)
    const totalSegundos = intentosEstudiante.reduce((acc, it) => acc + (Number(it.duracionSeg) || 0), 0);
    const tiempoMin = Math.round(totalSegundos / 60);

    // ultimosIntentos (20 más recientes)
    const ultimosIntentos = [...intentosEstudiante]
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
      .slice(0, 20);

    res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------------------------------
// 2. GET /resumen/grupo/:grupoId (docente del grupo o admin)
// --------------------------------------------------------------------------
router.get('/resumen/grupo/:grupoId', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { grupoId } = req.params;

    // Evaluar inactividad antes de calcular el resumen del grupo
    try {
      await evaluarInactividad(grupoId);
    } catch (errInac) {
      console.warn('Error al evaluar inactividad en resumen de grupo:', errInac.message);
    }

    // Leer colecciones y bitacora.jsonl exactamente una sola vez por petición
    const [
      usuarios,
      distributivo,
      unidades,
      temas,
      progresoTemas,
      intentos,
      alertas,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('alertas').catch(() => []),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    const grupo = distributivo.find(g => g && g.id === grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Acceso: docente del grupo o admin
    const esAdmin = req.usuario.rol === 'admin';
    const esDocenteGrupo = req.usuario.rol === 'docente' && grupo.docenteId === req.usuario.id;

    if (!esAdmin && !esDocenteGrupo) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Temas publicados de la asignatura del grupo
    const unidadesGrupo = new Set(unidades.filter(u => u && u.asignaturaId === grupo.asignaturaId).map(u => u.id));
    const temasPublicadosGrupo = temas.filter(t => t && unidadesGrupo.has(t.unidadId) && t.estado === 'publicado');
    const totalTemasGrupo = temasPublicadosGrupo.length;

    const mapaUsuarios = new Map(usuarios.map(u => [u.id, u]));
    const mapaTemas = new Map(temas.map(t => [t.id, t]));
    const idsEstudiantes = Array.isArray(grupo.estudiantes) ? grupo.estudiantes : [];

    // Detalle de cada estudiante del grupo
    const estudiantesResumen = idsEstudiantes.map(estId => {
      const u = mapaUsuarios.get(estId);
      const intentosEst = intentos.filter(it => it && it.usuarioId === estId);

      // Promedio de sus intentos pedagógicos
      const promedio = calcularPromedio(intentosEst);

      // Total de actividades realizadas (sin contar tema-revisado)
      const actividades = intentosEst.filter(it => it.actividad !== 'tema-revisado').length;

      // Porcentaje de temas revisados de la asignatura del grupo
      const revisadosEst = new Set(progresoTemas.filter(p => p && p.usuarioId === estId).map(p => p.temaId));
      const countRevisados = temasPublicadosGrupo.filter(t => revisadosEst.has(t.id)).length;
      const pctTemas = totalTemasGrupo > 0 ? Math.round((countRevisados / totalTemasGrupo) * 100) : 0;

      // Última conexión
      const ultimaConexion = obtenerUltimaConexion(estId, bitacora);

      // Alertas activas del estudiante
      const alertasEst = alertas.filter(a => a && a.estudianteId === estId && a.estado === 'activa');
      const alertasActivas = alertasEst.length;

      return {
        id: estId,
        nombre: u?.nombre || '',
        apellido: u?.apellido || '',
        promedio,
        actividades,
        pctTemas,
        ultimaConexion,
        alertasActivas
      };
    });

    // porTema a nivel de grupo: todos los intentos de los estudiantes del grupo en temas de la asignatura
    const idsEstudiantesSet = new Set(idsEstudiantes);
    const temasGrupoIdsSet = new Set(temas.filter(t => unidadesGrupo.has(t.unidadId)).map(t => t.id));

    const intentosGrupo = intentos.filter(it =>
      it &&
      idsEstudiantesSet.has(it.usuarioId) &&
      it.temaId &&
      temasGrupoIdsSet.has(it.temaId)
    );

    const porTema = agruparPorTema(intentosGrupo, mapaTemas);

    res.json({
      grupo,
      estudiantes: estudiantesResumen,
      porTema
    });
  } catch (error) {
    next(error);
  }
});

export default router;
