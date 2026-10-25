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
    const lista = await almacen.leer(col);
    const registro = lista.find(r => r && r.id === id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'leer', col, registro);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    res.json(registro);
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

    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
});

// PUT /api/:col/:id (actualizar y fusionar campos)
app.put('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
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

    res.json(actualizado);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/:col/:id (eliminar)
app.delete('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
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
