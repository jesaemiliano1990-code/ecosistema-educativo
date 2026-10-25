// publico/js/nucleo/util.js
// Utilidades generales: texto, fechas, listas y parámetros de URL

import { escapar } from './ui.js';

export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize('NFC')
    .replace(/[ÁÀÂÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .replace(/[\u0300\u0301\u0302\u0308]/g, '');
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(fecha);
}

export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const ahora = Date.now();
  const diffSegundos = Math.round((fecha.getTime() - ahora) / 1000);
  const absSegundos = Math.abs(diffSegundos);

  if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
    const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

    if (absSegundos < 45) {
      return rtf.format(diffSegundos, 'second');
    }
    const diffMinutos = Math.round(diffSegundos / 60);
    const absMinutos = Math.abs(diffMinutos);
    if (absMinutos < 45) {
      return rtf.format(diffMinutos, 'minute');
    }
    const diffHoras = Math.round(diffMinutos / 60);
    const absHoras = Math.abs(diffHoras);
    if (absHoras < 22) {
      return rtf.format(diffHoras, 'hour');
    }
    const diffDias = Math.round(diffHoras / 24);
    const absDias = Math.abs(diffDias);
    if (absDias < 26) {
      return rtf.format(diffDias, 'day');
    }
    const diffMeses = Math.round(diffDias / 30);
    const absMeses = Math.abs(diffMeses);
    if (absMeses < 11) {
      return rtf.format(diffMeses, 'month');
    }
    const diffAnios = Math.round(diffDias / 365);
    return rtf.format(diffAnios, 'year');
  }

  if (absSegundos < 60) return 'hace un momento';
  const min = Math.round(absSegundos / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const dias = Math.round(hr / 24);
  return `hace ${dias} d`;
}

export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

export function formatoBasico(texto) {
  if (texto === null || texto === undefined) return '';
  const limpio = String(texto).trim();
  if (!limpio) return '';

  let html = escapar(limpio);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const bloques = html.split(/\n\s*\n/);
  const resultado = [];

  for (const bloque of bloques) {
    const lineas = bloque.split('\n');
    let itemsLista = [];
    let lineasParrafo = [];

    const vaciarParrafo = () => {
      if (lineasParrafo.length > 0) {
        resultado.push(`<p>${lineasParrafo.join('\n')}</p>`);
        lineasParrafo = [];
      }
    };

    const vaciarLista = () => {
      if (itemsLista.length > 0) {
        resultado.push(`<ul>${itemsLista.map(i => `<li>${i}</li>`).join('')}</ul>`);
        itemsLista = [];
      }
    };

    for (const linea of lineas) {
      const recortada = linea.trim();
      if (recortada.startsWith('- ')) {
        vaciarParrafo();
        itemsLista.push(recortada.slice(2).trim());
      } else if (recortada.length > 0) {
        vaciarLista();
        lineasParrafo.push(recortada);
      }
    }
    vaciarParrafo();
    vaciarLista();
  }

  return resultado.join('');
}

export default {
  normalizar,
  barajar,
  fechaLarga,
  fechaRelativa,
  parametro,
  formatoBasico
};
