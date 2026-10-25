/**
 * servidor/rutas/quiz.js
 * Motor del quiz por niveles (solo estudiantes con acceso al tema).
 * Las respuestas correctas nunca salen del servidor antes de contestar cada pregunta.
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();

// Igual que util.normalizar del navegador: mayúsculas, sin tildes ni diéresis, conserva la Ñ.
function normalizar(texto) {
  return String(texto ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFC')
    .replace(/[ÁÀÂÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U');
}

const NIVELES = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];
const HORAS_SESION_ABIERTA = 2;

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

// Exclusión mutua por sesión: dos respuestas simultáneas no se pisan al guardar.
const candados = new Map();
function conCandado(clave, tarea) {
  const previa = candados.get(clave) || Promise.resolve();
  const actual = previa.then(tarea, tarea);
  candados.set(clave, actual.catch(() => {}));
  return actual;
}

function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function exigirEstudianteConAcceso(req, temaId) {
  if (!req.usuario) throw fallo('No autenticado', 401);
  if (req.usuario.rol !== 'estudiante') throw fallo('El quiz es solo para estudiantes', 403);
  if (typeof temaId !== 'string' || !temaId) throw fallo('Falta el tema', 400);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  const asignaturaId = tema ? await asignaturaDeTema(temaId) : null;
  if (!tema || tema.estado !== 'publicado' || !asignaturaId) throw fallo('Tema no encontrado', 404);

  const mias = (await asignaturasDe(req.usuario)).map((a) => (typeof a === 'string' ? a : a?.id));
  if (!mias.includes(asignaturaId)) throw fallo('No tienes acceso a este tema', 403);
  return { tema, asignaturaId };
}

async function nivelAprobado(usuarioId, temaId) {
  const logro = (await almacen.leer('logros')).find((l) => l && l.usuarioId === usuarioId);
  return Number(logro?.nivelQuiz?.[temaId]) || 0;
}

function enteroEnRango(valor, min, max) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function textoCorrecta(p) {
  if (p.tipo === 'opcion') return p.opciones[p.correcta];
  if (p.tipo === 'vf') return p.correcta ? 'Verdadero' : 'Falso';
  return String(p.correcta);
}

function evaluarRespuesta(p, respuesta) {
  if (p.tipo === 'opcion') {
    const i = typeof respuesta === 'number' || /^\d+$/.test(String(respuesta)) ? Number(respuesta) : NaN;
    if (!Number.isInteger(i) || i < 0 || i >= p.opciones.length) throw fallo('Respuesta no válida', 400);
    return i === p.correcta;
  }
  if (p.tipo === 'vf') {
    const v = typeof respuesta === 'boolean' ? respuesta : { true: true, false: false }[String(respuesta).toLowerCase()];
    if (typeof v !== 'boolean') throw fallo('Respuesta no válida', 400);
    return v === p.correcta;
  }
  if (typeof respuesta !== 'string' || !respuesta.trim()) throw fallo('Escribe una respuesta', 400);
  return normalizar(respuesta) === normalizar(String(p.correcta));
}

async function sesionDelUsuario(req, sesionId) {
  if (!req.usuario) throw fallo('No autenticado', 401);
  if (req.usuario.rol !== 'estudiante') throw fallo('El quiz es solo para estudiantes', 403);
  if (typeof sesionId !== 'string' || !sesionId) throw fallo('Falta la sesión del quiz', 400);
  const sesion = (await almacen.leer('quiz-sesiones')).find((s) => s.id === sesionId);
  if (!sesion || sesion.usuarioId !== req.usuario.id) throw fallo('Sesión de quiz no encontrada', 404);
  return sesion;
}

// Aviso al docente del grupo: como máximo una vez al día por tema y nivel.
async function avisarBancoCorto(usuario, tema, asignaturaId, nivel, disponibles, necesarias) {
  try {
    const grupo = (await almacen.leer('distributivo')).find(
      (g) => g.asignaturaId === asignaturaId && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
    );
    if (!grupo?.docenteId) return;
    const enlace = `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}&nivel=${nivel}`;
    const hoy = new Date().toISOString().slice(0, 10);
    const yaAvisado = (await almacen.leer('notificaciones')).some(
      (n) => n.usuarioId === grupo.docenteId && n.tipo === 'banco-preguntas' && n.enlace === enlace && (n.fecha || '').slice(0, 10) === hoy
    );
    if (yaAvisado) return;
    await notificar(grupo.docenteId, {
      tipo: 'banco-preguntas',
      mensaje: `El banco del tema "${tema.titulo}" (nivel ${nivel}) tiene ${disponibles} pregunta(s) aprobada(s) y el quiz usa ${necesarias}. Agrega más para que no se repitan.`,
      enlace
    });
  } catch (error) {
    console.warn('No se pudo avisar al docente sobre el banco de preguntas:', error.message);
  }
}

// GET /quiz/estado?temaId= → estado de los 5 niveles
router.get('/quiz/estado', async (req, res, next) => {
  try {
    const temaId = req.query.temaId;
    await exigirEstudianteConAcceso(req, temaId);
    const aprobado = await nivelAprobado(req.usuario.id, temaId);
    const sesiones = (await almacen.leer('quiz-sesiones')).filter(
      (s) => s.usuarioId === req.usuario.id && s.temaId === temaId && s.finalizada
    );
    const niveles = NIVELES.map((nombre, i) => {
      const nivel = i + 1;
      const estado = nivel <= aprobado ? 'aprobado' : nivel === aprobado + 1 ? 'disponible' : 'bloqueado';
      const porcentajes = sesiones.filter((s) => s.nivel === nivel).map((s) => Number(s.porcentaje) || 0);
      return { nivel, nombre, estado, mejorPorcentaje: porcentajes.length ? Math.max(...porcentajes) : 0 };
    });
    res.json({ niveles });
  } catch (error) {
    next(error);
  }
});

// POST /quiz/iniciar { temaId, nivel } → { sesionId, preguntas, respondidas }
router.post('/quiz/iniciar', async (req, res, next) => {
  try {
    const { temaId } = req.body || {};
    const nivel = enteroEnRango(req.body?.nivel, 1, 5);
    const { tema, asignaturaId } = await exigirEstudianteConAcceso(req, temaId);
    if (!nivel) throw fallo('El nivel debe estar entre 1 y 5', 400);

    const aprobado = await nivelAprobado(req.usuario.id, temaId);
    if (nivel > aprobado + 1) throw fallo(`Primero debes aprobar el nivel ${nivel - 1}`, 403);

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const cuantas = Number(reglas.quiz?.preguntasPorNivel) || 10;

    const banco = (await almacen.leer('preguntas')).filter(
      (p) => p.temaId === temaId && p.nivel === nivel && p.estado === 'aprobado'
    );
    if (!banco.length) throw fallo('Aún no hay preguntas para este nivel. Avisa a tu docente.', 409);
    const porId = new Map(banco.map((p) => [p.id, p]));

    const sesiones = (await almacen.leer('quiz-sesiones')).filter(
      (s) => s.usuarioId === req.usuario.id && s.temaId === temaId && s.nivel === nivel
    );

    // Si dejó un quiz a medias hace poco, se retoma (no se reparte otro con preguntas nuevas).
    const limite = Date.now() - HORAS_SESION_ABIERTA * 3600 * 1000;
    const abierta = sesiones.find((s) => !s.finalizada && new Date(s.inicio).getTime() > limite);
    let sesion = abierta;
    let preguntas;

    if (abierta) {
      preguntas = abierta.preguntasIds.map((id) => porId.get(id)).filter(Boolean);
    } else {
      // Primero las que nunca vio; si no alcanzan, las vistas hace más tiempo.
      const ultimaVez = new Map();
      for (const s of sesiones) {
        for (const id of s.preguntasIds) {
          if (!ultimaVez.has(id) || s.inicio > ultimaVez.get(id)) ultimaVez.set(id, s.inicio);
        }
      }
      const nuevas = barajar(banco.filter((p) => !ultimaVez.has(p.id)));
      const repetidas = banco
        .filter((p) => ultimaVez.has(p.id))
        .sort((a, b) => ultimaVez.get(a.id).localeCompare(ultimaVez.get(b.id)));
      preguntas = [...nuevas, ...repetidas].slice(0, cuantas);
      preguntas = barajar(preguntas);

      if (nuevas.length < cuantas) {
        await avisarBancoCorto(req.usuario, tema, asignaturaId, nivel, banco.length, cuantas);
      }
      sesion = await almacen.agregar('quiz-sesiones', {
        usuarioId: req.usuario.id,
        temaId,
        nivel,
        preguntasIds: preguntas.map((p) => p.id),
        respuestas: {},
        inicio: new Date().toISOString(),
        finalizada: false
      });
    }

    res.json({
      sesionId: sesion.id,
      preguntas: preguntas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.tipo === 'completar' ? [] : p.opciones
      })),
      respondidas: Object.keys(sesion.respuestas || {})
    });
  } catch (error) {
    next(error);
  }
});

// POST /quiz/responder { sesionId, preguntaId, respuesta } → se guarda una sola vez por pregunta
router.post('/quiz/responder', async (req, res, next) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body || {};
    const resultado = await conCandado(`s:${sesionId}`, async () => {
      const sesion = await sesionDelUsuario(req, sesionId);
      if (sesion.finalizada) throw fallo('Este quiz ya terminó', 409);
      if (!sesion.preguntasIds.includes(preguntaId)) throw fallo('La pregunta no pertenece a este quiz', 400);

      const pregunta = (await almacen.leer('preguntas')).find((p) => p.id === preguntaId);
      if (!pregunta) throw fallo('La pregunta ya no existe', 410);

      const previa = sesion.respuestas?.[preguntaId];
      const correcto = previa ? previa.correcto : evaluarRespuesta(pregunta, respuesta);
      if (!previa) {
        await almacen.actualizar('quiz-sesiones', sesion.id, {
          respuestas: { ...sesion.respuestas, [preguntaId]: { respuesta, correcto } }
        });
      }
      return { correcto, retroalimentacion: pregunta.retroalimentacion, correcta: textoCorrecta(pregunta) };
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// POST /quiz/finalizar { sesionId } → porcentaje, aprobación, puntos e insignias
router.post('/quiz/finalizar', async (req, res, next) => {
  try {
    const { sesionId } = req.body || {};
    const resultado = await conCandado(`s:${sesionId}`, async () => {
      const sesion = await sesionDelUsuario(req, sesionId);
      const preguntas = await almacen.leer('preguntas');
      const total = sesion.preguntasIds.length;
      const falladas = sesion.preguntasIds.filter((id) => !sesion.respuestas?.[id]?.correcto);

      // Un quiz ya finalizado devuelve el resultado guardado y no vuelve a dar puntos.
      if (sesion.finalizada) {
        return {
          porcentaje: sesion.porcentaje,
          aprobado: sesion.aprobado,
          aciertos: sesion.aciertos,
          total,
          repasar: falladas.map((id) => preguntas.find((p) => p.id === id)?.retroalimentacion).filter(Boolean),
          puntosGanados: 0,
          insigniasNuevas: []
        };
      }

      const reglas = await almacen.leerConfig('reglas-gamificacion');
      const aciertos = total - falladas.length;
      const porcentaje = Math.round((aciertos / total) * 100);
      const aprobado = porcentaje >= (Number(reglas.quiz?.porcentajeAprobacion) || 70);
      const duracionSeg = Math.max(1, Math.round((Date.now() - new Date(sesion.inicio).getTime()) / 1000));

      await almacen.actualizar('quiz-sesiones', sesion.id, {
        finalizada: true, porcentaje, aprobado, aciertos, fin: new Date().toISOString()
      });

      // La aprobación se guarda primero para que no se pierda si el registro del intento falla.
      if (aprobado) {
        const logros = await almacen.leer('logros');
        const logro = logros.find((l) => l.usuarioId === sesion.usuarioId);
        const nivelQuiz = { ...(logro?.nivelQuiz || {}) };
        nivelQuiz[sesion.temaId] = Math.max(Number(nivelQuiz[sesion.temaId]) || 0, sesion.nivel);
        if (logro) await almacen.actualizar('logros', logro.id, { nivelQuiz });
        else await almacen.agregar('logros', { usuarioId: sesion.usuarioId, puntos: 0, insignias: [], nivelQuiz });
      }

      let puntosGanados = 0;
      let puntosTotales;
      let insigniasNuevas = [];
      let aviso;
      try {
        const registro = await procesarIntento(req.usuario, {
          actividad: 'quiz',
          temaId: sesion.temaId,
          nivel: sesion.nivel,
          puntaje: aciertos,
          maximo: total,
          errores: total - aciertos,
          duracionSeg,
          detalle: { aprobado }
        });
        puntosGanados = registro.puntosGanados;
        puntosTotales = registro.puntosTotales;
        insigniasNuevas = registro.insigniasNuevas;
      } catch (error) {
        aviso = `Tu resultado se guardó, pero no se pudieron sumar los puntos: ${error.message}`;
      }

      return {
        porcentaje,
        aprobado,
        aciertos,
        total,
        repasar: falladas.map((id) => preguntas.find((p) => p.id === id)?.retroalimentacion).filter(Boolean),
        puntosGanados,
        ...(puntosTotales !== undefined ? { puntosTotales } : {}),
        insigniasNuevas,
        ...(aviso ? { aviso } : {})
      };
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
