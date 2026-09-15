import { ExtractedLabReport, ExtractedSeccion } from '@/types/labReport';

const EMPTY_PATIENT: ExtractedLabReport['paciente'] = {
  nombre: null,
  fecha_recepcion: null,
  fecha_validacion: null,
  numero_informe: null,
  laboratorio: null,
};

// Combina los resultados de varios lotes (cada uno cubre unas pocas páginas
// del mismo informe) en un único reporte, fusionando secciones repetidas.
export function mergeLabReports(reports: ExtractedLabReport[]): ExtractedLabReport {
  const paciente =
    reports.find((r) => r.paciente && Object.values(r.paciente).some(Boolean))?.paciente ??
    EMPTY_PATIENT;

  const seccionesOrden: string[] = [];
  const seccionesMap = new Map<string, ExtractedSeccion>();

  for (const report of reports) {
    for (const seccion of report.secciones ?? []) {
      const existing = seccionesMap.get(seccion.titulo);
      if (existing) {
        existing.parametros.push(...seccion.parametros);
      } else {
        seccionesMap.set(seccion.titulo, {
          titulo: seccion.titulo,
          parametros: [...seccion.parametros],
        });
        seccionesOrden.push(seccion.titulo);
      }
    }
  }

  return {
    paciente,
    secciones: seccionesOrden.map((titulo) => seccionesMap.get(titulo)!),
  };
}
