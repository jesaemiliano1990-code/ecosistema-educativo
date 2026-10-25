/**
 * servidor/rutas/mensajes.js
 * Mensajería privada casi en tiempo real: contactos, conversaciones, mensajes, difusión,
 * bloqueo y moderación. Las colecciones conversaciones, bloqueos y mensajes/<convId> solo
 * se tocan desde aquí (permisos.json: "servidor").
 *
 * Las rutas fijas (/mensajes/contactos, /mensajes/difusion…) se declaran antes de /mensajes/:convId.
 */

import { Router } from 'express';
import * as almacen from '../almacen.js';

const router = Router();

const MAX_TEXTO = 2000;
const MAX_POR_PAGINA = 50;
const MAX_POR_MINUTO = 30;
const RE_CONV = /^con_\d{6}$/;
const RE_MSG = /^men_\d{6}$/;

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

function exigirSesion(req) {
  if (!req.usuario) throw fallo('No autenticado', 401);
  return req.usuario;
}

// ----------------------------------------------------
// UTILIDADES
// ----------------------------------------------------

// Exclusión mutua por clave: evita pisar escrituras sobre la misma conversación.
const candados = new Map();
function conCandado(clave, tarea) {
  const previa = candados.get(clave) || Promise.resolve();
  const actual = previa.then(tarea, tarea);
  candados.set(clave, actual.catch(() => {}));
  return actual;
}

// Máximo 30 mensajes por minuto y persona (en memoria).
const envios = new Map();
function consumirCupo(usuarioId, cantidad = 1) {
  const ahora = Date.now();
  const recientes = (envios.get(usuarioId) || []).filter((t) => ahora - t < 60000);
  if (recientes.length + cantidad > MAX_POR_MINUTO) {
    throw fallo('Estás enviando mensajes muy rápido. Espera un momento.', 429);
  }
  for (let i = 0; i < cantidad; i++) recientes.push(ahora);
  envios.set(usuarioId, recientes);
}

function numeroDeId(id) {
  return parseInt(String(id).split('_')[1], 10);
}

function textoValido(valor) {
  if (typeof valor !== 'string') throw fallo('Escribe el mensaje', 400);
  const texto = valor.trim();
  if (!texto) throw fallo('Escribe el mensaje', 400);
  if (texto.length > MAX_TEXTO) throw fallo(`El mensaje supera los ${MAX_TEXTO} caracteres`, 400);
  return texto;
}

const resumen = (u) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, rol: u.rol });

// Foto de los datos que usan casi todas las rutas.
async function contexto() {
  const [usuarios, distributivo, bloqueos, ajustes] = await Promise.all([
    almacen.leer('usuarios'),
    almacen.leer('distributivo'),
    almacen.leer('bloqueos'),
    almacen.leerConfig('ajustes')
  ]);
  return { usuarios, distributivo, bloqueos, ajustes: ajustes || {}, porId: new Map(usuarios.map((u) => [u.id, u])) };
}

const activo = (u) => Boolean(u) && u.activo !== false;

// Quiénes podrían ser contacto de una persona, sin mirar bloqueos.
function contactosBase(yo, ctx) {
  const ids = new Set();
  const activos = ctx.usuarios.filter((u) => activo(u) && u.id !== yo.id);
  if (yo.rol === 'admin') {
    activos.forEach((u) => ids.add(u.id));
  } else if (yo.rol === 'docente') {
    ctx.distributivo.filter((g) => g.docenteId === yo.id).forEach((g) => (g.estudiantes || []).forEach((e) => ids.add(e)));
    activos.filter((u) => u.rol === 'docente').forEach((u) => ids.add(u.id));
  } else {
    const misGrupos = ctx.distributivo.filter((g) => (g.estudiantes || []).includes(yo.id));
    misGrupos.forEach((g) => g.docenteId && ids.add(g.docenteId));
    if (ctx.ajustes.chatEntreEstudiantes !== false) {
      misGrupos.forEach((g) => (g.estudiantes || []).forEach((e) => ids.add(e)));
    }
  }
  ids.delete(yo.id);
  return new Set([...ids].filter((id) => activo(ctx.porId.get(id))));
}

const bloqueado = (a, b, ctx) =>
  ctx.bloqueos.some((x) => (x.usuarioId === a && x.bloqueadoId === b) || (x.usuarioId === b && x.bloqueadoId === a));

// Contactos visibles: base menos bloqueos en ambos sentidos.
function contactosDe(yo, ctx) {
  return [...contactosBase(yo, ctx)].filter((id) => !bloqueado(yo.id, id, ctx));
}

/**
 * Se puede escribir si no hay bloqueo, la otra persona está activa y alguno de los dos
 * la tiene como contacto (así un estudiante puede responder a un admin que le escribió).
 */
function puedeEscribir(yo, otroId, ctx) {
  const otro = ctx.porId.get(otroId);
  if (!activo(otro) || bloqueado(yo.id, otroId, ctx)) return false;
  return contactosBase(yo, ctx).has(otroId) || contactosBase(otro, ctx).has(yo.id);
}

async function conversacionDe(usuario, convId) {
  if (!RE_CONV.test(convId)) throw fallo('Conversación no encontrada', 404);
  const conv = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
  if (!conv || !conv.participantes.includes(usuario.id)) throw fallo('Conversación no encontrada', 404);
  return conv;
}

const visibles = (mensajes) => mensajes.filter((m) => !m.oculto);

function noLeidosDe(conv, mensajes, yoId) {
  const hasta = conv.leidoHasta?.[yoId] || '';
  return visibles(mensajes).filter((m) => m.autorId !== yoId && m.fecha > hasta).length;
}

function publico(m) {
  return { id: m.id, autorId: m.autorId, texto: m.texto, fecha: m.fecha };
}

async function armarItem(conv, yoId, ctx, mensajes) {
  const otroId = conv.participantes.find((p) => p !== yoId);
  const otro = ctx.porId.get(otroId);
  const lista = mensajes || (await almacen.leer(`mensajes/${conv.id}`));
  const yo = ctx.porId.get(yoId);
  return {
    id: conv.id,
    fecha: conv.fecha,
    otro: otro ? { ...resumen(otro), activo: activo(otro) } : { id: otroId, nombre: 'Usuario', apellido: 'eliminado', rol: '', activo: false },
    ultimo: conv.ultimo || null,
    noLeidos: noLeidosDe(conv, lista, yoId),
    bloqueadoPorMi: ctx.bloqueos.some((b) => b.usuarioId === yoId && b.bloqueadoId === otroId),
    // No se dice quién bloqueó: solo que ya no se puede escribir.
    sinEnvio: !yo || !puedeEscribir(yo, otroId, ctx)
  };
}

// Agrega un mensaje y actualiza el resumen de la conversación (último mensaje y lectura del autor).
async function agregarMensaje(convId, autor, texto) {
  return conCandado(`conv:${convId}`, async () => {
    const mensaje = await almacen.agregar(`mensajes/${convId}`, { autorId: autor.id, texto, oculto: false });
    const conv = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
    await almacen.actualizar('conversaciones', convId, {
      ultimo: { texto: texto.slice(0, 200), fecha: mensaje.fecha, autorId: autor.id },
      leidoHasta: { ...(conv?.leidoHasta || {}), [autor.id]: mensaje.fecha }
    });
    return mensaje;
  });
}

// Busca la conversación entre dos personas o la crea (una sola por pareja).
function buscarOCrear(aId, bId) {
  return conCandado('crear-conversaciones', async () => {
    const existente = (await almacen.leer('conversaciones')).find(
      (c) => c.participantes.length === 2 && c.participantes.includes(aId) && c.participantes.includes(bId)
    );
    if (existente) return existente;
    return almacen.agregar('conversaciones', { participantes: [aId, bId], ultimo: null, leidoHasta: {} });
  });
}

async function recalcularUltimo(convId) {
  await conCandado(`conv:${convId}`, async () => {
    const ultimoVisible = visibles(await almacen.leer(`mensajes/${convId}`)).pop();
    await almacen.actualizar('conversaciones', convId, {
      ultimo: ultimoVisible ? { texto: ultimoVisible.texto.slice(0, 200), fecha: ultimoVisible.fecha, autorId: ultimoVisible.autorId } : null
    });
  });
}

// ----------------------------------------------------
// RUTAS FIJAS
// ----------------------------------------------------

// GET /mensajes/contactos
router.get('/mensajes/contactos', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const ctx = await contexto();
    const contactos = contactosDe(yo, ctx).map((id) => resumen(ctx.porId.get(id)));
    contactos.sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));
    res.json(contactos);
  } catch (error) {
    next(error);
  }
});

// GET /mensajes/conversaciones → mis conversaciones, la más reciente primero
router.get('/mensajes/conversaciones', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const ctx = await contexto();
    const mias = (await almacen.leer('conversaciones')).filter((c) => c.participantes.includes(yo.id));
    const items = await Promise.all(mias.map((c) => armarItem(c, yo.id, ctx)));
    items.sort((a, b) => String(b.ultimo?.fecha || b.fecha).localeCompare(String(a.ultimo?.fecha || a.fecha)));
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/conversaciones { con } → busca o crea (solo con contactos permitidos)
router.post('/mensajes/conversaciones', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const conId = req.body?.con;
    if (typeof conId !== 'string' || !conId) throw fallo('Indica con quién quieres hablar', 400);
    const ctx = await contexto();
    if (!contactosDe(yo, ctx).includes(conId)) throw fallo('No puedes escribir a esta persona', 403);
    const conv = await buscarOCrear(yo.id, conId);
    res.json(await armarItem(conv, yo.id, ctx));
  } catch (error) {
    next(error);
  }
});

// GET /mensajes/no-leidos → { total }
router.get('/mensajes/no-leidos', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const mias = (await almacen.leer('conversaciones')).filter((c) => c.participantes.includes(yo.id));
    let total = 0;
    for (const c of mias) total += noLeidosDe(c, await almacen.leer(`mensajes/${c.id}`), yo.id);
    res.json({ total });
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/difusion { grupoId, texto } → el docente del grupo escribe a cada estudiante
router.post('/mensajes/difusion', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    if (yo.rol !== 'docente') throw fallo('Solo el docente del grupo envía mensajes al curso', 403);
    const texto = textoValido(req.body?.texto);
    const ctx = await contexto();
    const grupo = ctx.distributivo.find((g) => g.id === req.body?.grupoId);
    if (!grupo || grupo.docenteId !== yo.id) throw fallo('Ese grupo no es tuyo', 403);
    consumirCupo(yo.id);

    let enviados = 0;
    let omitidos = 0;
    for (const estudianteId of grupo.estudiantes || []) {
      if (!puedeEscribir(yo, estudianteId, ctx)) { omitidos++; continue; }
      const conv = await buscarOCrear(yo.id, estudianteId);
      await agregarMensaje(conv.id, yo, texto);
      enviados++;
    }
    res.status(201).json({ enviados, omitidos, total: (grupo.estudiantes || []).length });
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/bloquear { usuarioId } · DELETE /mensajes/bloquear/:usuarioId
router.post('/mensajes/bloquear', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const objetivoId = req.body?.usuarioId;
    const ctx = await contexto();
    const objetivo = ctx.porId.get(objetivoId);
    if (!objetivo) throw fallo('Usuario no encontrado', 404);
    if (objetivo.id === yo.id) throw fallo('No puedes bloquearte a ti mismo', 400);
    if (objetivo.rol === 'admin') throw fallo('No se puede bloquear a un administrador', 403);
    await conCandado('bloqueos', async () => {
      const ya = (await almacen.leer('bloqueos')).some((b) => b.usuarioId === yo.id && b.bloqueadoId === objetivo.id);
      if (!ya) await almacen.agregar('bloqueos', { usuarioId: yo.id, bloqueadoId: objetivo.id });
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/mensajes/bloquear/:usuarioId', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    await conCandado('bloqueos', async () => {
      const mios = (await almacen.leer('bloqueos')).filter((b) => b.usuarioId === yo.id && b.bloqueadoId === req.params.usuarioId);
      for (const b of mios) await almacen.eliminar('bloqueos', b.id);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// MODERACIÓN (admin)
// ----------------------------------------------------

function partirReferencia(referenciaId) {
  const [convId, mensajeId] = String(referenciaId || '').split('/');
  if (!RE_CONV.test(convId || '') || !RE_MSG.test(mensajeId || '')) throw fallo('Referencia de mensaje no válida', 400);
  return { convId, mensajeId };
}

// GET /mensajes/reporte/:reporteId → el mensaje reportado y los 5 anteriores
router.get('/mensajes/reporte/:reporteId', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    if (yo.rol !== 'admin') throw fallo('Solo el administrador revisa reportes', 403);
    const reporte = (await almacen.leer('reportes')).find((r) => r.id === req.params.reporteId);
    if (!reporte || reporte.tipo !== 'mensaje') throw fallo('Reporte no encontrado', 404);
    const { convId, mensajeId } = partirReferencia(reporte.referenciaId);

    const conv = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
    const mensajes = await almacen.leer(`mensajes/${convId}`);
    const indice = mensajes.findIndex((m) => m.id === mensajeId);
    if (!conv || indice < 0) return res.json({ reporte, mensaje: null, anteriores: [], participantes: [] });

    const porId = new Map((await almacen.leer('usuarios')).map((u) => [u.id, u]));
    const conAutor = (m) => ({ ...publico(m), oculto: Boolean(m.oculto), autor: porId.get(m.autorId) ? resumen(porId.get(m.autorId)) : null });
    res.json({
      reporte,
      mensaje: conAutor(mensajes[indice]),
      anteriores: mensajes.slice(Math.max(0, indice - 5), indice).map(conAutor),
      participantes: conv.participantes.map((id) => (porId.get(id) ? { ...resumen(porId.get(id)), activo: activo(porId.get(id)) } : { id }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/ocultar { referenciaId: "<convId>/<mensajeId>" }
router.post('/mensajes/ocultar', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    if (yo.rol !== 'admin') throw fallo('Solo el administrador oculta mensajes', 403);
    const { convId, mensajeId } = partirReferencia(req.body?.referenciaId);
    const existe = (await almacen.leer(`mensajes/${convId}`)).some((m) => m.id === mensajeId);
    if (!existe) throw fallo('Mensaje no encontrado', 404);
    await almacen.actualizar(`mensajes/${convId}`, mensajeId, { oculto: true });
    await recalcularUltimo(convId); // la lista de conversaciones no debe seguir mostrando el texto oculto
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// UNA CONVERSACIÓN
// ----------------------------------------------------

// GET /mensajes/:convId?desde=<mensajeId>&antes=<mensajeId> → hasta 50 mensajes (sin los ocultos)
router.get('/mensajes/:convId', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const conv = await conversacionDe(yo, req.params.convId);
    const { desde, antes } = req.query;
    for (const v of [desde, antes]) if (v !== undefined && !RE_MSG.test(String(v))) throw fallo('Parámetro no válido', 400);

    const todos = visibles(await almacen.leer(`mensajes/${conv.id}`));
    let seleccion;
    let hayMas;
    if (desde) {
      const nuevos = todos.filter((m) => numeroDeId(m.id) > numeroDeId(desde));
      seleccion = nuevos.slice(0, MAX_POR_PAGINA);
      hayMas = nuevos.length > seleccion.length;
    } else {
      const previos = antes ? todos.filter((m) => numeroDeId(m.id) < numeroDeId(antes)) : todos;
      seleccion = previos.slice(-MAX_POR_PAGINA);
      hayMas = previos.length > seleccion.length;
    }
    const ctx = await contexto();
    res.json({ conversacion: await armarItem(conv, yo.id, ctx), mensajes: seleccion.map(publico), hayMas });
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/:convId { texto } → envía un mensaje
router.post('/mensajes/:convId', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const conv = await conversacionDe(yo, req.params.convId);
    const texto = textoValido(req.body?.texto);
    const ctx = await contexto();
    const otroId = conv.participantes.find((p) => p !== yo.id);
    if (!puedeEscribir(yo, otroId, ctx)) throw fallo('No puedes enviar mensajes a esta persona', 403);
    consumirCupo(yo.id);
    res.status(201).json(publico(await agregarMensaje(conv.id, yo, texto)));
  } catch (error) {
    next(error);
  }
});

// POST /mensajes/:convId/leido → marca la conversación como leída hasta el último mensaje
router.post('/mensajes/:convId/leido', async (req, res, next) => {
  try {
    const yo = exigirSesion(req);
    const conv = await conversacionDe(yo, req.params.convId);
    await conCandado(`conv:${conv.id}`, async () => {
      const ultimo = (await almacen.leer(`mensajes/${conv.id}`)).filter((m) => !m.oculto).pop();
      const actual = (await almacen.leer('conversaciones')).find((c) => c.id === conv.id);
      await almacen.actualizar('conversaciones', conv.id, {
        leidoHasta: { ...(actual?.leidoHasta || {}), [yo.id]: ultimo ? ultimo.fecha : new Date().toISOString() }
      });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
