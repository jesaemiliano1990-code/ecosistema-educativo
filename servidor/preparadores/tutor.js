// Prepara los datos de la tarea "tutor": verifica el acceso al tema y arma el contenido y la conversación.
import * as almacen from '../almacen.js';
import { asignaturaDeTema, asignaturasDe } from '../acceso.js';

const fallo = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

const MAX_MENSAJES = 10;
const MAX_TEXTO = 1000;
const MAX_TERMINOS = 30;
const ETIQUETA = { estudiante: 'Estudiante', tutor: 'Tutor' };

// Solo los últimos 10 mensajes, con roles válidos y hasta 1.000 caracteres cada uno.
function limpiarHistorial(historial) {
  if (!Array.isArray(historial)) throw fallo('Falta la conversación', 400);
  const limpio = [];
  for (const m of historial) {
    if (!m || !ETIQUETA[m.rol] || typeof m.texto !== 'string') continue;
    const texto = m.texto.trim().slice(0, MAX_TEXTO);
    if (texto) limpio.push({ rol: m.rol, texto });
  }
  const ultimos = limpio.slice(-MAX_MENSAJES);
  if (!ultimos.length || ultimos[ultimos.length - 1].rol !== 'estudiante') {
    throw fallo('Escribe tu pregunta para el tutor', 400);
  }
  return ultimos;
}

const bloque = (titulo, lista) => (Array.isArray(lista) && lista.length ? `${titulo}:\n${lista.map((x) => `- ${x}`).join('\n')}` : '');

export default async function preparar(cuerpo, usuario) {
  const { temaId } = cuerpo;
  if (typeof temaId !== 'string' || !temaId) throw fallo('Falta el tema', 400);
  const historial = limpiarHistorial(cuerpo.historial);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  const asignaturaId = tema ? await asignaturaDeTema(temaId) : null;
  if (!tema || !asignaturaId) throw fallo('Tema no encontrado', 404);

  // Cada persona accede a los temas de sus asignaturas; el estudiante, solo a los publicados y visibles.
  if (usuario.rol !== 'admin') {
    const mias = (await asignaturasDe(usuario)).map((a) => (typeof a === 'string' ? a : a?.id));
    if (!mias.includes(asignaturaId)) throw fallo('No tienes acceso a este tema', 403);
    if (usuario.rol === 'estudiante') {
      const unidad = (await almacen.leer('unidades')).find((u) => u.id === tema.unidadId);
      if (tema.estado !== 'publicado' || unidad?.visible === false) throw fallo('Tema no encontrado', 404);
    }
  }

  const asignatura = (await almacen.leer('asignaturas')).find((a) => a.id === asignaturaId);
  const glosario = (await almacen.buscar('glosario', { temaId }))
    .filter((g) => g.estado === 'aprobado')
    .slice(0, MAX_TERMINOS)
    .map((g) => `${g.termino}: ${g.definicion}`);

  const contenido = [
    bloque('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    bloque('Ejemplos', tema.ejemplos),
    bloque('Errores frecuentes', tema.erroresFrecuentes),
    bloque('Preguntas guía', tema.preguntasGuia),
    bloque('Glosario', glosario)
  ].filter(Boolean).join('\n\n');
  if (!contenido) throw fallo('El tema todavía no tiene contenido para el tutor', 400);

  const previos = historial.slice(0, -1).map((m) => `${ETIQUETA[m.rol]}: ${m.texto}`);
  return {
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || '',
    tema: tema.titulo,
    contenido,
    historial: previos.length ? previos : ['(sin conversación previa)'],
    pregunta: historial[historial.length - 1].texto
  };
}
