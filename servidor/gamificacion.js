/**
 * servidor/gamificacion.js
 * Motor de gamificación del servidor: cálculo de puntos, restricciones,
 * registro de intentos, actualización de logros y otorgamiento de insignias.
 */

import * as almacen from './almacen.js';
import { asignaturasDe, asignaturaDeTema } from './acceso.js';
import { evaluarAlertas } from './alertas.js';

// Control de intentos por hora en memoria por usuarioId
const intentosPorUsuario = new Map();

/**
 * Obtiene el valor de una propiedad simple o anidada (ej. 'detalle.simulacionId')
 */
function obtenerValor(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const p of partes) {
    if (actual == null) return undefined;
    actual = actual[p];
  }
  return actual;
}

/**
 * Procesa un intento de actividad pedagógica
 * @param {Object} usuario - Usuario de la sesión ({ id, rol, ... })
 * @param {Object} datos - Datos del intento
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const error = new Error('Sesión requerida para registrar el intento');
    error.estado = 401;
    throw error;
  }

  if (!datos || typeof datos !== 'object') {
    const error = new Error('Datos de intento no proporcionados');
    error.estado = 400;
    throw error;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const puntosReglas = reglas.puntos || {};

  // 1. Validar actividad existente en reglas.puntos
  const actividad = datos.actividad;
  if (!actividad || typeof puntosReglas[actividad] === 'undefined') {
    const error = new Error(`Actividad "${actividad}" no configurada en las reglas de puntos`);
    error.estado = 400;
    throw error;
  }

  // 2. Validar 0 <= puntaje <= maximo y maximo > 0
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);
  if (isNaN(puntaje) || isNaN(maximo) || puntaje < 0 || puntaje > maximo || maximo <= 0) {
    const error = new Error('El puntaje debe estar entre 0 y el máximo, y el máximo debe ser mayor a 0');
    error.estado = 400;
    throw error;
  }

  // 3. Si viene temaId, validar que el usuario tenga acceso a través de su asignatura
  if (datos.temaId) {
    const asignaturaId = await asignaturaDeTema(datos.temaId);
    if (!asignaturaId) {
      const error = new Error('El tema especificado no fue encontrado');
      error.estado = 404;
      throw error;
    }
    const misAsignaturas = await asignaturasDe(usuario);
    const setAsig = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));
    if (!setAsig.has(asignaturaId)) {
      const error = new Error('No tienes acceso al tema especificado');
      error.estado = 403;
      throw error;
    }
  }

  // 4. Límite de intentos por hora en memoria -> 429
  const limiteHora = typeof reglas.limiteIntentosHora === 'number' ? reglas.limiteIntentosHora : 60;
  const ahoraMs = Date.now();
  const intentosRecientes = (intentosPorUsuario.get(usuario.id) || []).filter(t => ahoraMs - t < 60 * 60 * 1000);

  if (intentosRecientes.length >= limiteHora) {
    const error = new Error('Demasiados intentos en la última hora. Límite alcanzado.');
    error.estado = 429;
    throw error;
  }
  intentosRecientes.push(ahoraMs);
  intentosPorUsuario.set(usuario.id, intentosRecientes);

  // 5. Cálculo base de puntos y bono sin errores
  const basePuntos = Number(puntosReglas[actividad]) || 0;
  let puntosCalculados = Math.round(basePuntos * (puntaje / maximo));

  const errores = typeof datos.errores === 'number' ? datos.errores : 0;
  const bonoSinErrores = Number(reglas.bonoSinErrores) || 0;
  if (errores === 0 && puntaje === maximo) {
    puntosCalculados += bonoSinErrores;
  }

  // 6. Restricciones para otorgar puntos
  let otorgarPuntos = true;
  const todosIntentos = await almacen.leer('intentos');
  const misIntentos = todosIntentos.filter(i => i && i.usuarioId === usuario.id);

  // A. Actividad en reglas.unicas y ya hay intento con puntos con la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const campos = reglas.unicas[actividad];
    const claveNueva = campos.map(c => String(obtenerValor(datos, c) ?? '')).join('|');

    const yaExisteConPuntos = misIntentos.some(i => {
      if (i.actividad !== actividad || !i.puntos || i.puntos <= 0) return false;
      const claveExistente = campos.map(c => String(obtenerValor(i, c) ?? '')).join('|');
      return claveExistente === claveNueva;
    });

    if (yaExisteConPuntos) {
      otorgarPuntos = false;
    }
  }

  // B. Está en requiereAprobado y detalle.aprobado !== true
  if (reglas.requiereAprobado && Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (!datos.detalle || datos.detalle.aprobado !== true) {
      otorgarPuntos = false;
    }
  }

  // C. Ya alcanzó hoy reglas.maxDiario[actividad] intentos con puntos
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const maxPermitido = reglas.maxDiario[actividad];
    const hoyIso = new Date().toISOString().slice(0, 10);

    const intentosHoyConPuntos = misIntentos.filter(i => {
      return i.actividad === actividad &&
        i.puntos > 0 &&
        (i.fecha || '').slice(0, 10) === hoyIso;
    });

    if (intentosHoyConPuntos.length >= maxPermitido) {
      otorgarPuntos = false;
    }
  }

  const puntosGanados = otorgarPuntos ? puntosCalculados : 0;

  // 7. Guardar el nuevo intento
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: typeof datos.nivel !== 'undefined' ? datos.nivel : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: typeof datos.duracionSeg === 'number' ? datos.duracionSeg : 0,
    detalle: datos.detalle || {},
    puntos: puntosGanados
  };

  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);

  // 8. Cargar y actualizar logros del usuario
  const todosLogros = await almacen.leer('logros');
  let miLogro = todosLogros.find(l => l && l.usuarioId === usuario.id);

  if (!miLogro) {
    miLogro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  miLogro.puntos = (miLogro.puntos || 0) + puntosGanados;

  // Registrar nivel aprobado de quiz si corresponde
  if (actividad === 'quiz' && datos.temaId && typeof datos.nivel !== 'undefined') {
    const nivelNum = Number(datos.nivel);
    if (!isNaN(nivelNum) && datos.detalle && datos.detalle.aprobado === true) {
      if (!miLogro.nivelQuiz || typeof miLogro.nivelQuiz !== 'object') {
        miLogro.nivelQuiz = {};
      }
      miLogro.nivelQuiz[datos.temaId] = Math.max(miLogro.nivelQuiz[datos.temaId] || 0, nivelNum);
    }
  }

  // 9. Evaluar insignias no obtenidas
  const insigniasExistentes = Array.isArray(miLogro.insignias) ? miLogro.insignias : [];
  const insigniasIdsGanadas = new Set(insigniasExistentes.map(i => typeof i === 'string' ? i : i?.id).filter(Boolean));

  const catalogoInsignias = await almacen.leer('insignias');
  const todosMisIntentos = [...misIntentos, intentoGuardado];
  const insigniasNuevas = [];

  for (const ins of catalogoInsignias) {
    if (!ins || !ins.id || insigniasIdsGanadas.has(ins.id)) continue;
    const cond = ins.condicion;
    if (!cond || !cond.tipo) continue;

    let califica = false;

    switch (cond.tipo) {
      case 'conteo': {
        const act = cond.actividad;
        const intentosAct = todosMisIntentos.filter(i => i && i.actividad === act);

        if (reglas.unicas && Array.isArray(reglas.unicas[act])) {
          // En actividades únicas, contar claves distintas
          const campos = reglas.unicas[act];
          const claves = new Set();
          for (const i of intentosAct) {
            const k = campos.map(c => String(obtenerValor(i, c) ?? '')).join('|');
            claves.add(k);
          }
          califica = claves.size >= cond.minimo;
        } else {
          califica = intentosAct.length >= cond.minimo;
        }
        break;
      }

      case 'sinErrores': {
        califica = todosMisIntentos.some(i => {
          if (!i || i.actividad !== cond.actividad) return false;
          const err = typeof i.errores === 'number' ? i.errores : 0;
          return err === 0 && (i.puntaje === i.maximo || i.puntaje > 0);
        });
        break;
      }

      case 'puntos': {
        califica = miLogro.puntos >= cond.minimo;
        break;
      }

      case 'nivelQuiz': {
        // Nivel aprobado en cualquier tema
        const aprobadoEnLogro = Object.values(miLogro.nivelQuiz || {}).some(lvl => Number(lvl) >= Number(cond.nivel));
        const aprobadoEnIntentos = todosMisIntentos.some(i => {
          return i.actividad === 'quiz' &&
            Number(i.nivel) >= Number(cond.nivel) &&
            i.detalle && i.detalle.aprobado === true;
        });
        califica = aprobadoEnLogro || aprobadoEnIntentos;
        break;
      }

      case 'racha': {
        // Días consecutivos con intentos hasta hoy
        const diasConIntento = new Set(
          todosMisIntentos
            .map(i => (i.fecha || '').slice(0, 10))
            .filter(Boolean)
        );

        let racha = 0;
        const d = new Date();
        while (true) {
          const iso = d.toISOString().slice(0, 10);
          if (diasConIntento.has(iso)) {
            racha++;
            d.setUTCDate(d.getUTCDate() - 1);
          } else {
            break;
          }
        }
        califica = racha >= cond.dias;
        break;
      }

      default:
        break;
    }

    if (califica) {
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      });
      insigniasExistentes.push({
        id: ins.id,
        fecha: new Date().toISOString()
      });
      insigniasIdsGanadas.add(ins.id);
    }
  }

  miLogro.insignias = insigniasExistentes;

  // Persistir logros
  if (miLogro.id) {
    await almacen.actualizar('logros', miLogro.id, miLogro);
  } else {
    miLogro = await almacen.agregar('logros', miLogro);
  }

  // 10. Evaluar alertas tempranas en try/catch
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (errAlerta) {
    console.warn('Advertencia al evaluar alertas pedagógicas:', errAlerta.message);
  }

  return {
    puntosGanados,
    puntosTotales: miLogro.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
