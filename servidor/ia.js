// Servicio de IA (Google Gemini, API generateContent con fetch nativo). La clave nunca sale del servidor.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as almacen from './almacen.js';
import esquemas from './esquemas-ia.js';

const TIEMPO_MAXIMO_MS = 60000;
const MAX_VALOR = 6000;
const TAREAS_TUTOR = ['tutor', 'rol-simulacion', 'evaluar-rol'];
const TEMPERATURA_ALTA = ['tutor', 'rol-simulacion'];

function fallo(mensaje, estado) {
  return Object.assign(new Error(mensaje), { estado });
}

function configuracion() {
  const { IA_PROVEEDOR, IA_CLAVE, IA_MODELO } = process.env;
  if (IA_PROVEEDOR !== 'gemini' || !IA_CLAVE || !IA_MODELO) {
    throw fallo('La IA no está configurada. Avisa al administrador.', 503);
  }
  return { clave: IA_CLAVE, modelo: IA_MODELO };
}

// Reemplaza {{clave}} por datos[clave]; las listas se unen por saltos de línea y cada valor se recorta.
function armarPrompt(plantilla, datos) {
  const rellenar = (parte) =>
    parte.replace(/\{\{(\w+)\}\}/g, (_, clave) => {
      const valor = datos[clave];
      const t = Array.isArray(valor) ? valor.join('\n') : valor ?? '';
      return String(t).slice(0, MAX_VALOR);
    });
  const [sistema, ...resto] = plantilla.split(/^### USUARIO[ \t]*\r?$/m);
  if (!resto.length) return { sistema: '', usuario: rellenar(sistema).trim() };
  return { sistema: rellenar(sistema).trim(), usuario: rellenar(resto.join('')).trim() };
}

async function cargarPlantilla(tarea) {
  if (!/^[a-z-]+$/.test(tarea)) throw fallo('Tarea de IA no válida', 404);
  try {
    return await fs.readFile(path.resolve('servidor', 'prompts', `${tarea}.txt`), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw fallo('Tarea de IA no encontrada', 404);
    throw e;
  }
}

async function llamarModelo({ sistema, usuario }, { temperatura, json }) {
  const { clave, modelo } = configuracion();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const cuerpo = {
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: { temperature: temperatura, ...(json ? { responseMimeType: 'application/json' } : {}) }
  };
  if (sistema) cuerpo.systemInstruction = { parts: [{ text: sistema }] };

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw fallo('La IA tardó demasiado. Intenta de nuevo.', 504);
    console.error('IA: no se pudo conectar:', e.message);
    throw fallo('No se pudo conectar con el servicio de IA.', 502);
  }

  if (!respuesta.ok) {
    // Se registra el detalle en el servidor; al navegador solo llega un mensaje claro y sin la clave.
    console.error(`IA: el proveedor respondió ${respuesta.status}`);
    if (respuesta.status === 429) throw fallo('El servicio de IA está saturado. Intenta en unos minutos.', 503);
    if ([400, 401, 403].includes(respuesta.status)) {
      throw fallo('El servicio de IA rechazó la solicitud (revisa la clave y el modelo en .env).', 502);
    }
    throw fallo('El servicio de IA no está disponible por ahora.', 502);
  }

  const datos = await respuesta.json().catch(() => null);
  const partes = datos?.candidates?.[0]?.content?.parts;
  const salida = Array.isArray(partes) ? partes.map((p) => p.text || '').join('').trim() : '';
  if (!salida) throw fallo('La IA no devolvió respuesta.', 502);
  return salida;
}

// Extrae el primer bloque JSON (con o sin bloque de código) respetando cadenas y anidación.
function extraerJson(salida) {
  const limpio = salida.replace(/```(?:json)?/gi, '');
  const inicio = limpio.search(/[[{]/);
  if (inicio < 0) throw new Error('Sin JSON');
  const abre = limpio[inicio];
  const cierra = abre === '[' ? ']' : '}';
  let profundidad = 0;
  let enCadena = false;
  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i];
    if (enCadena) {
      if (c === '\\') i++;
      else if (c === '"') enCadena = false;
    } else if (c === '"') enCadena = true;
    else if (c === abre) profundidad++;
    else if (c === cierra && --profundidad === 0) return JSON.parse(limpio.slice(inicio, i + 1));
  }
  throw new Error('JSON incompleto');
}

async function usosDelDia(usuarioId, tareas) {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const lineas = await almacen.leerLineas('consumo-ia.jsonl');
  return lineas.filter((l) => l.usuarioId === usuarioId && tareas(l.tarea) && new Date(l.fecha) >= inicioDia).length;
}

async function verificarLimite(tarea, usuario) {
  const ajustes = await almacen.leerConfig('ajustes');
  const esTutor = TAREAS_TUTOR.includes(tarea);
  const limite = esTutor ? ajustes.limiteTutorDiario : ajustes.limiteIADiario;
  if (!Number.isFinite(limite)) return;
  const usos = await usosDelDia(usuario.id, (t) => TAREAS_TUTOR.includes(t) === esTutor && t !== 'prueba');
  if (usos >= limite) {
    throw fallo('Alcanzaste el límite diario de uso de la IA. Vuelve a intentarlo mañana.', 429);
  }
}

// Registra solo conteos de caracteres: nunca textos ni datos personales.
function registrarConsumo(usuario, tarea, entrada, salida, ok) {
  return almacen
    .anexarLinea('consumo-ia.jsonl', { usuarioId: usuario.id, tarea, entrada, salida, ok, fecha: new Date().toISOString() })
    .catch((e) => console.error('IA: no se pudo registrar el consumo:', e.message));
}

export async function ejecutarTarea(tarea, datos, usuario, { formato = 'json' } = {}) {
  if (!usuario) throw fallo('No autenticado', 401);
  const plantilla = await cargarPlantilla(tarea);
  configuracion();
  await verificarLimite(tarea, usuario);

  const prompt = armarPrompt(plantilla, datos || {});
  const opciones = { temperatura: TEMPERATURA_ALTA.includes(tarea) ? 0.7 : 0.4, json: formato === 'json' };
  const entrada = prompt.sistema.length + prompt.usuario.length;
  let salida = 0;
  let ok = false;
  try {
    let texto = await llamarModelo(prompt, opciones);
    salida = texto.length;
    if (formato !== 'json') {
      ok = true;
      return texto;
    }
    const validar = esquemas[tarea];
    if (!validar) throw fallo('Tarea de IA sin esquema', 500);
    for (let intento = 0; ; intento++) {
      try {
        const resultado = validar(extraerJson(texto));
        ok = true;
        return resultado;
      } catch (e) {
        if (e.estado) throw e;
        if (intento === 1) throw fallo('La IA no devolvió un formato válido', 502);
        texto = await llamarModelo(
          { ...prompt, usuario: `${prompt.usuario}\n\nResponde SOLO con JSON válido.` },
          opciones
        );
        salida += texto.length;
      }
    }
  } finally {
    await registrarConsumo(usuario, tarea, entrada, salida, ok);
  }
}

// Prueba de conexión para el administrador (GET /api/ia/prueba).
export async function probarConexion(usuario) {
  const prompt = { sistema: '', usuario: 'Responde solo: OK' };
  let salida = 0;
  let ok = false;
  try {
    const texto = await llamarModelo(prompt, { temperatura: 0.4, json: false });
    salida = texto.length;
    ok = true;
    return texto;
  } finally {
    await registrarConsumo(usuario, 'prueba', prompt.usuario.length, salida, ok);
  }
}
