import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import { aplicar } from './ganchos.js';

import { cargarUsuario } from './auth.js';

dotenv.config();

const app = express();
const PUERTO = process.env.PUERTO || 3000;

app.disable('x-powered-by');

// Cabeceras básicas de seguridad para todas las respuestas
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// Quita datos secretos de un registro antes de enviarlo al navegador
function paraCliente(col, registro) {
  if (col === 'usuarios' && registro && typeof registro === 'object') {
    const { claveHash, ...resto } = registro;
    return resto;
  }
  return registro;
}

// Un registro es visible si su gancho puedeVer lo permite; si no existe, vale el mismo filtro que la lista.
async function esVisible(col, registro, usuario) {
  const r = await aplicar(col, 'puedeVer', registro, usuario);
  if (r === true || r === false) return r;
  const lista = await aplicar(col, 'filtrarLista', [registro], usuario);
  return Array.isArray(lista) ? lista.length > 0 : true;
}

// Servir archivos estáticos de publico/
app.use(express.static(path.resolve('publico')));

// Parser JSON con límite de 1 MB
app.use(express.json({ limit: '1mb' }));

// Cargar usuario autenticado a partir del token de sesión
app.use(cargarUsuario);

// Cargar y montar automáticamente rutas personalizadas desde servidor/rutas/*.js
async function montarRutasPersonalizadas() {
  const dirRutas = path.resolve('servidor', 'rutas');
  try {
    const entradas = await fs.readdir(dirRutas, { withFileTypes: true });
    const archivos = entradas
      .filter(e => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();

    for (const archivo of archivos) {
      const rutaCompleta = path.join(dirRutas, archivo);
      const modulo = await import(pathToFileURL(rutaCompleta).href);
      const router = modulo.default || modulo;
      if (router) {
        app.use('/api', router);
        app.use(router);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error al montar rutas personalizadas:', error);
    }
  }
}

await montarRutasPersonalizadas();

// --- API Genérica: /api/:col y /api/:col/:id ---

// GET /api/:col (listar con filtros exactos y gancho filtrarLista)
app.get('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    const autorizado = await puede(req.usuario, 'leer', col);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    let lista = await almacen.leer(col);

    // Filtros exactos por query
    const clavesFiltro = Object.keys(req.query);
    if (clavesFiltro.length > 0) {
      lista = lista.filter(item => {
        if (!item) return false;
        return clavesFiltro.every(clave => String(item[clave]) === String(req.query[clave]));
      });
    }

    // Gancho opcional para filtrar lista
    lista = await aplicar(col, 'filtrarLista', lista, req.usuario);
    res.json(lista);
  } catch (error) {
    next(error);
  }
});

// GET /api/:col/:id (obtener por ID)
app.get('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    // Primero el permiso de la colección: así no se revela qué registros existen en colecciones prohibidas.
    if (!(await puede(req.usuario, 'leer', col))) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    const lista = await almacen.leer(col);
    const registro = lista.find(r => r && r.id === id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'leer', col, registro);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Un registro se ve igual que en la lista: gancho puedeVer o, si no hay, el filtro de la lista.
    if (!(await esVisible(col, registro, req.usuario))) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(paraCliente(col, registro));
  } catch (error) {
    next(error);
  }
});

// POST /api/:col (crear)
app.post('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    const autorizado = await puede(req.usuario, 'escribir', col, req.body);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const datos = await aplicar(col, 'antesDeGuardar', req.body || {}, req.usuario, null);
    const nuevo = await almacen.agregar(col, datos);
    await aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(paraCliente(col, nuevo));
  } catch (error) {
    next(error);
  }
});

// PUT /api/:col/:id (actualizar y fusionar campos)
app.put('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    if (!(await puede(req.usuario, 'escribir', col))) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    const lista = await almacen.leer(col);
    const anterior = lista.find(r => r && r.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const cambios = await aplicar(col, 'antesDeGuardar', req.body || {}, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(paraCliente(col, actualizado));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/:col/:id (eliminar)
app.delete('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    if (!(await puede(req.usuario, 'escribir', col))) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    const lista = await almacen.leer(col);
    const anterior = lista.find(r => r && r.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Gancho opcional: una colección puede rechazar el borrado lanzando un Error con "estado".
    await aplicar(col, 'antesDeEliminar', anterior, req.usuario);
    await almacen.eliminar(col, id);
    await aplicar(col, 'despuesDeEliminar', anterior, req.usuario);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Manejador centralizado de errores
app.use((err, req, res, next) => {
  const estado = typeof err.estado === 'number'
    ? err.estado
    : (typeof err.status === 'number' ? err.status : 500);

  // Los errores inesperados (sin estado) no muestran detalles internos al navegador.
  if (estado >= 500 && typeof err.estado !== 'number') {
    console.error('Error interno:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
});

// Iniciar servidor solo si no estamos en entorno de prueba
if (process.env.NODE_ENV !== 'test') {
  app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export { cargarUsuario };
export default app;
