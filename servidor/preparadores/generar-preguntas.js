// Prepara los datos de la tarea generar-preguntas a partir del tema (el navegador solo envía identificadores).
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

const BLOOM = { 1: 'Recordar', 2: 'Comprender', 3: 'Aplicar', 4: 'Analizar', 5: 'Evaluar' };

export default async function preparar(cuerpo, usuario) {
  const { temaId } = cuerpo;
  const nivel = Number(cuerpo.nivel);
  const cantidad = Number(cuerpo.cantidad);
  if (typeof temaId !== 'string' || !temaId) throw fallo('Falta el tema', 400);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) throw fallo('El nivel debe estar entre 1 y 5', 400);
  if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 15) throw fallo('La cantidad debe estar entre 5 y 15', 400);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) throw fallo('Tema no encontrado', 404);

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!(await puedeEditarAsignatura(usuario, asignaturaId))) throw fallo('No puedes editar este tema', 403);

  const asignatura = (await almacen.leer('asignaturas')).find((a) => a.id === asignaturaId);
  const lista = (titulo, items) => (items && items.length ? `${titulo}:\n${items.map((i) => `- ${i}`).join('\n')}` : '');
  const contenido = [
    lista('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    lista('Ejemplos', tema.ejemplos),
    lista('Errores frecuentes', tema.erroresFrecuentes)
  ]
    .filter(Boolean)
    .join('\n\n');
  if (!contenido) throw fallo('El tema no tiene contenido suficiente para generar preguntas', 400);

  const glosario = (await almacen.buscar('glosario', { temaId }))
    .filter((g) => g.estado === 'aprobado')
    .map((g) => `${g.termino}: ${g.definicion}`);
  const existentes = (await almacen.buscar('preguntas', { temaId }))
    .filter((p) => p.nivel === nivel)
    .map((p) => p.enunciado);

  return {
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || '',
    tema: tema.titulo,
    contenido,
    glosario: glosario.length ? glosario : ['(sin glosario)'],
    nivelBloom: `${BLOOM[nivel]} (nivel ${nivel} de 5)`,
    cantidad,
    existentes: existentes.length ? existentes : ['(ninguna)']
  };
}
