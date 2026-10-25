// Prepara los datos de la tarea "evaluar-rol": personaje, objetivo, rúbrica y transcripción.
import { cargarSimulacionDeRol, limpiarHistorial, ETIQUETA_ROL } from '../rol-comun.js';

export default async function preparar(cuerpo, usuario) {
  const sim = await cargarSimulacionDeRol(cuerpo.simulacionId, usuario);
  const historial = limpiarHistorial(cuerpo.historial, sim.maxTurnos, { ultimoEsEstudiante: false });
  const p = sim.personaje;
  if (!sim.rubrica.length) {
    throw Object.assign(new Error('La simulación no tiene rúbrica'), { estado: 400 });
  }

  return {
    personaje: `${p.nombre}. ${p.descripcion}`,
    objetivo: p.objetivo,
    rubrica: sim.rubrica.map((r) => `- ${r.criterio} (máximo ${r.puntos} puntos)${r.descripcion ? `: ${r.descripcion}` : ''}`),
    transcripcion: historial.map((m) => `${ETIQUETA_ROL[m.rol](p)}: ${m.texto}`),
    // No va al prompt: la ruta lo usa para corregir los puntos con la rúbrica real.
    _rubrica: sim.rubrica
  };
}
