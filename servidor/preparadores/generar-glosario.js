// Prepara los datos de la tarea generar-glosario a partir del tema (el navegador solo envía identificadores).
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

export default async function preparar(cuerpo, usuario) {
  const { temaId } = cuerpo;
  const cantidad = Number.isInteger(cuerpo.cantidad) ? cuerpo.cantidad : 10;
  if (typeof temaId !== 'string' || !temaId) throw fallo('Falta el tema', 400);
  if (cantidad < 5 || cantidad > 20) throw fallo('La cantidad debe estar entre 5 y 20', 400);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) throw fallo('Tema no encontrado', 404);

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) throw fallo('No puedes editar este tema', 403);

  const asignatura = (await almacen.leer('asignaturas')).find((a) => a.id === asignaturaId);
  const objetivos = (tema.objetivos || []).map((o) => `- ${o}`);
  const ejemplos = (tema.ejemplos || []).map((e) => `- ${e}`);
  if (!tema.resumen && !objetivos.length) throw fallo('El tema no tiene contenido suficiente para generar términos', 400);

  const contenido = [
    objetivos.length ? `Objetivos:\n${objetivos.join('\n')}` : '',
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    ejemplos.length ? `Ejemplos:\n${ejemplos.join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  const existentes = (await almacen.buscar('glosario', { temaId })).map((g) => g.termino);

  return {
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || '',
    tema: tema.titulo,
    contenido,
    existentes: existentes.length ? existentes : ['(ninguno)'],
    cantidad,
    minimoSeisLetras: 3
  };
}
