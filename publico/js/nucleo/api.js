// publico/js/nucleo/api.js
// Cliente HTTP para el API REST del ecosistema educativo

export async function llamar(metodo, ruta, cuerpo = null) {
  const metodoMayus = (metodo || 'GET').toUpperCase();
  const headers = {};

  const token = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodoMayus,
    headers
  };

  if (cuerpo !== null && cuerpo !== undefined && metodoMayus !== 'GET' && metodoMayus !== 'HEAD') {
    if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const url = ruta.startsWith('http') || ruta.startsWith('/') ? ruta : `/${ruta}`;
  const respuesta = await fetch(url, opciones);

  if (respuesta.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
    const rutaActual = typeof window !== 'undefined' && window.location ? (window.location.pathname || '') : '';
    const enIngresoORegistro = rutaActual.endsWith('ingreso.html') || rutaActual.endsWith('registro.html') || rutaActual.includes('ingreso.html') || rutaActual.includes('registro.html');
    if (!enIngresoORegistro && typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
  }


  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (datos && typeof datos === 'object' && datos.error) {
    throw new Error(datos.error);
  }

  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error ${respuesta.status}: ${respuesta.statusText || 'Petición fallida'}`);
  }

  return datos;
}

export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) {
      params.append(clave, valor);
    }
  }
  const query = params.toString();
  const ruta = `/api/${col}${query ? `?${query}` : ''}`;
  return llamar('GET', ruta);
}

export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return llamar('POST', '/api/subidas', formData);
}

export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${encodeURIComponent(tarea)}`, datos);
}

export default {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  llamar,
  subir,
  ia
};
