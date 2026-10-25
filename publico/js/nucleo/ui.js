// publico/js/nucleo/ui.js
// Componentes y utilidades de interfaz accesibles

export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function limpiar(html) {
  if (html === null || html === undefined) return '';
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(String(html));
  }
  return escapar(html);
}

export function aviso(texto, tipo = 'info') {
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.className = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo} aviso aviso-${tipo}`;
  toast.setAttribute('role', 'status');
  toast.textContent = texto || '';

  contenedor.appendChild(toast);

  const temporizador = setTimeout(() => {
    cerrar();
  }, 4000);

  function cerrar() {
    clearTimeout(temporizador);
    toast.classList.add('desvanecer');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 200);
  }

  toast.addEventListener('click', cerrar);
  return toast;
}

export function modal({ titulo = '', contenido = '', acciones = [] } = {}) {
  return new Promise((resolve) => {
    const elementoPrevio = document.activeElement;

    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const idTitulo = `modal-titulo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (titulo) {
      dialog.setAttribute('aria-labelledby', idTitulo);
    }

    const tarjeta = document.createElement('div');
    tarjeta.className = 'modal-contenido';

    if (titulo) {
      const encabezado = document.createElement('div');
      encabezado.className = 'modal-encabezado';

      const h2 = document.createElement('h2');
      h2.id = idTitulo;
      h2.className = 'modal-titulo';
      h2.textContent = titulo;
      encabezado.appendChild(h2);

      const btnCerrar = document.createElement('button');
      btnCerrar.type = 'button';
      btnCerrar.className = 'modal-cerrar btn-cerrar';
      btnCerrar.setAttribute('aria-label', 'Cerrar diálogo');
      btnCerrar.innerHTML = '&times;';
      btnCerrar.addEventListener('click', () => cerrar(null));
      encabezado.appendChild(btnCerrar);

      tarjeta.appendChild(encabezado);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (contenido instanceof Node) {
      cuerpo.appendChild(contenido);
    } else if (typeof contenido === 'string') {
      cuerpo.innerHTML = limpiar(contenido);
    }
    tarjeta.appendChild(cuerpo);

    const pie = document.createElement('div');
    pie.className = 'modal-acciones';

    const listaAcciones = Array.isArray(acciones) && acciones.length > 0
      ? acciones
      : [{ texto: 'Aceptar', valor: true, clase: 'btn-primario' }];

    for (const acc of listaAcciones) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${acc.clase || ''}`.trim();
      btn.textContent = acc.texto || '';
      btn.addEventListener('click', () => {
        cerrar(acc.valor !== undefined ? acc.valor : null);
      });
      pie.appendChild(btn);
    }
    tarjeta.appendChild(pie);

    dialog.appendChild(tarjeta);
    document.body.appendChild(dialog);

    let cerrado = false;
    function cerrar(valor) {
      if (cerrado) return;
      cerrado = true;
      window.removeEventListener('keydown', manejarTeclas);
      if (typeof dialog.close === 'function') {
        try {
          dialog.close();
        } catch {
          // Si el diálogo ya estaba cerrado
        }
      }
      if (dialog.parentNode) {
        dialog.remove();
      }
      if (elementoPrevio && typeof elementoPrevio.focus === 'function') {
        elementoPrevio.focus();
      }
      resolve(valor);
    }

    function manejarTeclas(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(null);
        return;
      }
      if (e.key === 'Tab') {
        const selectores = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const enfocables = Array.from(dialog.querySelectorAll(selectores));
        if (enfocables.length === 0) {
          e.preventDefault();
          return;
        }
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primero || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            primero.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', manejarTeclas);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        cerrar(null);
      }
    });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      cerrar(null);
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    const primerEnfocable = dialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (primerEnfocable) {
      primerEnfocable.focus();
    } else {
      dialog.tabIndex = -1;
      dialog.focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmar',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return Boolean(resultado);
}

export function cargando(activar) {
  let el = document.getElementById('indicador-cargando');
  if (activar) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'indicador-cargando';
      el.className = 'cargando';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(el);
    }
    el.removeAttribute('hidden');
    el.style.display = '';
  } else if (el) {
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  }
}

export default {
  escapar,
  limpiar,
  aviso,
  modal,
  confirmar,
  cargando
};
