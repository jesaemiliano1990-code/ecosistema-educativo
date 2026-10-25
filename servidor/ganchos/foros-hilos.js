import * as almacen from '../almacen.js';
import { asignaturaDeTema } from '../acceso.js';
import {
  fallo, nombreDe, dentroDeVentana, idsDeAsignaturas, esModerador, textoValido, booleano, MAX_TEXTO
} from '../foros.js';

/**
 * Gancho para la colección 'foros-hilos'.
 * Cada persona ve solo los hilos de sus asignaturas; los ocultos solo los ven docente y admin.
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente' && usuario.rol !== 'estudiante') return [];

  const mias = await idsDeAsignaturas(usuario);
  return lista.filter((h) => h && mias.has(h.asignaturaId) && (usuario.rol === 'docente' || !h.oculto));
}

// La lectura por id respeta el mismo filtro que la lista.
export async function puedeVer(registro, usuario) {
  return (await filtrarLista([registro], usuario)).length > 0;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) throw fallo('No autenticado', 401);

  // ---- Creación: solo los campos permitidos; las marcas de moderación nacen apagadas.
  if (!anterior) {
    const asignaturaId = datos.asignaturaId;
    if (typeof asignaturaId !== 'string' || !(await idsDeAsignaturas(usuario)).has(asignaturaId)) {
      throw fallo('No tienes acceso a esta asignatura', 403);
    }
    let temaId = null;
    if (datos.temaId) {
      if ((await asignaturaDeTema(datos.temaId)) !== asignaturaId) throw fallo('El tema no pertenece a esta asignatura', 400);
      temaId = datos.temaId;
    }
    return {
      asignaturaId,
      temaId,
      titulo: textoValido(datos.titulo, 'el título', 3, 150),
      texto: textoValido(datos.texto, 'el texto', 1, MAX_TEXTO),
      autorId: usuario.id,
      autorNombre: nombreDe(usuario),
      autorRol: usuario.rol,
      fijado: false,
      cerrado: false,
      oculto: false,
      totalRespuestas: 0,
      ultimoMovimiento: new Date().toISOString()
    };
  }

  // ---- Edición: solo se aceptan título, texto y marcas; el resto se ignora.
  if (!(await puedeVer(anterior, usuario))) throw fallo('Hilo no encontrado', 404);
  const moderador = await esModerador(usuario, anterior.asignaturaId);
  const cambios = {};

  if (datos.titulo !== undefined || datos.texto !== undefined) {
    const esAutorEnPlazo = anterior.autorId === usuario.id && dentroDeVentana(anterior) && !anterior.cerrado && !anterior.oculto;
    if (!moderador && !esAutorEnPlazo) throw fallo('Solo puedes editar tu hilo durante los primeros 15 minutos', 403);
    if (datos.titulo !== undefined) cambios.titulo = textoValido(datos.titulo, 'el título', 3, 150);
    if (datos.texto !== undefined) cambios.texto = textoValido(datos.texto, 'el texto', 1, MAX_TEXTO);
  }

  for (const marca of ['fijado', 'cerrado', 'oculto']) {
    if (datos[marca] === undefined || datos[marca] === anterior[marca]) continue;
    if (!moderador) throw fallo('Solo el docente o el administrador pueden moderar el hilo', 403);
    cambios[marca] = booleano(datos[marca], marca);
  }
  return cambios;
}

// Solo moderadores borran hilos.
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol === 'admin') return;
  if (!(await esModerador(usuario, registro.asignaturaId))) throw fallo('Solo el docente o el administrador pueden eliminar hilos', 403);
}

// Al borrar un hilo se borran sus respuestas y se cierran los reportes que apuntaban a él.
export async function despuesDeEliminar(registro) {
  const respuestas = await almacen.buscar('foros-respuestas', { hiloId: registro.id });
  const idsRespuestas = new Set(respuestas.map((r) => r.id));
  for (const r of respuestas) await almacen.eliminar('foros-respuestas', r.id);

  const reportes = await almacen.leer('reportes');
  for (const rep of reportes) {
    const apuntaAqui =
      (rep.coleccion === 'foros-hilos' && rep.referenciaId === registro.id) ||
      (rep.coleccion === 'foros-respuestas' && idsRespuestas.has(rep.referenciaId));
    if (apuntaAqui && rep.estado === 'pendiente') {
      await almacen.actualizar('reportes', rep.id, { estado: 'resuelto', resolucion: 'contenido-eliminado' });
    }
  }
}

export default {
  filtrarLista,
  puedeVer,
  antesDeGuardar,
  antesDeEliminar,
  despuesDeEliminar
};
