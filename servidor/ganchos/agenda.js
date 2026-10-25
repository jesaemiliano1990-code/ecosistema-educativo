import * as almacen from '../almacen.js';
import { gruposDe, asignaturaDeTema } from '../acceso.js';
import { fallo, nombreDe, textoValido, booleano, idsDeAsignaturas } from '../foros.js';

/**
 * Gancho para la colección 'agenda'.
 * Cada persona ve sus eventos y los de sus grupos; solo el propietario edita o elimina.
 * Solo docente y admin ponen un evento en un grupo (de sus grupos).
 */

const TIPOS = ['tarea', 'reunion', 'fecha-limite', 'recordatorio'];
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECORDATORIOS = 5;
const MAX_MINUTOS = 60 * 24 * 30; // hasta 30 días antes

async function idsDeGrupos(usuario) {
  return new Set((await gruposDe(usuario)).map((g) => g && g.id).filter(Boolean));
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  const grupos = await idsDeGrupos(usuario);
  return lista.filter((e) => e && (e.propietarioId === usuario.id || (e.grupoId && grupos.has(e.grupoId))));
}

export async function puedeVer(registro, usuario) {
  return (await filtrarLista([registro], usuario)).length > 0;
}

// Fecha y hora completa (ISO) o, si dura todo el día, solo "AAAA-MM-DD".
function momento(valor, campo, todoElDia) {
  if (typeof valor !== 'string') throw fallo(`Falta ${campo}`, 400);
  if (todoElDia ? !SOLO_FECHA.test(valor) : (SOLO_FECHA.test(valor) || !valor.includes('T'))) {
    throw fallo(`${campo[0].toUpperCase()}${campo.slice(1)} no tiene un formato válido`, 400);
  }
  const t = new Date(valor).getTime();
  if (!Number.isFinite(t)) throw fallo(`${campo[0].toUpperCase()}${campo.slice(1)} no es una fecha válida`, 400);
  return valor;
}

function recordatoriosValidos(lista) {
  if (!Array.isArray(lista)) throw fallo('Los recordatorios deben ser una lista de minutos', 400);
  if (lista.length > MAX_RECORDATORIOS) throw fallo(`Máximo ${MAX_RECORDATORIOS} recordatorios`, 400);
  const minutos = lista.map(Number);
  if (minutos.some((m) => !Number.isInteger(m) || m < 0 || m > MAX_MINUTOS)) throw fallo('Recordatorio no válido', 400);
  return [...new Set(minutos)].sort((a, b) => b - a);
}

// El grupo debe ser uno de los del docente (el admin puede cualquiera); el tema, de la asignatura del grupo.
async function validarVinculos(e, usuario) {
  if (e.grupoId) {
    if (usuario.rol !== 'docente' && usuario.rol !== 'admin') throw fallo('Solo docente y admin pueden poner un evento en un grupo', 403);
    const grupo = (await gruposDe(usuario)).find((g) => g && g.id === e.grupoId);
    if (!grupo) throw fallo('Ese grupo no es tuyo', 403);
    e.asignaturaDelGrupo = grupo.asignaturaId;
  }
  if (e.actividad && !/^[a-z-]{2,40}$/.test(e.actividad)) throw fallo('Actividad no válida', 400);
  if (e.temaId) {
    const asignaturaId = await asignaturaDeTema(e.temaId);
    if (!asignaturaId) throw fallo('Tema no encontrado', 404);
    if (e.asignaturaDelGrupo ? asignaturaId !== e.asignaturaDelGrupo : !(await idsDeAsignaturas(usuario)).has(asignaturaId)) {
      throw fallo('El tema no pertenece a esa asignatura', 400);
    }
  }
  delete e.asignaturaDelGrupo;
}

// Construye el evento completo y validado a partir de lo que llegó (solo campos permitidos).
async function armar(datos, usuario) {
  const tipo = datos.tipo;
  if (!TIPOS.includes(tipo)) throw fallo('Tipo de evento no válido', 400);
  const todoElDia = booleano(datos.todoElDia ?? false, 'Todo el día');
  const inicio = momento(datos.inicio, 'el inicio', todoElDia);
  let fin = null;
  if (datos.fin !== undefined && datos.fin !== null && datos.fin !== '') {
    fin = momento(datos.fin, 'el fin', todoElDia);
    if (new Date(fin).getTime() < new Date(inicio).getTime()) throw fallo('El fin no puede ser anterior al inicio', 400);
  }
  const evento = {
    titulo: textoValido(datos.titulo, 'el título', 1, 120),
    tipo,
    inicio,
    fin,
    todoElDia,
    grupoId: datos.grupoId || null,
    // La actividad y el tema solo tienen sentido en una fecha límite.
    actividad: tipo === 'fecha-limite' && datos.actividad ? datos.actividad : null,
    temaId: tipo === 'fecha-limite' && datos.temaId ? datos.temaId : null,
    recordatorios: recordatoriosValidos(datos.recordatorios ?? [])
  };
  await validarVinculos(evento, usuario);
  return evento;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) throw fallo('No autenticado', 401);

  // ---- Crear
  if (!anterior) {
    return {
      ...(await armar(datos, usuario)),
      propietarioId: usuario.id,
      propietarioNombre: nombreDe(usuario),
      propietarioRol: usuario.rol,
      avisados: {}
    };
  }

  // ---- Editar: solo el propietario. Se valida el evento completo con los cambios aplicados.
  if (!(await puedeVer(anterior, usuario))) throw fallo('Evento no encontrado', 404);
  if (anterior.propietarioId !== usuario.id) throw fallo('Solo quien creó el evento puede editarlo', 403);
  const nuevo = await armar({ ...anterior, ...datos }, usuario);

  // Si cambia la hora o los recordatorios, los avisos ya enviados dejan de valer.
  const cambioHorario = nuevo.inicio !== anterior.inicio || JSON.stringify(nuevo.recordatorios) !== JSON.stringify(anterior.recordatorios || []);
  return { ...nuevo, ...(cambioHorario ? { avisados: {} } : {}) };
}

export async function antesDeEliminar(registro, usuario) {
  if (!(await puedeVer(registro, usuario))) throw fallo('Evento no encontrado', 404);
  if (registro.propietarioId !== usuario.id) throw fallo('Solo quien creó el evento puede eliminarlo', 403);
}

export default {
  filtrarLista,
  puedeVer,
  antesDeGuardar,
  antesDeEliminar
};
