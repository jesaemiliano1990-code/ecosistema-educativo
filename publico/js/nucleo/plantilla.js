// publico/js/nucleo/plantilla.js
// Montaje de plantilla común: encabezado, navegación lateral, pie de página y control de acceso

import { MENU } from './menu.js';
import { usuarioActual, exigirRol, cerrar } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { logrosDe } from './gamificacion.js';
import { montarCampana } from './notificaciones.js';

export const NOMBRE = 'Ecosistema Educativo';

export async function montarPlantilla({ titulo = '', roles = [] } = {}) {
  // Exigir rol si se especifican roles
  if (Array.isArray(roles) && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // Título del documento
  if (typeof document !== 'undefined') {
    document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;

    const usuario = usuarioActual();
    const tieneSesion = !!usuario;
    const rolActual = usuario?.rol;

    // Con sesión, registrar visita de página en bitácora sin esperar respuesta
    if (tieneSesion && typeof window !== 'undefined' && window.location) {
      registrarEvento('pagina', window.location.pathname).catch(() => {});
    }

    // Verificar si existe un aviso pendiente en sessionStorage (p. ej., redirección por rol)
    try {
      const avisoPendiente = sessionStorage.getItem('aviso_pendiente');
      if (avisoPendiente) {
        sessionStorage.removeItem('aviso_pendiente');
        const { texto, tipo } = JSON.parse(avisoPendiente);
        ui.aviso(texto, tipo || 'info');
      }
    } catch {}

    const contenedorPlantilla = document.getElementById('plantilla');
    if (contenedorPlantilla) {
      const rutaActual = window.location.pathname || '';

      // Filtrar enlaces de menú según el rol ("publico" = todos, "sesion" = con sesión)
      const enlacesHtml = MENU
        .filter(item => {
          if (!item.roles || item.roles.includes('publico')) return true;
          if (item.roles.includes('sesion') && tieneSesion) return true;
          return rolActual && item.roles.includes(rolActual);
        })
        .map(item => {
          const esActual = rutaActual === item.href ||
            (item.href === '/index.html' && (rutaActual === '/' || rutaActual === '' || rutaActual.endsWith('/index.html')));

          const ariaCurrent = esActual ? ' aria-current="page"' : '';
          const claseActivo = esActual ? ' class="activo"' : '';

          if (item.href === '/paginas/noticias.html') {
            return `<a href="${item.href}"${claseActivo}${ariaCurrent}>${item.texto} <span id="badgeNoticiasSinLeer" class="insignia insignia--acento" style="display: none; margin-left: auto;"></span></a>`;
          }

          if (item.href === '/paginas/mensajes.html') {
            return `<a href="${item.href}"${claseActivo}${ariaCurrent}>${item.texto} <span id="badgeMensajesSinLeer" class="insignia insignia--acento" style="display: none; margin-left: auto;"></span></a>`;
          }

          return `<a href="${item.href}"${claseActivo}${ariaCurrent}>${item.texto}</a>`;
        })
        .join('\n');

      // Sección de usuario en el encabezado
      let htmlAcciones = '';
      if (usuario) {
        const esEstudiante = usuario.rol === 'estudiante';
        htmlAcciones = `
          <div class="encabezado__usuario">
            ${esEstudiante ? '<span id="puntos-usuario" class="puntos-usuario" title="Tus puntos acumulados">⭐ 0 pts</span>' : ''}
            <a href="/paginas/perfil.html" class="encabezado__perfil" title="Ver perfil de usuario">
              <span class="encabezado__usuario-nombre">${ui.escapar(usuario.nombre)} ${ui.escapar(usuario.apellido || '')}</span>
              <span class="insignia insignia--info">${ui.escapar(usuario.rol)}</span>
            </a>
            <button id="btnCerrarSesion" type="button" class="btn btn--texto btn--pequeno encabezado__btn-salir" aria-label="Cerrar sesión">
              Salir
            </button>
          </div>
        `;
      } else {
        htmlAcciones = `
          <div class="encabezado__auth-links">
            <a href="/paginas/ingreso.html" class="btn btn--texto btn--pequeno">Ingresar</a>
            <a href="/paginas/registro.html" class="btn btn--secundario btn--pequeno">Registrarse</a>
          </div>
        `;
      }

      contenedorPlantilla.innerHTML = `
        <header class="encabezado" role="banner">
          <div class="contenedor encabezado__contenedor">
            <div class="encabezado__izq">
              <button class="menu-toggle" id="btnMenuToggle" type="button" aria-label="Abrir menú" aria-expanded="false">
                ☰
              </button>
              <div class="encabezado__titulos">
                <a href="/index.html" class="encabezado__nombre">${NOMBRE}</a>
                ${titulo ? `<span class="encabezado__separador" aria-hidden="true">·</span><span class="encabezado__pagina">${ui.escapar(titulo)}</span>` : ''}
              </div>
            </div>
            <div class="encabezado__der">
              ${htmlAcciones}
            </div>
          </div>
        </header>

        <aside class="menu" id="menuLateral" aria-label="Menú principal">
          <div class="menu__encabezado">
            <span class="menu__titulo">Navegación</span>
            <button class="menu__cerrar" id="btnMenuCerrar" type="button" aria-label="Cerrar menú">✕</button>
          </div>
          <nav class="menu__nav" aria-label="Enlaces de navegación">
            ${enlacesHtml}
          </nav>
        </aside>

        <div class="menu-fondo" id="menuFondo" aria-hidden="true"></div>
      `;

      // Campana de notificaciones (solo con sesión)
      if (tieneSesion) montarCampana();

      // Evento de cerrar sesión
      const btnCerrarSesion = document.getElementById('btnCerrarSesion');
      if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
          await cerrar();
        });
      }

      // Cargar contador de noticias sin leer si hay sesión activa
      if (tieneSesion) {
        (async () => {
          try {
            const [noticias, lecturas] = await Promise.all([
              api.listar('noticias'),
              api.listar('lecturas-noticias')
            ]);
            const leidasSet = new Set(Array.isArray(lecturas) ? lecturas.map(l => l && l.noticiaId).filter(Boolean) : []);
            const publicadas = Array.isArray(noticias) ? noticias.filter(n => n && n.estado === 'publicado') : [];
            const sinLeer = publicadas.filter(n => !leidasSet.has(n.id)).length;

            const badge = document.getElementById('badgeNoticiasSinLeer');
            if (badge && sinLeer > 0) {
              badge.textContent = sinLeer;
              badge.style.display = 'inline-flex';
              badge.setAttribute('aria-label', `${sinLeer} noticias sin leer`);
            }
          } catch {
            // Silencioso si ocurre error de red
          }
        })();
      }

      // Cargar puntos de gamificación si el usuario es estudiante
      if (tieneSesion && usuario?.rol === 'estudiante') {
        (async () => {
          try {
            const logros = await logrosDe('yo');
            const elemPuntos = document.getElementById('puntos-usuario');
            if (elemPuntos && logros && typeof logros.puntos === 'number') {
              elemPuntos.textContent = `⭐ ${logros.puntos} pts`;
            }
          } catch {
            // Silencioso si ocurre error
          }
        })();
      }

      // Control del menú lateral en dispositivos móviles
      const btnToggle = document.getElementById('btnMenuToggle');
      const btnCerrar = document.getElementById('btnMenuCerrar');
      const menuLateral = document.getElementById('menuLateral');
      const menuFondo = document.getElementById('menuFondo');

      function abrirMenu() {
        if (!menuLateral || !menuFondo) return;
        menuLateral.classList.add('abierto');
        menuFondo.classList.add('abierto');
        if (btnToggle) btnToggle.setAttribute('aria-expanded', 'true');
      }

      function cerrarMenu() {
        if (!menuLateral || !menuFondo) return;
        menuLateral.classList.remove('abierto');
        menuFondo.classList.remove('abierto');
        if (btnToggle) btnToggle.setAttribute('aria-expanded', 'false');
      }

      function alternarMenu() {
        if (menuLateral && menuLateral.classList.contains('abierto')) {
          cerrarMenu();
        } else {
          abrirMenu();
        }
      }

      if (btnToggle) btnToggle.addEventListener('click', alternarMenu);
      if (btnCerrar) btnCerrar.addEventListener('click', cerrarMenu);
      if (menuFondo) menuFondo.addEventListener('click', cerrarMenu);

      if (menuLateral) {
        menuLateral.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
              cerrarMenu();
            }
          });
        });
      }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuLateral && menuLateral.classList.contains('abierto')) {
          cerrarMenu();
        }
      });
    }

    // Pie con el año al final del body
    let pie = document.querySelector('footer.pie');
    if (!pie) {
      pie = document.createElement('footer');
      pie.className = 'pie';
      pie.setAttribute('role', 'contentinfo');
      pie.innerHTML = `
        <div class="contenedor">
          <p>© ${new Date().getFullYear()} ${NOMBRE} · Todos los derechos reservados.</p>
        </div>
      `;
      document.body.appendChild(pie);
    }
  }
}

export default {
  NOMBRE,
  montarPlantilla
};
