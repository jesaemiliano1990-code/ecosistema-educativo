import * as almacen from '../almacen.js';
import { puedeVer as puedeVerHilo } from './foros-hilos.js';
import { puedeVer as puedeVerRespuesta } from './foros-respuestas.js';
import { fallo, nombreDe, textoValido } from '../foros.js';

/**
 * Gancho para la colección 'reportes'.
 * Cualquier persona con sesión reporta contenido que puede ver; solo el admin lee, resuelve y borra.
 */

const COLECCIONES = {
  'foros-hilos': puedeVerHilo,
  'foros-respuestas': puedeVerRespuesta
};

// Reporte de un mensaje privado: solo quien participa en la conversación, y solo mensajes de la otra persona.
async function reporteDeMensaje(datos, usuario) {
  const motivo = textoValido(datos.motivo, 'el motivo', 3, 500);
  const [convId, mensajeId] = String(datos.referenciaId || '').split('/');
  if (!/^con_\d{6}$/.test(convId || '') || !/^men_\d{6}$/.test(mensajeId || '')) throw fallo('Indica qué mensaje reportas', 400);

  const conv = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
  const mensaje = conv && conv.participantes.includes(usuario.id)
    ? (await almacen.leer(`mensajes/${convId}`)).find((m) => m.id === mensajeId && !m.oculto)
    : null;
  if (!mensaje) throw fallo('Mensaje no encontrado', 404);
  if (mensaje.autorId === usuario.id) throw fallo('No puedes reportar tus propios mensajes', 400);

  const referenciaId = `${convId}/${mensajeId}`;
  const yaReportado = (await almacen.leer('reportes')).some(
    (r) => r.reportadoPor === usuario.id && r.tipo === 'mensaje' && r.referenciaId === referenciaId && r.estado === 'pendiente'
  );
  if (yaReportado) throw fallo('Ya reportaste este mensaje; el administrador lo revisará', 409);

  return {
    tipo: 'mensaje',
    coleccion: 'mensajes',
    referenciaId,
    autorMensajeId: mensaje.autorId,
    motivo,
    reportadoPor: usuario.id,
    reportadoPorNombre: nombreDe(usuario),
    estado: 'pendiente',
    resolucion: null
  };
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || usuario.rol !== 'admin') return [];
  return lista;
}

export async function puedeVer(registro, usuario) {
  return Boolean(usuario) && usuario.rol === 'admin';
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) throw fallo('No autenticado', 401);

  // ---- Crear un reporte
  if (!anterior) {
    if (datos.tipo === 'mensaje') return reporteDeMensaje(datos, usuario);
    if (datos.tipo !== undefined && datos.tipo !== 'foro') throw fallo('Tipo de reporte no válido', 400);
    const puedeVer = COLECCIONES[datos.coleccion];
    if (!puedeVer || typeof datos.referenciaId !== 'string') throw fallo('Indica qué publicación reportas', 400);

    const motivo = textoValido(datos.motivo, 'el motivo', 3, 500);
    const contenido = (await almacen.leer(datos.coleccion)).find((x) => x.id === datos.referenciaId);
    if (!contenido || !(await puedeVer(contenido, usuario))) throw fallo('Publicación no encontrada', 404);

    const yaReportado = (await almacen.leer('reportes')).some(
      (r) => r.reportadoPor === usuario.id && r.coleccion === datos.coleccion && r.referenciaId === datos.referenciaId && r.estado === 'pendiente'
    );
    if (yaReportado) throw fallo('Ya reportaste esta publicación; el administrador la revisará', 409);

    return {
      tipo: 'foro',
      coleccion: datos.coleccion,
      referenciaId: datos.referenciaId,
      motivo,
      reportadoPor: usuario.id,
      reportadoPorNombre: nombreDe(usuario),
      estado: 'pendiente',
      resolucion: null
    };
  }

  // ---- Resolver un reporte: solo el administrador
  if (usuario.rol !== 'admin') throw fallo('Solo el administrador resuelve los reportes', 403);
  const cambios = {};
  if (datos.estado !== undefined) {
    if (!['pendiente', 'resuelto'].includes(datos.estado)) throw fallo('Estado de reporte no válido', 400);
    cambios.estado = datos.estado;
  }
  if (datos.resolucion !== undefined) {
    if (!['ocultado', 'descartado', 'usuario-desactivado', null].includes(datos.resolucion)) throw fallo('Resolución no válida', 400);
    cambios.resolucion = datos.resolucion;
  }
  if (cambios.estado === 'resuelto') {
    cambios.resueltoPor = usuario.id;
    cambios.fechaResolucion = new Date().toISOString();
  }
  return cambios;
}

export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol !== 'admin') throw fallo('Solo el administrador elimina reportes', 403);
}

export default {
  filtrarLista,
  puedeVer,
  antesDeGuardar,
  antesDeEliminar
};
