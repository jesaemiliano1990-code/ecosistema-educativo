/**
 * servidor/rutas/certificados.js
 * Rutas de emisión, consulta de estado y verificación pública de certificados
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';

const router = Router();

/**
 * Genera un código único con formato EE-YYYY-XXXXXX
 */
function generarCodigoUnico(existentes = []) {
  const anio = new Date().getFullYear();
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigosSet = new Set(existentes.map(c => c && c.codigo));
  let codigo = '';

  do {
    let sufijo = '';
    for (let i = 0; i < 6; i++) {
      sufijo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    codigo = `EE-${anio}-${sufijo}`;
  } while (codigosSet.has(codigo));

  return codigo;
}

/**
 * Calcula las condiciones de cumplimiento general de certificado para un usuario
 */
async function evaluarCondicionesCumplimiento(usuario) {
  const reglas = (await almacen.leerConfig('reglas-gamificacion')) || {};
  const confCert = reglas.certificado || {
    nivelQuizRequerido: 5,
    temasConNivelRequerido: 1,
    puntosMinimos: 400,
    temasRevisadosPct: 80
  };

  // 1. Logros del usuario (puntos y nivel de quiz)
  const logros = await almacen.leer('logros');
  const logroUsuario = logros.find(l => l && l.usuarioId === usuario.id) || { puntos: 0, nivelQuiz: {} };
  const puntosActuales = Number(logroUsuario.puntos) || 0;

  // Temas con nivel de quiz >= nivelQuizRequerido
  const nivelesQuiz = logroUsuario.nivelQuiz || {};
  const temasConNivel = Object.values(nivelesQuiz).filter(n => typeof n === 'number' && n >= confCert.nivelQuizRequerido).length;

  // 2. Porcentaje de temas revisados sobre los publicados de sus asignaturas
  const misAsignaturas = await asignaturasDe(usuario);
  const misAsignaturasIds = new Set(misAsignaturas.map(a => typeof a === 'string' ? a : a?.id).filter(Boolean));

  const unidades = await almacen.leer('unidades');
  const unidadesIds = new Set(unidades.filter(u => u && misAsignaturasIds.has(u.asignaturaId)).map(u => u.id));

  const temas = await almacen.leer('temas');
  const temasPublicados = temas.filter(t => t && unidadesIds.has(t.unidadId) && t.estado === 'publicado');
  const totalPublicados = temasPublicados.length;

  const progresoTemas = await almacen.leer('progreso-temas');
  const revisadosUsuario = new Set(progresoTemas.filter(p => p && p.usuarioId === usuario.id).map(p => p.temaId));

  const temasRevisados = temasPublicados.filter(t => revisadosUsuario.has(t.id)).length;
  const pctRevisados = totalPublicados > 0 ? Math.round((temasRevisados / totalPublicados) * 100) : 0;

  const condiciones = [
    {
      nombre: `Nivel de quiz ≥ ${confCert.nivelQuizRequerido} en al menos ${confCert.temasConNivelRequerido} tema(s)`,
      actual: temasConNivel,
      requerido: confCert.temasConNivelRequerido,
      cumple: temasConNivel >= confCert.temasConNivelRequerido
    },
    {
      nombre: `Puntos mínimos acumulados (${confCert.puntosMinimos} pts)`,
      actual: puntosActuales,
      requerido: confCert.puntosMinimos,
      cumple: puntosActuales >= confCert.puntosMinimos
    },
    {
      nombre: `Temas revisados (${confCert.temasRevisadosPct}% requerido)`,
      actual: `${pctRevisados}%`,
      requerido: `${confCert.temasRevisadosPct}%`,
      cumple: pctRevisados >= confCert.temasRevisadosPct
    }
  ];

  const cumple = condiciones.every(c => c.cumple);
  return { condiciones, cumple };
}

// GET /certificados/estado (con sesión)
router.get('/certificados/estado', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const estado = await evaluarCondicionesCumplimiento(req.usuario);
    res.json(estado);
  } catch (error) {
    next(error);
  }
});

// GET /certificados/verificar/:codigo (público, sin sesión requerida)
router.get('/certificados/verificar/:codigo', async (req, res, next) => {
  try {
    const codigoIngresado = (req.params.codigo || '').trim().toUpperCase();
    if (!codigoIngresado) {
      return res.json({ valido: false });
    }

    const certificados = await almacen.leer('certificados');
    const cert = certificados.find(c => c && c.codigo && c.codigo.toUpperCase() === codigoIngresado);

    if (!cert) {
      return res.json({ valido: false });
    }

    res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto || 'Estudiante',
      detalle: cert.detalle || 'Certificado emitido',
      fecha: cert.fecha
    });
  } catch (error) {
    next(error);
  }
});

// POST /certificados (con sesión)
router.post('/certificados', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { tipo, temaId, nivel } = req.body || {};

    if (!tipo || (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz')) {
      return res.status(400).json({ error: 'El tipo debe ser "cumplimiento" o "nivel-quiz"' });
    }

    let detalle = '';

    if (tipo === 'cumplimiento') {
      const { cumple } = await evaluarCondicionesCumplimiento(req.usuario);
      if (!cumple) {
        return res.status(400).json({ error: 'Aún no cumples los requisitos para el certificado de cumplimiento' });
      }
      detalle = 'Certificado de cumplimiento integral del programa pedagógico';
    } else if (tipo === 'nivel-quiz') {
      if (!temaId) {
        return res.status(400).json({ error: 'temaId es requerido para certificados de nivel-quiz' });
      }
      const nivelReq = parseInt(nivel, 10) || 1;

      const logros = await almacen.leer('logros');
      const logro = logros.find(l => l && l.usuarioId === req.usuario.id);
      const nivelActual = logro?.nivelQuiz?.[temaId] || 0;

      if (nivelActual < nivelReq) {
        return res.status(400).json({ error: `Nivel de quiz insuficiente. Nivel actual: ${nivelActual}, requerido: ${nivelReq}` });
      }

      const temas = await almacen.leer('temas');
      const tema = temas.find(t => t && t.id === temaId);
      const nombreTema = tema?.titulo || temaId;
      detalle = `Superación del nivel ${nivelReq} en el quiz de ${nombreTema}`;
    }

    // Si ya existe un certificado igual emitido previamente, devolverlo
    const certificados = await almacen.leer('certificados');
    const existente = certificados.find(c => {
      if (!c || c.usuarioId !== req.usuario.id || c.tipo !== tipo) return false;
      if (tipo === 'nivel-quiz') {
        return c.temaId === temaId && Number(c.nivel) === Number(nivel);
      }
      return true;
    });

    if (existente) {
      return res.json(existente);
    }

    // Crear nuevo certificado
    const codigo = generarCodigoUnico(certificados);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || 'Estudiante';

    const nuevoCertificado = {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      detalle,
      nombreCompleto,
      ...(temaId ? { temaId } : {}),
      ...(nivel ? { nivel: parseInt(nivel, 10) } : {})
    };

    const creado = await almacen.agregar('certificados', nuevoCertificado);
    res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
});

export default router;
