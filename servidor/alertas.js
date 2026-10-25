/**
 * servidor/alertas.js
 * Módulo de evaluación de alertas tempranas pedagógicas y notificaciones de apoyo
 */

import * as almacen from './almacen.js';
import { notificar } from './notificar.js';
import { asignaturaDeTema } from './acceso.js';

/**
 * Notifica al docente del grupo (y a los administradores si ajustes.alertasAdmin es true)
 * @param {Object} alerta
 * @param {string} nombreEstudiante
 */
async function notificarAlerta(alerta, nombreEstudiante = 'Estudiante') {
  const enlace = `/paginas/panel-docente.html?grupoId=${alerta.grupoId}`;
  const mensaje = `Alerta pedagógica (${nombreEstudiante}): ${alerta.detalle}`;

  // 1. Notificar al docente del grupo
  if (alerta.docenteId) {
    try {
      await notificar(alerta.docenteId, {
        tipo: 'alerta',
        mensaje,
        enlace
      });
    } catch (err) {
      console.warn('Error al notificar al docente:', err.message);
    }
  }

  // 2. Notificar a los administradores si está activado en ajustes.json
  try {
    const ajustes = (await almacen.leerConfig('ajustes')) || {};
    if (ajustes.alertasAdmin) {
      const usuarios = await almacen.leer('usuarios');
      const admins = usuarios.filter(u => u && u.rol === 'admin');
      for (const adm of admins) {
        await notificar(adm.id, {
          tipo: 'alerta',
          mensaje,
          enlace
        });
      }
    }
  } catch (errAdm) {
    console.warn('Error al notificar a administradores:', errAdm.message);
  }
}

/**
 * Crea una alerta asegurando que no existan duplicados activos para el mismo estudiante, regla y tema
 * @param {Object} datosAlerta
 * @param {string} nombreEstudiante
 * @returns {Promise<Object|null>} Alerta creada o null si ya existía una activa
 */
async function crearAlertaSinDuplicados(datosAlerta, nombreEstudiante = 'Estudiante') {
  const { estudianteId, regla, temaId = null } = datosAlerta;
  const alertasExistentes = await almacen.leer('alertas');

  const yaExiste = alertasExistentes.some(a =>
    a &&
    a.estudianteId === estudianteId &&
    a.regla === regla &&
    (a.temaId || null) === (temaId || null) &&
    a.estado === 'activa'
  );

  if (yaExiste) {
    return null;
  }

  const nueva = await almacen.agregar('alertas', {
    ...datosAlerta,
    temaId: temaId || null,
    estado: 'activa'
  });

  await notificarAlerta(nueva, nombreEstudiante);
  return nueva;
}

/**
 * Evalúa las alertas tempranas tras registrarse un intento pedagógico
 * - promedioBajo: promedio de los últimos N intentos del estudiante menor que el umbral, sin 'tema-revisado'
 * - fallosQuiz: N intentos de quiz seguidos no aprobados en el mismo tema y nivel
 * @param {Object} intento
 * @param {Object} usuario
 * @returns {Promise<Array<Object>>} Lista de alertas creadas
 */
export async function evaluarAlertas(intento, usuario) {
  if (!intento || !usuario || !usuario.id) return [];

  const reglas = (await almacen.leerConfig('reglas-alertas')) || {};
  const alertasCreadas = [];

  // Resolver grupo y docente del estudiante
  const distributivo = await almacen.leer('distributivo');
  const misGrupos = distributivo.filter(g =>
    g && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
  );

  if (misGrupos.length === 0) return [];

  let grupo = misGrupos[0];
  if (intento.temaId) {
    const asigId = await asignaturaDeTema(intento.temaId);
    if (asigId) {
      const grupoCoincidente = misGrupos.find(g => g.asignaturaId === asigId);
      if (grupoCoincidente) grupo = grupoCoincidente;
    }
  }

  const grupoId = grupo.id;
  const docenteId = grupo.docenteId;
  const nombreEstudiante = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Estudiante';

  // 1. REGLA: promedioBajo
  const confPromedio = reglas.promedioBajo;
  if (confPromedio && confPromedio.activa !== false) {
    const umbral = typeof confPromedio.umbral === 'number' ? confPromedio.umbral : 7;
    const ultimosN = typeof confPromedio.ultimos === 'number' ? confPromedio.ultimos : 3;

    const todosIntentos = await almacen.leer('intentos');
    const intentosEstudiante = todosIntentos
      .filter(it =>
        it &&
        it.usuarioId === usuario.id &&
        it.actividad !== 'tema-revisado' &&
        it.actividad !== 'foro' &&
        typeof it.maximo === 'number' &&
        it.maximo > 0 &&
        typeof it.puntaje === 'number'
      )
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

    if (intentosEstudiante.length >= ultimosN) {
      const muestra = intentosEstudiante.slice(0, ultimosN);
      const suma = muestra.reduce((acc, it) => acc + (it.puntaje / it.maximo) * 10, 0);
      const promedio = Number((suma / ultimosN).toFixed(1));

      if (promedio < umbral) {
        const detalle = `El estudiante presenta un promedio reciente de ${promedio}/10 en sus últimos ${ultimosN} intentos (umbral de apoyo: ${umbral}). Se sugiere una sesión de orientación y motivación.`;
        const alerta = await crearAlertaSinDuplicados({
          estudianteId: usuario.id,
          docenteId,
          grupoId,
          regla: 'promedioBajo',
          temaId: intento.temaId || null,
          detalle
        }, nombreEstudiante);

        if (alerta) alertasCreadas.push(alerta);
      }
    }
  }

  // 2. REGLA: fallosQuiz
  const confQuiz = reglas.fallosQuiz;
  if (confQuiz && confQuiz.activa !== false && intento.actividad === 'quiz' && intento.temaId && intento.nivel) {
    const vecesRequeridas = typeof confQuiz.veces === 'number' ? confQuiz.veces : 3;
    const reglasGamif = (await almacen.leerConfig('reglas-gamificacion')) || {};
    const pctAprobacion = reglasGamif.quiz?.porcentajeAprobacion || 70;

    const todosIntentos = await almacen.leer('intentos');
    const intentosQuiz = todosIntentos
      .filter(it =>
        it &&
        it.usuarioId === usuario.id &&
        it.actividad === 'quiz' &&
        it.temaId === intento.temaId &&
        it.nivel === intento.nivel
      )
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

    if (intentosQuiz.length >= vecesRequeridas) {
      const muestra = intentosQuiz.slice(0, vecesRequeridas);
      const todosFallidos = muestra.every(it => {
        if (it.detalle && typeof it.detalle.aprobado === 'boolean') {
          return !it.detalle.aprobado;
        }
        if (it.maximo && it.maximo > 0 && typeof it.puntaje === 'number') {
          return (it.puntaje / it.maximo) * 100 < pctAprobacion;
        }
        return true;
      });

      if (todosFallidos) {
        const detalle = `El estudiante registra ${vecesRequeridas} intentos consecutivos sin superar el nivel ${intento.nivel} del quiz. Repasar los conceptos clave del tema reforzará su confianza.`;
        const alerta = await crearAlertaSinDuplicados({
          estudianteId: usuario.id,
          docenteId,
          grupoId,
          regla: 'fallosQuiz',
          temaId: intento.temaId,
          detalle
        }, nombreEstudiante);

        if (alerta) alertasCreadas.push(alerta);
      }
    }
  }

  return alertasCreadas;
}

/**
 * Evalúa la inactividad de los estudiantes de un grupo antes de generar el resumen del grupo
 * - inactividad: sin eventos en la bitácora en X días
 * @param {string} grupoId
 * @returns {Promise<Array<Object>>} Lista de alertas creadas
 */
export async function evaluarInactividad(grupoId) {
  if (!grupoId) return [];

  const reglas = (await almacen.leerConfig('reglas-alertas')) || {};
  const confInactividad = reglas.inactividad;
  if (!confInactividad || confInactividad.activa === false) return [];

  const diasLimite = typeof confInactividad.dias === 'number' ? confInactividad.dias : 7;
  const milisegundosLimite = diasLimite * 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  const distributivo = await almacen.leer('distributivo');
  const grupo = distributivo.find(g => g && g.id === grupoId);
  if (!grupo || !Array.isArray(grupo.estudiantes) || grupo.estudiantes.length === 0) {
    return [];
  }

  const bitacora = await almacen.leerLineas('bitacora.jsonl');
  const usuarios = await almacen.leer('usuarios');
  const mapaUsuarios = new Map(usuarios.map(u => [u.id, u]));

  const alertasCreadas = [];

  for (const estId of grupo.estudiantes) {
    const logsEstudiante = bitacora.filter(b => b && b.usuarioId === estId && b.fecha);

    let tiempoInactivo = Infinity;
    if (logsEstudiante.length > 0) {
      // Tomar la fecha más reciente registrada
      let maxTime = -Infinity;
      for (const log of logsEstudiante) {
        const t = new Date(log.fecha).getTime();
        if (!isNaN(t) && t > maxTime) {
          maxTime = t;
        }
      }
      tiempoInactivo = ahora - maxTime;
    }

    if (tiempoInactivo > milisegundosLimite) {
      const u = mapaUsuarios.get(estId);
      const nombreEstudiante = `${u?.nombre || ''} ${u?.apellido || ''}`.trim() || 'Estudiante';
      const detalle = `El estudiante lleva más de ${diasLimite} días sin registrar actividad en la plataforma. Te extrañamos: un mensaje cercano le motivará a retomar sus actividades.`;

      const alerta = await crearAlertaSinDuplicados({
        estudianteId: estId,
        docenteId: grupo.docenteId,
        grupoId,
        regla: 'inactividad',
        temaId: null,
        detalle
      }, nombreEstudiante);

      if (alerta) alertasCreadas.push(alerta);
    }
  }

  return alertasCreadas;
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
