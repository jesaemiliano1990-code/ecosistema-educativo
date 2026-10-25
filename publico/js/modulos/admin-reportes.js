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

// Mensaje privado reportado: los 5 anteriores como contexto y el mensaje reportado resaltado.
function vistaMensaje(reporte, contexto) {
  if (!contexto || !contexto.mensaje) return '<p><em>El mensaje reportado ya no está disponible.</em></p>';
  const nombre = (u) => (u ? `${u.nombre} ${u.apellido}`.trim() : 'Usuario');
  const linea = (m, reportado = false) => `
    <li class="reporte__mensaje ${reportado ? 'reporte__mensaje--reportado' : ''}">
      <span class="foro-meta"><strong>${ui.escapar(nombre(m.autor))}</strong>
        <time datetime="${ui.escapar(m.fecha)}">${ui.escapar(util.fechaRelativa(m.fecha))}</time>
        ${reportado ? '<span class="insignia insignia--advertencia">Reportado</span>' : ''}
        ${m.oculto ? '<span class="insignia">Ya está oculto</span>' : ''}</span>
      <span>${util.formatoBasico(m.texto)}</span>
    </li>`;
  return `
    <div class="reporte__contenido">
      <p class="foro-meta">Conversación entre ${contexto.participantes.map((p) => `<strong>${ui.escapar(nombre(p))}</strong>${p.activo === false ? ' (cuenta desactivada)' : ''}`).join(' y ')}</p>
      <ul class="reporte__mensajes" aria-label="Mensajes de la conversación">
        ${contexto.anteriores.map((m) => linea(m)).join('')}
        ${linea(contexto.mensaje, true)}
      </ul>
    </div>`;
}

async function cargar() {
  ui.cargando(true);
  try {
    const pendientes = (await api.listar('reportes', { estado: 'pendiente' }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    // El administrador lee todo, incluso lo oculto; si ya no existe, se muestra el aviso.
    // Los reportes de mensajes traen su contexto desde la ruta de moderación de la mensajería.
    const items = await Promise.all(pendientes.map((r) => (r.tipo === 'mensaje'
      ? api.llamar('GET', `/api/mensajes/reporte/${encodeURIComponent(r.id)}`)
      : api.obtener(r.coleccion, r.referenciaId)).catch(() => null)));
    const autorActivo = (r, ctx) => ctx?.participantes?.find((p) => p.id === r.autorMensajeId)?.activo !== false;

    contenido.innerHTML = `
      <div class="foro-vista">
        <div class="foro-cabecera">
          <h1 class="foro-cabecera__titulo">Reportes</h1>
          <span class="insignia ${pendientes.length ? 'insignia--advertencia' : 'insignia--exito'}">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}</span>
        </div>
        ${pendientes.length ? pendientes.map((r, i) => `
          <article class="reporte" data-id="${ui.escapar(r.id)}">
            <p class="foro-meta">
              <span>Reportado por <strong>${ui.escapar(r.reportadoPorNombre || 'Usuario')}</strong></span>
              <span>${ui.escapar(util.fechaRelativa(r.fecha))}</span>
            </p>
            <p class="reporte__motivo"><strong>Motivo:</strong> ${ui.escapar(r.motivo)}</p>
            <p class="foro-meta"><span class="insignia">${r.tipo === 'mensaje' ? '✉️ Mensaje privado' : '💬 Foro'}</span></p>
            ${r.tipo === 'mensaje' ? vistaMensaje(r, items[i]) : vistaContenido(r, items[i])}
            <div class="reporte__acciones">
              ${r.tipo === 'mensaje'
                ? `${items[i]?.mensaje && !items[i].mensaje.oculto ? '<button type="button" class="btn btn--peligro btn--pequeno" data-accion="ocultar-mensaje">🙈 Ocultar mensaje</button>' : ''}
                   ${items[i]?.mensaje && autorActivo(r, items[i]) ? '<button type="button" class="btn btn--peligro btn--pequeno" data-accion="desactivar">⛔ Desactivar usuario</button>' : ''}`
                : (items[i] ? '<button type="button" class="btn btn--peligro btn--pequeno" data-accion="ocultar">🙈 Ocultar contenido</button>' : '')}
              <button type="button" class="btn btn--secundario btn--pequeno" data-accion="descartar">Descartar reporte</button>
            </div>
          </article>`).join('') : `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">✅</div>
            <h2 class="vacio__titulo">No hay reportes pendientes</h2>
            <p class="vacio__texto">Cuando alguien reporte una publicación del foro o un mensaje, aparecerá aquí.</p>
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

const CONFIRMACIONES = {
  ocultar: '¿Ocultar esta publicación? Dejará de verse para los estudiantes.',
  'ocultar-mensaje': '¿Ocultar este mensaje? Dejará de verse en la conversación para las dos personas.',
  desactivar: '¿Desactivar la cuenta de quien escribió el mensaje? No podrá ingresar ni usar la plataforma hasta que la reactives.'
};

async function resolver(reporte, accion) {
  if (CONFIRMACIONES[accion] && !(await ui.confirmar(CONFIRMACIONES[accion]))) return;
  ui.cargando(true);
  try {
    let resolucion = 'descartado';
    let mensaje = 'Reporte descartado.';
    if (accion === 'ocultar') {
      const marca = reporte.coleccion === 'foros-hilos' ? { oculto: true } : { oculta: true };
      await api.actualizar(reporte.coleccion, reporte.referenciaId, marca);
      resolucion = 'ocultado';
      mensaje = 'Contenido oculto y reporte resuelto.';
    } else if (accion === 'ocultar-mensaje') {
      await api.llamar('POST', '/api/mensajes/ocultar', { referenciaId: reporte.referenciaId });
      resolucion = 'ocultado';
      mensaje = 'Mensaje oculto y reporte resuelto.';
    } else if (accion === 'desactivar') {
      await api.actualizar('usuarios', reporte.autorMensajeId, { activo: false });
      resolucion = 'usuario-desactivado';
      mensaje = 'Usuario desactivado y reporte resuelto.';
    }
    await api.actualizar('reportes', reporte.id, { estado: 'resuelto', resolucion });
    ui.aviso(mensaje, 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo resolver el reporte.', 'error');
  } finally {
    ui.cargando(false);
  }
  await cargar();
}

await cargar();
