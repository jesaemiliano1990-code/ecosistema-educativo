import fs from 'node:fs/promises';
import path from 'node:path';

const RUTA_DATOS = path.resolve('datos');

// Validación de nombres de colección: minúsculas, números, guiones (medios/bajos) y subcarpeta opcional (p. ej., mensajes/con_000001)
const REGEX_COLECCION = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)?$/;

function validarColeccion(col) {
  if (typeof col !== 'string' || !REGEX_COLECCION.test(col)) {
    throw new Error(`Nombre de colección inválido: "${col}". Solo se permiten minúsculas, números, guiones y una subcarpeta opcional.`);
  }
}

function rutaColeccion(col) {
  validarColeccion(col);
  return path.join(RUTA_DATOS, `${col}.json`);
}

// Cola de escrituras por archivo para evitar condiciones de carrera
const colas = new Map();

function encolarEscritura(rutaArchivo, operacion) {
  const colaActual = colas.get(rutaArchivo) || Promise.resolve();
  const siguiente = colaActual.catch(() => {}).then(operacion);
  colas.set(rutaArchivo, siguiente);
  return siguiente;
}

// Respaldo diario en la primera escritura del día (conservando los 14 más recientes)
let respaldoEnProceso = null;

async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const dirRespaldos = path.join(RUTA_DATOS, 'respaldos');
  const dirHoy = path.join(dirRespaldos, hoy);

  try {
    await fs.access(dirHoy);
    return; // Ya existe el respaldo de hoy
  } catch {
    // Si no existe, se ejecuta
  }

  if (respaldoEnProceso) {
    return respaldoEnProceso;
  }

  respaldoEnProceso = (async () => {
    try {
      await fs.mkdir(dirHoy, { recursive: true });

      let elementos = [];
      try {
        elementos = await fs.readdir(RUTA_DATOS, { withFileTypes: true });
      } catch {
        return;
      }

      for (const elem of elementos) {
        if (elem.name === 'respaldos') continue;
        const origen = path.join(RUTA_DATOS, elem.name);
        const destino = path.join(dirHoy, elem.name);
        try {
          await fs.cp(origen, destino, { recursive: true });
        } catch {
          // Ignorar errores menores al copiar elementos individuales
        }
      }

      // Conservar solo los 14 respaldos más recientes
      try {
        const entradas = await fs.readdir(dirRespaldos, { withFileTypes: true });
        const respaldos = entradas
          .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
          .map(e => e.name)
          .sort()
          .reverse();

        if (respaldos.length > 14) {
          const antiguos = respaldos.slice(14);
          for (const viejo of antiguos) {
            await fs.rm(path.join(dirRespaldos, viejo), { recursive: true, force: true });
          }
        }
      } catch {
        // Ignorar error al limpiar
      }
    } finally {
      respaldoEnProceso = null;
    }
  })();

  return respaldoEnProceso;
}

// Escritura atómica a .tmp y luego rename
async function escribirSeguro(rutaArchivo, contenido) {
  await verificarRespaldoDiario();
  const dir = path.dirname(rutaArchivo);
  await fs.mkdir(dir, { recursive: true });

  const rutaTmp = `${rutaArchivo}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await fs.rename(rutaTmp, rutaArchivo);
}

// Generador de ID según contrato: 3 primeras letras de colección + "_" + 6 dígitos
function generarId(col, lista) {
  // Extrae las primeras 3 letras del nombre base de la colección
  const coleccionBase = col.split('/')[0];
  const letras = coleccionBase.replace(/[^a-z]/g, '').slice(0, 3).padEnd(3, 'x');
  let maxId = 0;

  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const match = item.id.match(/^[a-z]{3}_(\d{6})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    }
  }

  const siguiente = maxId + 1;
  return `${letras}_${String(siguiente).padStart(6, '0')}`;
}

export async function leer(col) {
  const ruta = rutaColeccion(col);
  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    const datos = JSON.parse(raw);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function escribir(col, lista) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const contenido = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, contenido);
  });
}

export async function agregar(col, reg) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    let lista = [];
    try {
      const raw = await fs.readFile(ruta, 'utf-8');
      lista = JSON.parse(raw);
      if (!Array.isArray(lista)) lista = [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      lista = [];
    }

    const id = generarId(col, lista);
    const fecha = new Date().toISOString();
    const nuevo = { ...reg, id, fecha };
    lista.push(nuevo);

    const contenido = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, contenido);
    return nuevo;
  });
}

export async function actualizar(col, id, cambios) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    let lista = [];
    try {
      const raw = await fs.readFile(ruta, 'utf-8');
      lista = JSON.parse(raw);
      if (!Array.isArray(lista)) lista = [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      lista = [];
    }

    const idx = lista.findIndex(r => r && r.id === id);
    if (idx === -1) {
      const err = new Error(`Registro con id "${id}" no encontrado en ${col}`);
      err.estado = 404;
      throw err;
    }

    const actualizado = { ...lista[idx], ...cambios, id: lista[idx].id };
    lista[idx] = actualizado;

    const contenido = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, contenido);
    return actualizado;
  });
}

export async function eliminar(col, id) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    let lista = [];
    try {
      const raw = await fs.readFile(ruta, 'utf-8');
      lista = JSON.parse(raw);
      if (!Array.isArray(lista)) lista = [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      lista = [];
    }

    const idx = lista.findIndex(r => r && r.id === id);
    if (idx === -1) {
      const err = new Error(`Registro con id "${id}" no encontrado en ${col}`);
      err.estado = 404;
      throw err;
    }

    lista.splice(idx, 1);
    const contenido = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, contenido);
    return true;
  });
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  const entradas = Object.entries(filtro);
  if (entradas.length === 0) return lista;

  return lista.filter(item => {
    if (!item) return false;
    return entradas.every(([clave, valor]) => String(item[clave]) === String(valor));
  });
}

export async function anexarLinea(archivo, obj) {
  const nombreNormalizado = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(RUTA_DATOS, nombreNormalizado);

  return encolarEscritura(ruta, async () => {
    await verificarRespaldoDiario();
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
  });
}

export async function leerLineas(archivo) {
  const nombreNormalizado = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(RUTA_DATOS, nombreNormalizado);

  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function leerConfig(nombre) {
  const nombreNormalizado = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(RUTA_DATOS, 'config', nombreNormalizado);

  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
