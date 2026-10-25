// publico/js/nucleo/avatar.js
// Avatar guía: personaje original en SVG con estados, globo de texto y voz opcional (speechSynthesis)

const ESTADOS = ['reposo', 'hablando', 'pensando', 'celebrando'];
const CLAVE_VOZ = 'avatar.voz'; // "1" = voz activa; por defecto está silenciada
const CLAVE_OCULTO = 'avatar.oculto'; // "1" = oculto

let estadoActual = 'reposo';
let ultimoTexto = '';
let temporizadorGlobo = null;
let temporizadorEstado = null;

// Las preferencias viven en localStorage; si el navegador lo impide, se usan los valores por defecto.
function leerPref(clave) {
  try { return localStorage.getItem(clave) === '1'; } catch { return false; }
}
function guardarPref(clave, valor) {
  try { localStorage.setItem(clave, valor ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ }
}

const el = (id) => document.getElementById(id);
const soportaVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function hayAvatar() {
  return typeof document !== 'undefined' && Boolean(el('avatarGuia'));
}

export function estadoAvatar() {
  return estadoActual;
}

export function vozActiva() {
  return soportaVoz() && leerPref(CLAVE_VOZ);
}

// ----------------------------------------------------
// ESTADOS
// ----------------------------------------------------

export function cambiarEstado(estado) {
  if (!hayAvatar() || !ESTADOS.includes(estado)) return;
  clearTimeout(temporizadorEstado);
  const avatar = el('avatarGuia');
  ESTADOS.forEach((e) => avatar.classList.toggle(`avatar-guia--${e}`, e === estado));
  estadoActual = estado;
}

// Vuelve al reposo pasado un tiempo (si todavía está en el estado indicado).
function reposoTras(ms, desde) {
  clearTimeout(temporizadorEstado);
  temporizadorEstado = setTimeout(() => { if (estadoActual === desde) cambiarEstado('reposo'); }, ms);
}

// ----------------------------------------------------
// VOZ
// ----------------------------------------------------

// Prefiere es-EC, luego otras variantes latinoamericanas y por último cualquier es-*.
function elegirVoz() {
  const voces = window.speechSynthesis.getVoices().filter((v) => /^es([-_]|$)/i.test(v.lang));
  const orden = [/^es[-_]EC/i, /^es[-_](419|MX|US|CO|PE|AR|CL)/i, /^es/i];
  for (const patron of orden) {
    const v = voces.find((x) => patron.test(x.lang));
    if (v) return v;
  }
  return null;
}

function hablar(texto, alTerminar) {
  window.speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  const voz = elegirVoz();
  frase.lang = voz ? voz.lang : 'es-EC';
  if (voz) frase.voice = voz;
  frase.onend = alTerminar;
  frase.onerror = alTerminar; // p. ej., el navegador exige un clic antes de permitir la voz
  window.speechSynthesis.speak(frase);
}

function pintarBotones() {
  const voz = el('avatarVoz');
  if (!voz) return;
  const soporta = soportaVoz();
  voz.hidden = !soporta;
  const activa = vozActiva();
  voz.textContent = activa ? '🔊' : '🔇';
  voz.setAttribute('aria-label', activa ? 'Silenciar la voz del guía' : 'Activar la voz del guía');
  voz.setAttribute('aria-pressed', String(activa));
  voz.title = activa ? 'Silenciar voz' : 'Activar voz';
}

// ----------------------------------------------------
// TEXTO
// ----------------------------------------------------

/**
 * Muestra el texto en el globo y, si la voz está activa, lo lee.
 * { globo: false } solo cambia el estado y lee en voz alta (para respuestas que ya están en pantalla).
 */
export function decir(texto, { globo = true } = {}) {
  if (!hayAvatar() || typeof texto !== 'string' || !texto.trim()) return;
  const limpio = texto.trim();
  if (el('avatarGuia').hidden) { // oculto: no habla, pero recuerda el texto para cuando se muestre
    if (globo) ultimoTexto = limpio;
    return;
  }
  const duracion = Math.min(15000, Math.max(5000, limpio.length * 60));

  if (globo) {
    ultimoTexto = limpio;
    const caja = el('avatarGlobo');
    caja.textContent = limpio;
    caja.hidden = false;
    clearTimeout(temporizadorGlobo);
    temporizadorGlobo = setTimeout(() => { caja.hidden = true; }, duracion);
  }

  cambiarEstado('hablando');
  if (vozActiva()) {
    const terminar = () => { if (estadoActual === 'hablando') cambiarEstado('reposo'); };
    hablar(limpio, terminar);
    reposoTras(60000, 'hablando'); // red de seguridad si el navegador nunca avisa que terminó
  } else {
    reposoTras(Math.min(4000, Math.max(1500, limpio.length * 30)), 'hablando');
  }
}

// ----------------------------------------------------
// MONTAJE
// ----------------------------------------------------

const SVG = `
<svg class="avatar-guia__svg" viewBox="0 0 120 140" aria-hidden="true" focusable="false">
  <g class="av-cuerpo-g">
    <line class="av-antena" x1="60" y1="14" x2="60" y2="26" />
    <circle class="av-bombilla" cx="60" cy="10" r="6" />
    <path class="av-brazo av-brazo--izq" d="M26 82 Q10 90 14 108" />
    <path class="av-brazo av-brazo--der" d="M94 82 Q110 90 106 108" />
    <ellipse class="av-cuerpo" cx="60" cy="86" rx="38" ry="44" />
    <ellipse class="av-panza" cx="60" cy="98" rx="24" ry="28" />
    <path class="av-ceja" d="M34 52 Q60 40 86 52" />
    <circle class="av-ojo-fondo" cx="44" cy="62" r="15" />
    <circle class="av-ojo-fondo" cx="76" cy="62" r="15" />
    <g class="av-ojos">
      <circle class="av-pupila av-pupila--izq" cx="44" cy="63" r="7" />
      <circle class="av-pupila av-pupila--der" cx="76" cy="63" r="7" />
    </g>
    <path class="av-pico" d="M54 74 L66 74 L60 85 Z" />
    <ellipse class="av-boca" cx="60" cy="92" rx="6" ry="1.5" />
    <path class="av-pata" d="M44 128 l-6 8 h14 z M76 128 l-6 8 h14 z" />
  </g>
</svg>`;

export function montarAvatar() {
  if (typeof document === 'undefined') return;
  if (hayAvatar()) return;

  const contenedor = document.createElement('div');
  contenedor.className = 'avatar-guia avatar-guia--reposo';
  contenedor.id = 'avatarGuia';
  contenedor.setAttribute('role', 'complementary');
  contenedor.setAttribute('aria-label', 'Guía virtual');
  contenedor.hidden = leerPref(CLAVE_OCULTO);
  contenedor.innerHTML = `
    <div class="avatar-guia__globo" id="avatarGlobo" role="status" aria-live="polite" hidden></div>
    <button type="button" class="avatar-guia__personaje" id="avatarPersonaje" aria-label="Escuchar de nuevo las instrucciones del guía">${SVG}</button>
    <div class="avatar-guia__botones">
      <button type="button" class="avatar-guia__boton" id="avatarVoz"></button>
      <button type="button" class="avatar-guia__boton" id="avatarOcultar" aria-label="Ocultar al guía" title="Ocultar guía">✕</button>
    </div>`;
  document.body.appendChild(contenedor);

  const mostrar = document.createElement('button');
  mostrar.type = 'button';
  mostrar.id = 'avatarMostrar';
  mostrar.className = 'avatar-guia__mostrar';
  mostrar.textContent = '🦉';
  mostrar.setAttribute('aria-label', 'Mostrar al guía');
  mostrar.title = 'Mostrar guía';
  mostrar.hidden = !contenedor.hidden;
  document.body.appendChild(mostrar);

  el('avatarVoz').addEventListener('click', () => {
    const activar = !vozActiva();
    guardarPref(CLAVE_VOZ, activar);
    if (!activar && soportaVoz()) window.speechSynthesis.cancel();
    pintarBotones();
    if (activar && ultimoTexto) decir(ultimoTexto); // al activar la voz se lee lo último que dijo
  });
  el('avatarOcultar').addEventListener('click', () => {
    guardarPref(CLAVE_OCULTO, true);
    if (soportaVoz()) window.speechSynthesis.cancel();
    contenedor.hidden = true;
    mostrar.hidden = false;
    mostrar.focus();
  });
  mostrar.addEventListener('click', () => {
    guardarPref(CLAVE_OCULTO, false);
    contenedor.hidden = false;
    mostrar.hidden = true;
    el('avatarPersonaje').focus();
    if (ultimoTexto) decir(ultimoTexto);
  });
  el('avatarPersonaje').addEventListener('click', () => { if (ultimoTexto) decir(ultimoTexto); });

  // Las voces del navegador pueden cargarse un poco después de abrir la página.
  if (soportaVoz()) window.speechSynthesis.addEventListener?.('voiceschanged', pintarBotones);
  window.addEventListener('pagehide', () => { if (soportaVoz()) window.speechSynthesis.cancel(); });
  pintarBotones();
}

export default { montarAvatar, decir, cambiarEstado, hayAvatar, estadoAvatar, vozActiva };
