import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as almacen from '../almacen.js';

const router = Router();

const DIR_SUBIDAS = path.resolve('publico', 'recursos', 'subidas');
if (!fs.existsSync(DIR_SUBIDAS)) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DIR_SUBIDAS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombreAleatorio = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    cb(null, nombreAleatorio);
  }
});

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp'];

const TIPOS_DOCENTE_ADMIN = [
  ...TIPOS_IMAGEN,
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mp3',
  'audio/x-mpeg'
];
const EXTENSIONES_DOCENTE_ADMIN = [
  ...EXTENSIONES_IMAGEN,
  '.pdf',
  '.mp3'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'docente' || req.usuario.rol === 'admin');

  const permitidosMime = esDocenteOAdmin ? TIPOS_DOCENTE_ADMIN : TIPOS_IMAGEN;
  const permitidasExt = esDocenteOAdmin ? EXTENSIONES_DOCENTE_ADMIN : EXTENSIONES_IMAGEN;

  if (permitidosMime.includes(file.mimetype) && permitidasExt.includes(ext)) {
    cb(null, true);
  } else {
    const msg = esDocenteOAdmin
      ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
      : 'Solo se permiten imágenes en formato JPG, PNG o WEBP';
    const error = new Error(msg);
    error.estado = 400;
    cb(error, false);
  }
};

// Límite de multer amplio (hasta 50 MB) para controlar el tamaño exacto por rol en el controlador
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
}).single('archivo');

// POST /subidas (y /api/subidas)
router.post('/subidas', async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(err.estado || 400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo en el campo "archivo"' });
    }

    // Comprobar límites de tamaño por rol según ajustes.json
    try {
      const ajustes = await almacen.leerConfig('ajustes');
      const maxSubidaMB = typeof ajustes.maxSubidaMB === 'number' ? ajustes.maxSubidaMB : 10;

      const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'docente' || req.usuario.rol === 'admin');
      const limiteBytes = esDocenteOAdmin ? maxSubidaMB * 1024 * 1024 : 2 * 1024 * 1024;

      if (req.file.size > limiteBytes) {
        // Eliminar archivo temporal subido
        await fs.promises.unlink(req.file.path).catch(() => {});
        const mensaje = esDocenteOAdmin
          ? `El archivo supera el tamaño máximo permitido de ${maxSubidaMB} MB`
          : 'Los estudiantes están limitados a imágenes de hasta 2 MB';
        return res.status(400).json({ error: mensaje });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    } catch (e) {
      next(e);
    }
  });
});

export default router;
