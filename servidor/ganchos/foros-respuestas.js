import * as almacen from '../almacen.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';
import { filtrarLista as filtrarHilos, puedeVer as puedeVerHilo } from './foros-hilos.js';
import {
  fallo, nombreDe, dentroDeVentana, esModerador, textoValido, booleano, recalcularHilo, enlaceHilo, MAX_TEXTO
} from '../foros.js';

/**
 * Gancho para la colección 'foros-respuestas'.
 * Una respuesta se ve si se ve su hilo; las ocultas solo las ven docente y admin.
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  const hilos = await filtrarHilos(await almacen.leer('foros-hilos'), usuario);
  const visibles = new Set(hilos.map((h) => h.id));
  const verOcultas = usuario.rol === 'admin' || usuario.rol === 'docente';
  return lista.filter((r) => r && visibles.has(r.hiloId) && (verOcultas || !r.oculta));
}

export async function puedeVer(registro, usuario) {
  return (await filtrarLista([registro], usuario)).length > 0;
}

async function hiloDe(hiloId) {
  const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === hiloId);
  if (!hilo) throw fallo('Hilo no encontrado', 404);
  return hilo;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) throw fallo('No autenticado', 401);

  // ---- Creación
  if (!anterior) {
    if (typeof datos.hiloId !== 'string') throw fallo('Falta el hilo', 400);
    const hilo = await hiloDe(datos.hiloId);
    if (!(await puedeVerHilo(hilo, usuario))) throw fallo('Hilo no encontrado', 404);
    if (hilo.cerrado) throw fallo('Este hilo está cerrado: ya no admite respuestas', 409);
    if (hilo.oculto) throw fallo('Este hilo está oculto: no admite respuestas', 409);
    return {
      hiloId: hilo.id,
      texto: textoValido(datos.texto, 'el texto', 1, MAX_TEXTO),
      autorId: usuario.id,
      autorNombre: nombreDe(usuario),
      autorRol: usuario.rol,
      destacada: false,
      oculta: false
    };
  }

  // ---- Edición
  if (!(await puedeVer(anterior, usuario))) throw fallo('Respuesta no encontrada', 404);
  const hilo = await hiloDe(anterior.hiloId);
  const moderador = await esModerador(usuario, hilo.asignaturaId);
  const cambios = {};

  if (datos.texto !== undefined) {
    const esAutorEnPlazo = anterior.autorId === usuario.id && dentroDeVentana(anterior) && !anterior.oculta && !hilo.cerrado;
    if (!moderador && !esAutorEnPlazo) throw fallo('Solo puedes editar tu respuesta durante los primeros 15 minutos', 403);
    cambios.texto = textoValido(datos.texto, 'el texto', 1, MAX_TEXTO);
  }

  for (const marca of ['destacada', 'oculta']) {
    if (datos[marca] === undefined || datos[marca] === anterior[marca]) continue;
    if (!moderador) throw fallo('Solo el docente o el administrador pueden moderar respuestas', 403);
    cambios[marca] = booleano(datos[marca], marca);
  }
  return cambios;
}

/**
 * Al crear: actualiza el hilo, avisa a su autor (si es otra persona) y suma el punto de participación.
 * Al ocultar o mostrar: recalcula el contador de respuestas visibles.
 */
export async function despuesDeGuardar(registro, usuario, anterior) {
  try {
    if (anterior) {
      if (anterior.oculta !== registro.oculta) await recalcularHilo(registro.hiloId);
      return;
    }

    await recalcularHilo(registro.hiloId, { movimiento: true });

    const hilo = await hiloDe(registro.hiloId);
    if (hilo.autorId !== usuario.id) {
      await notificar(hilo.autorId, {
        tipo: 'foro',
        mensaje: `${registro.autorNombre} respondió a tu hilo "${hilo.titulo}".`,
        enlace: enlaceHilo(hilo.id)
      });
    }
  } catch (error) {
    console.warn('Foro: no se pudo actualizar el hilo o avisar al autor:', error.message);
  }

  // El punto es un extra: si falla (límites diarios), la respuesta ya quedó publicada.
  if (!anterior) {
    try {
      await procesarIntento(usuario, { actividad: 'foro', puntaje: 1, maximo: 1 });
    } catch (error) {
      console.warn('Foro: no se pudo registrar el punto de participación:', error.message);
    }
  }
}

// Solo moderadores borran respuestas.
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol === 'admin') return;
  const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === registro.hiloId);
  if (!hilo || !(await esModerador(usuario, hilo.asignaturaId))) {
    throw fallo('Solo el docente o el administrador pueden eliminar respuestas', 403);
  }
}

export async function despuesDeEliminar(registro) {
  try {
    await recalcularHilo(registro.hiloId);
    const reportes = await almacen.leer('reportes');
    for (const rep of reportes) {
      if (rep.coleccion === 'foros-respuestas' && rep.referenciaId === registro.id && rep.estado === 'pendiente') {
        await almacen.actualizar('reportes', rep.id, { estado: 'resuelto', resolucion: 'contenido-eliminado' });
      }
    }
  } catch (error) {
    console.warn('Foro: no se pudo actualizar el hilo tras eliminar la respuesta:', error.message);
  }
}

export default {
  filtrarLista,
  puedeVer,
  antesDeGuardar,
  despuesDeGuardar,
  antesDeEliminar,
  despuesDeEliminar
};
