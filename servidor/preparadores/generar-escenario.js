// Prepara los datos de la tarea generar-escenario a partir del tema y la situación del docente.
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });
const MAX_SITUACION = 800;

export default async function preparar(cuerpo, usuario) {
  const { temaId } = cuerpo;
  const escenas = Number(cuerpo.escenas);
  const situacion = typeof cuerpo.situacion === 'string' ? cuerpo.situacion.trim() : '';
  if (typeof temaId !== 'string' || !temaId) throw fallo('Falta el tema', 400);
  if (!situacion) throw fallo('Describe la situación del escenario', 400);
  if (situacion.length > MAX_SITUACION) throw fallo(`La situación admite hasta ${MAX_SITUACION} caracteres`, 400);
  if (!Number.isInteger(escenas) || escenas < 5 || escenas > 10) throw fallo('El número de escenas debe estar entre 5 y 10', 400);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) throw fallo('Tema no encontrado', 404);

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) throw fallo('No puedes editar este tema', 403);

  const asignatura = (await almacen.leer('asignaturas')).find((a) => a.id === asignaturaId);
  const lista = (titulo, items) => (Array.isArray(items) && items.length ? `${titulo}:\n${items.map((i) => `- ${i}`).join('\n')}` : '');
  const contenido = [
    lista('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    lista('Ejemplos', tema.ejemplos),
    lista('Errores frecuentes', tema.erroresFrecuentes)
  ].filter(Boolean).join('\n\n');
  if (!contenido) throw fallo('El tema no tiene contenido suficiente para generar un escenario', 400);

  return {
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || '',
    tema: tema.titulo,
    contenido,
    situacion,
    escenas
  };
}
