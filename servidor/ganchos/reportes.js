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
    if (datos.tipo !== undefined && datos.tipo !== 'foro') throw fallo('Por ahora solo se reportan publicaciones del foro', 400);
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
    if (!['ocultado', 'descartado', null].includes(datos.resolucion)) throw fallo('Resolución no válida', 400);
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
