// Prepara los datos de la tarea "rol-simulacion": verifica el acceso a la simulación y arma la conversación.
import { cargarSimulacionDeRol, limpiarHistorial, ETIQUETA_ROL } from '../rol-comun.js';

export default async function preparar(cuerpo, usuario) {
  const sim = await cargarSimulacionDeRol(cuerpo.simulacionId, usuario);
  const historial = limpiarHistorial(cuerpo.historial, sim.maxTurnos, { ultimoEsEstudiante: true });
  const p = sim.personaje;
  const previos = historial.slice(0, -1).map((m) => `${ETIQUETA_ROL[m.rol](p)}: ${m.texto}`);

  return {
    personaje: `${p.nombre}. ${p.descripcion}`,
    contexto: p.contexto,
    objetivo: p.objetivo,
    historial: previos.length ? previos : ['(la conversación apenas comienza)'],
    mensaje: historial[historial.length - 1].texto
  };
}
