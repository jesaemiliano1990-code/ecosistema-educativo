// Validación de las respuestas JSON de la IA. Cada esquema devuelve el valor normalizado o lanza Error.

const texto = (v, campo) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Falta "${campo}"`);
  return v.trim();
};

const numero = (v, campo) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`"${campo}" debe ser un número`);
  return n;
};

const objeto = (v, campo) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`"${campo}" debe ser un objeto`);
  return v;
};

// Si la IA envuelve la lista en un objeto con una sola propiedad (p. ej. { "terminos": [...] }), la desenvuelve.
function comoLista(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const arreglos = Object.values(v).filter(Array.isArray);
    if (arreglos.length === 1) return arreglos[0];
  }
  throw new Error('Se esperaba una lista');
}

function noVacia(lista) {
  if (!lista.length) throw new Error('La lista está vacía');
  return lista;
}

/**
 * Valida y normaliza una pregunta del banco (la usan la IA y el gancho de la colección "preguntas").
 * correcta: índice (opcion), true/false (vf) o texto (completar).
 */
export function normalizarPregunta(p) {
  objeto(p, 'pregunta');
  if (!['opcion', 'vf', 'completar'].includes(p.tipo)) throw new Error('Tipo de pregunta no válido');
  const base = { tipo: p.tipo, enunciado: texto(p.enunciado, 'enunciado'), retroalimentacion: texto(p.retroalimentacion, 'retroalimentacion') };

  if (p.tipo === 'opcion') {
    const opciones = Array.isArray(p.opciones) ? p.opciones.map((o) => String(o ?? '').trim()) : [];
    if (opciones.length < 2 || opciones.length > 6 || opciones.some((o) => !o)) throw new Error('Las opciones deben ser de 2 a 6 textos no vacíos');
    if (new Set(opciones.map((o) => o.toLowerCase())).size !== opciones.length) throw new Error('Las opciones no pueden repetirse');
    const indice = Number(p.correcta);
    if (p.correcta === '' || p.correcta === null || !Number.isInteger(indice) || indice < 0 || indice >= opciones.length) {
      throw new Error('"correcta" debe ser el índice de una opción');
    }
    return { ...base, opciones, correcta: indice };
  }

  if (p.tipo === 'vf') {
    const valor = typeof p.correcta === 'string' ? { true: true, verdadero: true, false: false, falso: false }[p.correcta.trim().toLowerCase()] : p.correcta;
    if (typeof valor !== 'boolean') throw new Error('"correcta" debe ser verdadero o falso');
    return { ...base, opciones: ['Verdadero', 'Falso'], correcta: valor };
  }

  if (!/_{2,}/.test(base.enunciado)) throw new Error('El enunciado debe incluir "____" donde va la respuesta');
  return { ...base, opciones: [], correcta: texto(typeof p.correcta === 'string' ? p.correcta : String(p.correcta ?? ''), 'correcta') };
}

const esquemas = {
  'generar-glosario': (v) =>
    noVacia(comoLista(v)).map((t) => ({
      termino: texto(objeto(t, 'término').termino, 'termino'),
      definicion: texto(t.definicion, 'definicion'),
      pista: texto(t.pista, 'pista'),
      retroalimentacion: texto(t.retroalimentacion, 'retroalimentacion')
    })),

  'generar-preguntas': (v) => noVacia(comoLista(v)).map(normalizarPregunta),

  'generar-escenario': (v) => {
    objeto(v, 'escenario');
    if (!Array.isArray(v.escenas) || !v.escenas.length) throw new Error('Faltan las escenas');
    return { ...v, titulo: texto(v.titulo, 'titulo'), escenaInicial: texto(String(v.escenaInicial ?? ''), 'escenaInicial') };
  },

  'evaluar-rol': (v) => {
    objeto(v, 'evaluación');
    if (!Array.isArray(v.criterios)) throw new Error('Faltan los criterios');
    return {
      ...v,
      puntaje: numero(v.puntaje, 'puntaje'),
      maximo: numero(v.maximo, 'maximo'),
      comentarioGeneral: texto(v.comentarioGeneral, 'comentarioGeneral')
    };
  }
};

export default esquemas;
