import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Gancho para la colección 'simulaciones'
 * Estudiantes: solo las publicadas de sus asignaturas. Docentes: todas las de sus asignaturas. Admin: todas.
 */

const MODOS = ['escenarios', 'rol'];
const ESTADOS = ['borrador', 'publicado'];
const MAX_ESCENAS = 40;
const MAX_OPCIONES = 6;
const MAX_CRITERIOS = 10;

const fallo = (mensaje, estado = 400) => Object.assign(new Error(mensaje), { estado });
const texto = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');
const entero = (valor, min, max, porDefecto) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : porDefecto;
};
// Solo imágenes subidas a la plataforma (/...) o https; nada de javascript: ni data:
const urlImagen = (valor) => {
  const url = texto(valor, 300);
  return /^(\/(?!\/)|https:\/\/)/.test(url) ? url : '';
};

async function asignaturasPropias(usuario) {
  const lista = await asignaturasDe(usuario);
  return new Set(lista.map((a) => (typeof a === 'string' ? a : a?.id)).filter(Boolean));
}

async function exigirEdicion(usuario, temaId) {
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) throw fallo('El tema indicado no existe', 400);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) {
    throw fallo('No tienes permiso para editar las simulaciones de esta asignatura', 403);
  }
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente' && usuario.rol !== 'estudiante') return [];

  const unidades = new Map((await almacen.leer('unidades')).map((u) => [u.id, u.asignaturaId]));
  const temas = new Map((await almacen.leer('temas')).map((t) => [t.id, unidades.get(t.unidadId)]));
  const misIds = await asignaturasPropias(usuario);
  return lista.filter((s) => {
    if (!s || !misIds.has(temas.get(s.temaId))) return false;
    return usuario.rol === 'docente' || s.estado === 'publicado';
  });
}

// La lectura por id respeta el mismo filtro que la lista.
export async function puedeVer(registro, usuario) {
  return (await filtrarLista([registro], usuario)).length > 0;
}

function normalizarEscenas(entrada) {
  if (!Array.isArray(entrada)) return [];
  if (entrada.length > MAX_ESCENAS) throw fallo(`Una simulación admite hasta ${MAX_ESCENAS} escenas`);
  const ids = new Set();
  return entrada.map((e) => {
    const id = texto(e?.id, 20);
    if (!/^[\w-]+$/.test(id)) throw fallo('Cada escena necesita un identificador válido (letras, números, guion)');
    if (ids.has(id)) throw fallo(`El identificador de escena "${id}" está repetido`);
    ids.add(id);
    const opciones = Array.isArray(e.opciones) ? e.opciones : [];
    if (opciones.length > MAX_OPCIONES) throw fallo(`Una escena admite hasta ${MAX_OPCIONES} opciones`);
    return {
      id,
      texto: texto(e.texto, 2000),
      imagen: urlImagen(e.imagen),
      opciones: opciones.map((o) => ({
        texto: texto(o?.texto, 300),
        destino: texto(o?.destino, 20),
        puntos: entero(o?.puntos, -100, 100, 0),
        consecuencia: texto(o?.consecuencia, 600)
      }))
    };
  });
}

function validarEscenarios(escenas, escenaInicial) {
  if (!escenas.length) throw fallo('Para publicar, agrega al menos una escena');
  const ids = new Set(escenas.map((e) => e.id));
  if (!ids.has(escenaInicial)) throw fallo('La escena inicial no existe');
  if (!escenas.some((e) => e.opciones.length === 0)) throw fallo('Para publicar, el escenario necesita al menos un final (escena sin opciones)');
  for (const e of escenas) {
    if (!e.texto) throw fallo(`La escena "${e.id}" no tiene texto`);
    for (const o of e.opciones) {
      if (!o.texto) throw fallo(`Una opción de la escena "${e.id}" no tiene texto`);
      if (!ids.has(o.destino)) throw fallo(`Una opción de la escena "${e.id}" apunta a una escena que no existe`);
    }
  }
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unida = { ...(anterior || {}), ...datos };
  const temaId = unida.temaId;
  if (!temaId) throw fallo('temaId es requerido');
  await exigirEdicion(usuario, temaId);
  if (anterior) await exigirEdicion(usuario, anterior.temaId); // si cambia de tema, debe poder editar ambos

  const modo = unida.modo ?? 'escenarios';
  const estado = unida.estado ?? 'borrador';
  if (!MODOS.includes(modo)) throw fallo('Modo de simulación no válido');
  if (!ESTADOS.includes(estado)) throw fallo('Estado de simulación no válido');
  const titulo = texto(unida.titulo, 150);
  if (!titulo) throw fallo('El título es requerido');

  const escenas = normalizarEscenas(unida.escenas);
  const escenaInicial = texto(unida.escenaInicial, 20) || escenas[0]?.id || '';
  if (modo === 'escenarios' && estado === 'publicado') validarEscenarios(escenas, escenaInicial);

  const p = unida.personaje && typeof unida.personaje === 'object' ? unida.personaje : {};
  const rubrica = (Array.isArray(unida.rubrica) ? unida.rubrica : []).slice(0, MAX_CRITERIOS).map((r) => ({
    criterio: texto(r?.criterio, 100),
    descripcion: texto(r?.descripcion, 300),
    puntos: entero(r?.puntos, 1, 100, 1)
  })).filter((r) => r.criterio);

  // Lista blanca: ningún otro campo del cliente llega al archivo.
  return {
    temaId,
    titulo,
    modo,
    estado,
    escenaInicial,
    escenas,
    personaje: {
      nombre: texto(p.nombre, 100),
      descripcion: texto(p.descripcion, 600),
      contexto: texto(p.contexto, 1000),
      objetivo: texto(p.objetivo, 600)
    },
    rubrica,
    maxTurnos: entero(unida.maxTurnos, 2, 20, 8)
  };
}

// Un docente solo borra simulaciones de las asignaturas que dicta.
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol === 'admin') return;
  await exigirEdicion(usuario, registro.temaId);
}

export default { filtrarLista, puedeVer, antesDeGuardar, antesDeEliminar };
