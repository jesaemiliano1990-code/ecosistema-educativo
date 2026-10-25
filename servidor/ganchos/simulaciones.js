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
const MAX_CRITERIOS = 5;

const fallo = (mensaje, estado = 400) => Object.assign(new Error(mensaje), { estado });
const texto = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');
const puntosOpcion = (valor) => {
  const n = valor === undefined || valor === '' ? 0 : Number(valor);
  if (!Number.isInteger(n) || n < -10 || n > 10) throw fallo('Los puntos de cada opción son un número entero de -10 a 10');
  return n;
};
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
        puntos: puntosOpcion(o?.puntos),
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
    if (e.opciones.length && (e.opciones.length < 2 || e.opciones.length > 4)) {
      throw fallo(`La escena "${e.id}" necesita de 2 a 4 opciones (o ninguna si es un final)`);
    }
    for (const o of e.opciones) {
      if (!o.texto) throw fallo(`Una opción de la escena "${e.id}" no tiene texto`);
      if (!ids.has(o.destino)) throw fallo(`Una opción de la escena "${e.id}" apunta a una escena que no existe`);
      if (!o.consecuencia) throw fallo(`Una opción de la escena "${e.id}" no tiene consecuencia`);
    }
  }

  // Todas alcanzables desde la inicial y sin ciclos (recorrido en profundidad).
  const porId = new Map(escenas.map((e) => [e.id, e]));
  const estado = new Map(); // 1 = en el camino actual, 2 = terminada
  const visitar = (id) => {
    estado.set(id, 1);
    for (const o of porId.get(id).opciones) {
      if (estado.get(o.destino) === 1) throw fallo(`El escenario tiene un ciclo: la escena "${o.destino}" vuelve a sí misma`);
      if (!estado.has(o.destino)) visitar(o.destino);
    }
    estado.set(id, 2);
  };
  visitar(escenaInicial);
  const huerfana = escenas.find((e) => !estado.has(e.id));
  if (huerfana) throw fallo(`La escena "${huerfana.id}" no se puede alcanzar desde la escena inicial`);
}

function validarRol(p, rubrica, maxTurnos) {
  for (const [campo, nombre] of [['nombre', 'el nombre del personaje'], ['descripcion', 'la descripción del personaje'], ['contexto', 'el contexto'], ['objetivo', 'el objetivo del estudiante']]) {
    if (!texto(p[campo], 1000)) throw fallo(`Para publicar, escribe ${nombre}`);
  }
  if (rubrica.length < 3 || rubrica.length > MAX_CRITERIOS) throw fallo('La rúbrica necesita de 3 a 5 criterios');
  if (rubrica.some((r) => !r.descripcion)) throw fallo('Cada criterio de la rúbrica necesita una descripción');
  if (!Number.isInteger(Number(maxTurnos)) || maxTurnos < 4 || maxTurnos > 12) throw fallo('El máximo de turnos va de 4 a 12');
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
  const crudos = Array.isArray(unida.rubrica) ? unida.rubrica : [];
  if (crudos.length > MAX_CRITERIOS) throw fallo(`La rúbrica admite hasta ${MAX_CRITERIOS} criterios`);
  const rubrica = crudos.map((r) => ({
    criterio: texto(r?.criterio, 100),
    descripcion: texto(r?.descripcion, 300),
    puntos: entero(r?.puntos, 1, 20, 1)
  })).filter((r) => r.criterio);

  if (modo === 'rol' && estado === 'publicado') validarRol(p, rubrica, unida.maxTurnos);

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
    maxTurnos: entero(unida.maxTurnos, 4, 12, 8)
  };
}

// Un docente solo borra simulaciones de las asignaturas que dicta.
export async function antesDeEliminar(registro, usuario) {
  if (usuario.rol === 'admin') return;
  await exigirEdicion(usuario, registro.temaId);
}

export default { filtrarLista, puedeVer, antesDeGuardar, antesDeEliminar };
