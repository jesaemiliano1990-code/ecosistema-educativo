// publico/js/modulos/verificar.js
// Validador público de autenticidad de diplomas y certificados académicos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Verificación de Certificados', roles: ['publico'] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="verificar-vista">
      <header class="verificar-encabezado">
        <h1 class="verificar-encabezado__titulo">Verificación de Certificados</h1>
        <p class="verificar-encabezado__subtitulo">
          Valida la autenticidad e integridad de los diplomas y certificados emitidos por el Ecosistema Educativo UNEMI.
        </p>
      </header>

      <form id="formVerificar" class="verificar-formulario" role="search" aria-label="Consulta de certificado">
        <label for="inputCodigo" style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">
          Ingresa el código del certificado:
        </label>
        <div class="verificar-input-grupo">
          <input type="text"
                 id="inputCodigo"
                 name="codigo"
                 class="verificar-input"
                 placeholder="EE-2026-ABC123"
                 required
                 autocomplete="off"
                 spellcheck="false"
                 autofocus>
          <button type="submit" id="btnConsultar" class="btn btn--primario">
            🔍 Validar
          </button>
        </div>
        <small style="color: var(--color-texto-suave); display: block; margin-top: var(--espacio-xs);">
          Formato de ejemplo: EE-AAAA-XXXXXX (visible al pie de cada diploma)
        </small>
      </form>

      <div id="resultadoContenedor" class="verificar-resultado" aria-live="polite"></div>
    </div>
  `;

  const form = document.getElementById('formVerificar');
  const inputCodigo = document.getElementById('inputCodigo');
  const resultadoContenedor = document.getElementById('resultadoContenedor');

  async function consultarCodigo(codigoBruto) {
    const codigo = (codigoBruto || '').trim().toUpperCase();
    if (!codigo) {
      ui.aviso('Por favor ingresa un código de certificado.', 'advertencia');
      return;
    }

    ui.cargando(true);
    resultadoContenedor.innerHTML = '';

    try {
      const res = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

      if (res && res.valido) {
        resultadoContenedor.innerHTML = `
          <article class="resultado-tarjeta resultado-tarjeta--valido" role="region" aria-label="Certificado válido">
            <div class="resultado-encabezado">
              <span class="resultado-icono" aria-hidden="true">✅</span>
              <h2 class="resultado-estado-titulo">Certificado Oficial Auténtico y Válido</h2>
            </div>

            <p style="margin: 0; color: var(--color-texto); font-size: var(--texto-s);">
              Se ha verificado satisfactoriamente el registro de emisión en los archivos oficiales de la plataforma educativa.
            </p>

            <div class="resultado-datos">
              <div class="dato-item">
                <span class="dato-item__etiqueta">Titular del Certificado</span>
                <span class="dato-item__valor dato-item__valor--destacado">${ui.escapar(res.nombreCompleto)}</span>
              </div>

              <div class="dato-item">
                <span class="dato-item__etiqueta">Logro Reconocido</span>
                <span class="dato-item__valor">${ui.escapar(res.detalle)}</span>
              </div>

              <div class="dato-item">
                <span class="dato-item__etiqueta">Fecha de Emisión</span>
                <span class="dato-item__valor">${ui.escapar(util.fechaLarga(res.fecha))}</span>
              </div>

              <div class="dato-item">
                <span class="dato-item__etiqueta">Código Único Registrado</span>
                <span class="dato-item__valor dato-item__valor--codigo">${ui.escapar(codigo)}</span>
              </div>
            </div>
          </article>
        `;
      } else {
        resultadoContenedor.innerHTML = `
          <article class="resultado-tarjeta resultado-tarjeta--invalido" role="region" aria-label="Certificado no válido">
            <div class="resultado-encabezado">
              <span class="resultado-icono" aria-hidden="true">❌</span>
              <h2 class="resultado-estado-titulo">Certificado No Encontrado o No Válido</h2>
            </div>
            <p style="margin: 0; color: var(--color-texto); font-size: var(--texto-s);">
              El código <strong>${ui.escapar(codigo)}</strong> no coincide con ningún documento emitido oficialmente. Por favor revisa que todos los caracteres coincidan exactamente con el diploma impreso o digital.
            </p>
          </article>
        `;
      }
    } catch (error) {
      ui.aviso(error.message || 'Error al conectar con el servicio de verificación.', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    consultarCodigo(inputCodigo.value);
  });

  // Si viene ?codigo= en la URL, ejecutar consulta automática
  const codigoUrl = util.parametro('codigo');
  if (codigoUrl) {
    inputCodigo.value = codigoUrl;
    consultarCodigo(codigoUrl);
  }
}
