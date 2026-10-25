// publico/js/nucleo/pdf.js
// Generación y descarga de diplomas oficiales en PDF con jsPDF y tokens de diseño

import * as api from './api.js';
import * as util from './util.js';

/**
 * Convierte un color HEX (#RRGGBB) a [r, g, b]
 * @param {string} hex
 * @returns {Array<number>}
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0, 46, 69];
  const limpio = hex.trim().replace('#', '');
  if (limpio.length === 3) {
    const r = parseInt(limpio[0] + limpio[0], 16);
    const g = parseInt(limpio[1] + limpio[1], 16);
    const b = parseInt(limpio[2] + limpio[2], 16);
    return [r, g, b];
  }
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Carga dinámicamente jsPDF desde cdnjs si no se encuentra en el entorno global
 * @returns {Promise<any>}
 */
function cargarJsPDF() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('jsPDF requiere un entorno con ventana de navegador'));
  }
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (window.jsPDF) return Promise.resolve(window.jsPDF);

  return new Promise((resolve, reject) => {
    // Si ya existe la etiqueta de script, esperar a que cargue
    const scriptExistente = document.querySelector('script[src*="jspdf"]');
    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => {
        const Cls = window.jspdf?.jsPDF || window.jsPDF;
        if (Cls) resolve(Cls);
        else reject(new Error('No se pudo inicializar jsPDF'));
      });
      scriptExistente.addEventListener('error', () => reject(new Error('Error al cargar jsPDF')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const Cls = window.jspdf?.jsPDF || window.jsPDF;
      if (Cls) resolve(Cls);
      else reject(new Error('No se pudo inicializar jsPDF'));
    };
    script.onerror = () => reject(new Error('Error al cargar la librería jsPDF desde CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Genera y descarga un diploma A4 horizontal en formato PDF oficial
 * @param {Object} params - { tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = 'cumplimiento', temaId = null, nivel = null } = {}) {
  // 1. Registrar o recuperar el certificado emitido en el servidor
  const cert = await api.llamar('POST', '/api/certificados', { tipo, temaId, nivel });
  if (!cert || !cert.codigo) {
    throw new Error('No se pudo generar el registro del certificado');
  }

  // 2. Cargar jsPDF
  const jsPDF = await cargarJsPDF();

  // 3. Obtener colores desde tokens.css con getComputedStyle
  let primarioRgb = [0, 46, 69];
  let acentoRgb = [255, 105, 0];
  let secundarioRgb = [38, 71, 99];
  let textoRgb = [24, 45, 62];

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const estilos = getComputedStyle(document.documentElement);
    const primario = estilos.getPropertyValue('--color-primario').trim();
    const acento = estilos.getPropertyValue('--color-acento').trim();
    const secundario = estilos.getPropertyValue('--color-secundario').trim();
    const texto = estilos.getPropertyValue('--color-texto').trim();

    if (primario) primarioRgb = hexToRgb(primario);
    if (acento) acentoRgb = hexToRgb(acento);
    if (secundario) secundarioRgb = hexToRgb(secundario);
    if (texto) textoRgb = hexToRgb(texto);
  }

  // 4. Crear documento A4 horizontal (297 mm x 210 mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const ancho = 297;
  const alto = 210;
  const centroX = ancho / 2;

  // Fondo sutil marfil/blanco
  doc.setFillColor(254, 255, 255);
  doc.rect(0, 0, ancho, alto, 'F');

  // Marco exterior decorativo (primario grueso)
  doc.setDrawColor(...primarioRgb);
  doc.setLineWidth(2.2);
  doc.rect(10, 10, ancho - 20, alto - 20);

  // Marco interior fino (acento)
  doc.setDrawColor(...acentoRgb);
  doc.setLineWidth(0.8);
  doc.rect(13, 13, ancho - 26, alto - 26);

  // Decoraciones en esquinas
  const esquinas = [
    [16, 16],
    [ancho - 16, 16],
    [16, alto - 16],
    [ancho - 16, alto - 16]
  ];
  doc.setFillColor(...acentoRgb);
  for (const [cx, cy] of esquinas) {
    doc.circle(cx, cy, 1.6, 'F');
  }

  // Encabezado: Nombre de la plataforma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primarioRgb);
  doc.text('ECOSISTEMA EDUCATIVO UNEMI', centroX, 32, { align: 'center' });

  // Título del diploma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...acentoRgb);
  doc.text('DIPLOMA DE RECONOCIMIENTO', centroX, 48, { align: 'center' });

  // Línea divisoria decorativa
  doc.setDrawColor(...primarioRgb);
  doc.setLineWidth(0.6);
  doc.line(centroX - 60, 54, centroX + 60, 54);

  // "Otorgado a"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...textoRgb);
  doc.text('Otorgado con distinción a:', centroX, 68, { align: 'center' });

  // Nombre del estudiante
  const nombreEstudiante = cert.nombreCompleto || 'Estudiante';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...primarioRgb);
  doc.text(nombreEstudiante, centroX, 86, { align: 'center' });

  // Línea sutil bajo el nombre
  doc.setDrawColor(...acentoRgb);
  doc.setLineWidth(0.4);
  const anchoTextoNombre = Math.min(doc.getTextWidth(nombreEstudiante) + 20, 160);
  doc.line(centroX - anchoTextoNombre / 2, 91, centroX + anchoTextoNombre / 2, 91);

  // Leyenda intermedia
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...textoRgb);
  doc.text('Por haber culminado con éxito y demostrado suficiencia académica en:', centroX, 105, { align: 'center' });

  // Detalle del logro
  const detalleLogro = cert.detalle || 'Cumplimiento de objetivos pedagógicos';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...acentoRgb);
  doc.text(detalleLogro, centroX, 118, { align: 'center' });

  // Fecha larga
  const fechaIso = cert.fecha || new Date().toISOString();
  const fechaTexto = util.fechaLarga(fechaIso) || 'Ecuador';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...textoRgb);
  doc.text(`Emitido el ${fechaTexto}`, centroX, 138, { align: 'center' });

  // Bloque inferior de verificación
  doc.setDrawColor(220, 230, 236);
  doc.setLineWidth(0.4);
  doc.line(40, 150, ancho - 40, 150);

  // Código oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primarioRgb);
  doc.text(`Código de Verificación: ${cert.codigo}`, centroX, 160, { align: 'center' });

  // Dirección web para verificar el certificado
  const origen = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const urlVerificar = `${origen}/paginas/verificar.html?codigo=${encodeURIComponent(cert.codigo)}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...secundarioRgb);
  doc.text(`Verificable en línea en: ${urlVerificar}`, centroX, 168, { align: 'center' });

  // Firma institucional
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 120, 135);
  doc.text('Dirección de Tecnologías y Docencia Universitaria · UNEMI', centroX, 185, { align: 'center' });

  // 5. Descargar archivo diploma-<codigo>.pdf
  const nombreArchivo = `diploma-${cert.codigo}.pdf`;
  doc.save(nombreArchivo);

  return { codigo: cert.codigo };
}

export default {
  generarDiploma
};
