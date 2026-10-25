// publico/js/modulos/perfil.js
// Módulo de perfil de usuario: edición de datos, foto y cambio de contraseña

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as sesion from '../nucleo/sesion.js';
import * as util from '../nucleo/util.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Mi perfil', roles: ['sesion'] });

let usuario = sesion.usuarioActual();

try {
  const fresco = await api.llamar('GET', '/api/auth/yo');
  if (fresco) {
    usuario = {
      id: fresco.id,
      nombre: fresco.nombre,
      apellido: fresco.apellido,
      rol: fresco.rol,
      correo: fresco.correo,
      foto: fresco.foto || null
    };
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
  }
} catch (error) {
  console.warn('No se pudo refrescar los datos del usuario:', error);
}

const contenido = document.getElementById('contenido');
if (contenido && usuario) {
  const iniciales = `${(usuario.nombre || '')[0] || ''}${(usuario.apellido || '')[0] || ''}`.toUpperCase() || 'U';

  contenido.innerHTML = `
    <div class="perfil-contenedor">
      <header class="perfil-tarjeta__header">
        <h1>Mi Perfil</h1>
        <p>Administra tu información personal, foto de perfil y credenciales de acceso</p>
      </header>

      <div class="perfil-grid">
        <!-- Tarjeta de Datos Personales y Foto -->
        <section class="perfil-tarjeta" aria-labelledby="tituloDatos">
          <div class="perfil-tarjeta__header">
            <h2 id="tituloDatos">Datos personales</h2>
            <p>Información básica de tu cuenta en la plataforma</p>
          </div>

          <div class="perfil-foto-seccion">
            <div class="avatar-wrapper" id="avatarContenedor">
              ${usuario.foto
                ? `<img src="${ui.escapar(usuario.foto)}" alt="Foto de perfil" class="avatar-img" id="avatarImg">`
                : `<span class="avatar-placeholder" id="avatarPlaceholder">${ui.escapar(iniciales)}</span>`}
            </div>
            <div class="foto-acciones">
              <input type="file" id="inputFoto" accept="image/jpeg,image/png,image/webp" style="display: none;">
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnCambiarFoto">
                Cambiar foto
              </button>
              <p>Formatos permitidos: JPG, PNG o WEBP. Máximo 2 MB.</p>
            </div>
          </div>

          <form id="formDatos" class="pila" novalidate>
            <div class="campo" id="campoNombre">
              <label for="nombre">Nombre <span class="requerido" aria-hidden="true">*</span></label>
              <input type="text" id="nombre" name="nombre" value="${ui.escapar(usuario.nombre || '')}" required>
              <span class="campo__error" id="errorNombre" role="alert"></span>
            </div>

            <div class="campo" id="campoApellido">
              <label for="apellido">Apellido <span class="requerido" aria-hidden="true">*</span></label>
              <input type="text" id="apellido" name="apellido" value="${ui.escapar(usuario.apellido || '')}" required>
              <span class="campo__error" id="errorApellido" role="alert"></span>
            </div>

            <div class="campo">
              <label for="correo">Correo electrónico</label>
              <input type="email" id="correo" value="${ui.escapar(usuario.correo || '')}" readonly title="El correo electrónico no puede ser modificado">
            </div>

            <div class="campo">
              <label for="rol">Rol en la plataforma</label>
              <input type="text" id="rol" value="${ui.escapar(usuario.rol || '')}" readonly style="text-transform: capitalize;">
            </div>

            <div class="perfil-acciones">
              <button type="submit" id="btnGuardarDatos" class="btn btn--primario">
                Guardar cambios
              </button>
            </div>
          </form>
        </section>

        <!-- Tarjeta de Cambio de Contraseña -->
        <section class="perfil-tarjeta" aria-labelledby="tituloClave">
          <div class="perfil-tarjeta__header">
            <h2 id="tituloClave">Seguridad de la cuenta</h2>
            <p>Actualiza periódicamente tu contraseña para proteger tu cuenta</p>
          </div>

          <form id="formClave" class="pila" novalidate>
            <div class="campo" id="campoActual">
              <label for="claveActual">Contraseña actual <span class="requerido" aria-hidden="true">*</span></label>
              <input type="password" id="claveActual" name="actual" required autocomplete="current-password" placeholder="Tu contraseña actual">
              <span class="campo__error" id="errorActual" role="alert"></span>
            </div>

            <div class="campo" id="campoNueva">
              <label for="claveNueva">Nueva contraseña <span class="requerido" aria-hidden="true">*</span></label>
              <input type="password" id="claveNueva" name="nueva" required autocomplete="new-password" placeholder="Mínimo 8 caracteres">
              <span class="campo__ayuda">Debe contener al menos 8 caracteres con letras y números.</span>
              <span class="campo__error" id="errorNueva" role="alert"></span>
            </div>

            <div class="campo" id="campoRepetir">
              <label for="claveRepetir">Repetir nueva contraseña <span class="requerido" aria-hidden="true">*</span></label>
              <input type="password" id="claveRepetir" name="repetir" required autocomplete="new-password" placeholder="Repite la nueva contraseña">
              <span class="campo__error" id="errorRepetir" role="alert"></span>
            </div>

            <div class="perfil-acciones">
              <button type="submit" id="btnGuardarClave" class="btn btn--primario">
                Actualizar contraseña
              </button>
            </div>
          </form>
        </section>
      </div>

      <!-- Sección de Logros vacía (se completará en el Sprint 5) -->
      <section id="logros" aria-label="Logros y reconocimientos"></section>
    </div>
  `;

  // Gestión de subida de foto
  const inputFoto = document.getElementById('inputFoto');
  const btnCambiarFoto = document.getElementById('btnCambiarFoto');
  const avatarContenedor = document.getElementById('avatarContenedor');

  btnCambiarFoto.addEventListener('click', () => {
    inputFoto.click();
  });

  inputFoto.addEventListener('change', async () => {
    const archivo = inputFoto.files?.[0];
    if (!archivo) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      ui.aviso('Solo se permiten imágenes en formato JPG, PNG o WEBP.', 'error');
      inputFoto.value = '';
      return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
      ui.aviso('La imagen no debe superar los 2 MB de tamaño.', 'error');
      inputFoto.value = '';
      return;
    }

    ui.cargando(true);
    btnCambiarFoto.disabled = true;

    try {
      const resSubida = await api.subir(archivo);
      if (!resSubida || !resSubida.url) {
        throw new Error('No se recibió la URL de la imagen subida.');
      }

      // Guardar inmediatamente la foto en el perfil del usuario
      const actualizado = await api.llamar('PUT', '/api/auth/perfil', { foto: resSubida.url });

      // Actualizar vista previa
      avatarContenedor.innerHTML = `<img src="${ui.escapar(actualizado.foto)}" alt="Foto de perfil" class="avatar-img" id="avatarImg">`;

      // Actualizar sessionStorage
      usuario.foto = actualizado.foto;
      sessionStorage.setItem('usuario', JSON.stringify({
        ...usuario,
        foto: actualizado.foto
      }));

      ui.aviso('Foto de perfil actualizada correctamente.', 'exito');
    } catch (error) {
      ui.aviso(error.message || 'Error al subir la imagen de perfil.', 'error');
    } finally {
      ui.cargando(false);
      btnCambiarFoto.disabled = false;
      inputFoto.value = '';
    }
  });

  // Gestión del formulario de Datos Personales
  const formDatos = document.getElementById('formDatos');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const btnGuardarDatos = document.getElementById('btnGuardarDatos');

  function establecerError(campoId, errorId, mensaje) {
    const cont = document.getElementById(campoId);
    const span = document.getElementById(errorId);
    if (!cont || !span) return;
    if (mensaje) {
      cont.classList.add('campo--error');
      span.textContent = mensaje;
    } else {
      cont.classList.remove('campo--error');
      span.textContent = '';
    }
  }

  function validarDatos() {
    let valido = true;
    const nom = inputNombre.value.trim();
    const ape = inputApellido.value.trim();

    if (!nom || nom.length < 2) {
      establecerError('campoNombre', 'errorNombre', 'El nombre debe tener al menos 2 caracteres.');
      valido = false;
    } else {
      establecerError('campoNombre', 'errorNombre', '');
    }

    if (!ape || ape.length < 2) {
      establecerError('campoApellido', 'errorApellido', 'El apellido debe tener al menos 2 caracteres.');
      valido = false;
    } else {
      establecerError('campoApellido', 'errorApellido', '');
    }

    return valido;
  }

  inputNombre.addEventListener('input', validarDatos);
  inputApellido.addEventListener('input', validarDatos);

  formDatos.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarDatos()) return;

    btnGuardarDatos.disabled = true;
    ui.cargando(true);

    try {
      const nombre = inputNombre.value.trim();
      const apellido = inputApellido.value.trim();

      const actualizado = await api.llamar('PUT', '/api/auth/perfil', { nombre, apellido });

      usuario.nombre = actualizado.nombre;
      usuario.apellido = actualizado.apellido;

      sessionStorage.setItem('usuario', JSON.stringify({
        ...usuario,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido
      }));

      // Actualizar nombre visible en el encabezado si existe
      const elementoEncabezado = document.querySelector('.encabezado__usuario-nombre');
      if (elementoEncabezado) {
        elementoEncabezado.textContent = `${actualizado.nombre} ${actualizado.apellido}`;
      }

      ui.aviso('Datos personales guardados con éxito.', 'exito');
    } catch (error) {
      ui.aviso(error.message || 'Error al actualizar los datos personales.', 'error');
    } finally {
      btnGuardarDatos.disabled = false;
      ui.cargando(false);
    }
  });

  // Gestión del formulario de Cambio de Contraseña
  const formClave = document.getElementById('formClave');
  const inputActual = document.getElementById('claveActual');
  const inputNueva = document.getElementById('claveNueva');
  const inputRepetir = document.getElementById('claveRepetir');
  const btnGuardarClave = document.getElementById('btnGuardarClave');

  function validarClaves() {
    let valido = true;
    const act = inputActual.value;
    const nva = inputNueva.value;
    const rep = inputRepetir.value;

    if (!act) {
      establecerError('campoActual', 'errorActual', 'Ingresa tu contraseña actual.');
      valido = false;
    } else {
      establecerError('campoActual', 'errorActual', '');
    }

    if (!nva || nva.length < 8 || !/[a-zA-Z]/.test(nva) || !/[0-9]/.test(nva)) {
      establecerError('campoNueva', 'errorNueva', 'La nueva contraseña debe tener al menos 8 caracteres con letras y números.');
      valido = false;
    } else {
      establecerError('campoNueva', 'errorNueva', '');
    }

    if (rep !== nva) {
      establecerError('campoRepetir', 'errorRepetir', 'Las contraseñas no coinciden.');
      valido = false;
    } else {
      establecerError('campoRepetir', 'errorRepetir', '');
    }

    return valido;
  }

  inputActual.addEventListener('input', validarClaves);
  inputNueva.addEventListener('input', validarClaves);
  inputRepetir.addEventListener('input', validarClaves);

  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarClaves()) return;

    btnGuardarClave.disabled = true;
    ui.cargando(true);

    try {
      await api.llamar('POST', '/api/auth/clave', {
        actual: inputActual.value,
        nueva: inputNueva.value
      });

      ui.aviso('Tu contraseña ha sido actualizada con éxito.', 'exito');
      formClave.reset();
      establecerError('campoActual', 'errorActual', '');
      establecerError('campoNueva', 'errorNueva', '');
      establecerError('campoRepetir', 'errorRepetir', '');
    } catch (error) {
      ui.aviso(error.message || 'Error al cambiar la contraseña.', 'error');
    } finally {
      btnGuardarClave.disabled = false;
      ui.cargando(false);
    }
  });

  // Sección de logros, insignias y certificado de cumplimiento (solo para estudiantes)
  const seccionLogros = document.getElementById('logros');
  if (seccionLogros) {
    if (usuario.rol === 'estudiante') {
      await renderizarLogros(seccionLogros);
    } else {
      seccionLogros.style.display = 'none';
    }
  }
}

/**
 * Renderiza los puntos totales, la vitrina de insignias y el estado del certificado de cumplimiento
 * @param {HTMLElement} seccion
 */
async function renderizarLogros(seccion) {
  seccion.innerHTML = '<div style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">Cargando vitrina de logros y certificados...</div>';

  try {
    const [logros, todasInsignias, estadoCert] = await Promise.all([
      logrosDe('yo'),
      api.listar('insignias').catch(err => {
        console.warn('Error al listar insignias:', err);
        return [];
      }),
      api.llamar('GET', '/api/certificados/estado').catch(err => {
        console.warn('Error al consultar estado de certificado:', err);
        return { condiciones: [], cumple: false };
      })
    ]);

    const puntosTotales = typeof logros?.puntos === 'number' ? logros.puntos : (Number(logros?.puntos) || 0);
    const insigniasObtenidas = Array.isArray(logros?.insignias) ? logros.insignias : [];
    const mapaObtenidas = new Map(insigniasObtenidas.map(i => [i.id, i]));
    const catalogo = Array.isArray(todasInsignias) ? todasInsignias : [];

    // 1. Puntos totales (logrosDe())
    const bannerHtml = `
      <div class="logros-puntos-banner">
        <div class="logros-puntos-banner__info">
          <h2>Puntos acumulados</h2>
          <p>Tu puntaje global obtenido en actividades, retos y evaluaciones pedagógicas</p>
        </div>
        <div class="logros-puntos-banner__badge" id="bannerPuntosTotal" aria-label="Total de puntos: ${puntosTotales}">
          ⭐ <span>${puntosTotales}</span> pts
        </div>
      </div>
    `;

    // 2. Insignias obtenidas (ícono, nombre y fecha) y bloqueadas (en gris con descripción como condición)
    const insigniasOrdenadas = [...catalogo].sort((a, b) => {
      const aObt = mapaObtenidas.has(a.id) ? 1 : 0;
      const bObt = mapaObtenidas.has(b.id) ? 1 : 0;
      return bObt - aObt;
    });

    const tarjetasInsigniasHtml = insigniasOrdenadas.map(ins => {
      const obtenida = mapaObtenidas.get(ins.id);
      if (obtenida) {
        const fechaTexto = util.fechaLarga(obtenida.fecha) || 'Obtenida';
        return `
          <article class="tarjeta-insignia tarjeta-insignia--obtenida" tabindex="0" aria-label="Insignia desbloqueada: ${ui.escapar(ins.nombre || ins.id)}">
            <span class="tarjeta-insignia__icono" role="img" aria-label="Ícono de insignia">${ui.escapar(ins.icono || '🏆')}</span>
            <h3 class="tarjeta-insignia__nombre">${ui.escapar(ins.nombre || ins.id)}</h3>
            <span class="tarjeta-insignia__fecha">📅 ${ui.escapar(fechaTexto)}</span>
          </article>
        `;
      } else {
        return `
          <article class="tarjeta-insignia tarjeta-insignia--bloqueada" tabindex="0" aria-label="Insignia bloqueada: ${ui.escapar(ins.nombre || ins.id)}. Condición: ${ui.escapar(ins.descripcion || '')}">
            <span class="tarjeta-insignia__icono" role="img" aria-label="Insignia bloqueada">${ui.escapar(ins.icono || '🔒')}</span>
            <h3 class="tarjeta-insignia__nombre">${ui.escapar(ins.nombre || ins.id)}</h3>
            <p class="tarjeta-insignia__condicion">${ui.escapar(ins.descripcion || 'Condición por cumplir')}</p>
          </article>
        `;
      }
    }).join('');

    const vitrinaHtml = `
      <section class="vitrina-insignias" aria-labelledby="tituloVitrina">
        <div class="vitrina-insignias__header">
          <h2 id="tituloVitrina">Vitrina de insignias</h2>
          <span class="chip" aria-label="${mapaObtenidas.size} de ${catalogo.length} insignias desbloqueadas">
            🏆 ${mapaObtenidas.size} de ${catalogo.length} desbloqueadas
          </span>
        </div>
        <div class="grid-insignias" role="list">
          ${tarjetasInsigniasHtml || '<p class="texto-suave">No hay insignias registradas en el catálogo.</p>'}
        </div>
      </section>
    `;

    // 3. Certificado de cumplimiento: una barra .progreso por condición y botón "Descargar certificado"
    const condiciones = Array.isArray(estadoCert?.condiciones) ? estadoCert.condiciones : [];
    const cumple = Boolean(estadoCert?.cumple);

    const condicionesHtml = condiciones.map((c, idx) => {
      let pct = 0;
      if (c.cumple) {
        pct = 100;
      } else {
        const actNum = typeof c.actual === 'string' ? parseFloat(c.actual) : Number(c.actual) || 0;
        const reqNum = typeof c.requerido === 'string' ? parseFloat(c.requerido) : Number(c.requerido) || 1;
        pct = reqNum > 0 ? Math.min(100, Math.max(0, Math.round((actNum / reqNum) * 100))) : 0;
      }

      return `
        <div class="condicion-item" id="condicionCertificado-${idx}">
          <div class="condicion-item__encabezado">
            <span class="condicion-item__titulo">${ui.escapar(c.nombre)}</span>
            <span class="condicion-item__estado" style="color: ${c.cumple ? 'var(--color-exito)' : 'var(--color-texto-suave)'};">
              ${c.cumple ? '✅ Cumplido' : `⏳ ${ui.escapar(String(c.actual))} / ${ui.escapar(String(c.requerido))}`}
            </span>
          </div>
          <div class="progreso ${c.cumple ? 'progreso--acento' : ''}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ui.escapar(c.nombre)}: ${pct}%">
            <span class="progreso__barra" style="width: ${pct}%;"></span>
          </div>
        </div>
      `;
    }).join('');

    const certificadoHtml = `
      <section class="seccion-certificado" aria-labelledby="tituloCertificado">
        <div class="seccion-certificado__header">
          <h2 id="tituloCertificado">Certificado de cumplimiento</h2>
          <p>Alcanza los objetivos académicos requeridos para descargar tu diploma oficial emitido por la plataforma</p>
        </div>

        <div class="lista-condiciones-certificado">
          ${condicionesHtml || '<p class="texto-suave">No hay condiciones registradas para el certificado.</p>'}
        </div>

        <div class="seccion-certificado__acciones">
          <p class="seccion-certificado__ayuda">
            ${cumple
              ? '🎉 ¡Felicitaciones! Has completado todos los requisitos requeridos para obtener tu diploma oficial.'
              : '💡 Completa quizzes, acumula puntos y revisa los temas asignados para habilitar tu certificado.'}
          </p>
          <button type="button" id="btnDescargarCertificado" class="btn btn--primario" ${cumple ? '' : 'disabled'}>
            Descargar certificado
          </button>
        </div>
      </section>
    `;

    seccion.innerHTML = `
      ${bannerHtml}
      ${vitrinaHtml}
      ${certificadoHtml}
    `;

    // Evento de descarga de certificado
    const btnDescargar = seccion.querySelector('#btnDescargarCertificado');
    if (btnDescargar && cumple) {
      btnDescargar.addEventListener('click', async () => {
        btnDescargar.disabled = true;
        const textoOriginal = btnDescargar.textContent;
        btnDescargar.textContent = 'Generando certificado...';
        ui.cargando(true);
        try {
          const resultado = await generarDiploma({ tipo: 'cumplimiento' });
          ui.aviso(`¡Certificado emitido exitosamente! Código: ${resultado.codigo}`, 'exito');
        } catch (error) {
          console.error('Error al generar diploma:', error);
          ui.aviso(error.message || 'Error al generar el certificado en PDF.', 'error');
        } finally {
          ui.cargando(false);
          btnDescargar.disabled = false;
          btnDescargar.textContent = textoOriginal;
        }
      });
    }
  } catch (error) {
    console.error('Error al cargar logros y certificados:', error);
    seccion.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        <p>No fue posible cargar tus logros y certificados. Intenta recargar la página.</p>
      </div>
    `;
  }
}
