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

const esquemas = {
  'generar-glosario': (v) =>
    noVacia(comoLista(v)).map((t) => ({
      termino: texto(objeto(t, 'término').termino, 'termino'),
      definicion: texto(t.definicion, 'definicion'),
      pista: texto(t.pista, 'pista'),
      retroalimentacion: texto(t.retroalimentacion, 'retroalimentacion')
    })),

  'generar-preguntas': (v) =>
    noVacia(comoLista(v)).map((p) => {
      objeto(p, 'pregunta');
      if (!['opcion', 'vf', 'completar'].includes(p.tipo)) throw new Error('Tipo de pregunta no válido');
      if (p.correcta === undefined || p.correcta === null || p.correcta === '') throw new Error('Falta "correcta"');
      const opciones = Array.isArray(p.opciones) ? p.opciones.map(String) : [];
      if (p.tipo === 'opcion' && opciones.length < 2) throw new Error('Una pregunta de opción necesita opciones');
      return {
        tipo: p.tipo,
        enunciado: texto(p.enunciado, 'enunciado'),
        opciones,
        correcta: p.correcta,
        retroalimentacion: texto(p.retroalimentacion, 'retroalimentacion')
      };
    }),

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
