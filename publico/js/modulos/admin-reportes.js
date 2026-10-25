// publico/js/modulos/admin-reportes.js
// Bandeja de reportes del foro: ocultar el contenido reportado o descartar el reporte

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Reportes', roles: ['admin'] });

const contenido = document.getElementById('contenido');

function vistaContenido(reporte, item) {
  if (!item) return '<p><em>El contenido reportado ya no existe.</em></p>';
  const esHilo = reporte.coleccion === 'foros-hilos';
  const hiloId = esHilo ? item.id : item.hiloId;
  const oculto = esHilo ? item.oculto : item.oculta;
  return `
    <div class="reporte__contenido">
      <p class="foro-meta">
        <strong>${ui.escapar(item.autorNombre || 'Usuario')}</strong>
        <span>${esHilo ? 'Hilo' : 'Respuesta'}</span>
        <span>${ui.escapar(util.fechaRelativa(item.fecha))}</span>
        ${oculto ? '<span class="insignia insignia--advertencia">Ya está oculto</span>' : ''}
      </p>
      ${esHilo ? `<h3 style="margin: 0 0 var(--espacio-xs);">${ui.escapar(item.titulo)}</h3>` : ''}
      ${util.formatoBasico(item.texto)}
      <p><a href="/paginas/hilo.html?id=${encodeURIComponent(hiloId)}" target="_blank" rel="noopener noreferrer">Ver en el foro</a></p>
    </div>`;
}

async function cargar() {
  ui.cargando(true);
  try {
    const pendientes = (await api.listar('reportes', { estado: 'pendiente' }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    // El administrador lee todo, incluso lo oculto; si ya no existe, se muestra el aviso.
    const items = await Promise.all(pendientes.map((r) => api.obtener(r.coleccion, r.referenciaId).catch(() => null)));

    contenido.innerHTML = `
      <div class="foro-vista">
        <div class="foro-cabecera">
          <h1 class="foro-cabecera__titulo">Reportes del foro</h1>
          <span class="insignia ${pendientes.length ? 'insignia--advertencia' : 'insignia--exito'}">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}</span>
        </div>
        ${pendientes.length ? pendientes.map((r, i) => `
          <article class="reporte" data-id="${ui.escapar(r.id)}">
            <p class="foro-meta">
              <span>Reportado por <strong>${ui.escapar(r.reportadoPorNombre || 'Usuario')}</strong></span>
              <span>${ui.escapar(util.fechaRelativa(r.fecha))}</span>
            </p>
            <p class="reporte__motivo"><strong>Motivo:</strong> ${ui.escapar(r.motivo)}</p>
            ${vistaContenido(r, items[i])}
            <div class="reporte__acciones">
              ${items[i] ? '<button type="button" class="btn btn--peligro btn--pequeno" data-accion="ocultar">🙈 Ocultar contenido</button>' : ''}
              <button type="button" class="btn btn--secundario btn--pequeno" data-accion="descartar">Descartar reporte</button>
            </div>
          </article>`).join('') : `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">✅</div>
            <h2 class="vacio__titulo">No hay reportes pendientes</h2>
            <p class="vacio__texto">Cuando alguien reporte una publicación del foro, aparecerá aquí.</p>
          </div>`}
      </div>`;

    contenido.querySelectorAll('[data-accion]').forEach((boton) => {
      boton.addEventListener('click', () => resolver(pendientes.find((r) => r.id === boton.closest('.reporte').dataset.id), boton.dataset.accion));
    });
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar los reportes.', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function resolver(reporte, accion) {
  if (accion === 'ocultar' && !(await ui.confirmar('¿Ocultar esta publicación? Dejará de verse para los estudiantes.'))) return;
  ui.cargando(true);
  try {
    if (accion === 'ocultar') {
      const marca = reporte.coleccion === 'foros-hilos' ? { oculto: true } : { oculta: true };
      await api.actualizar(reporte.coleccion, reporte.referenciaId, marca);
    }
    await api.actualizar('reportes', reporte.id, { estado: 'resuelto', resolucion: accion === 'ocultar' ? 'ocultado' : 'descartado' });
    ui.aviso(accion === 'ocultar' ? 'Contenido oculto y reporte resuelto.' : 'Reporte descartado.', 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo resolver el reporte.', 'error');
  } finally {
    ui.cargando(false);
  }
  await cargar();
}

await cargar();
