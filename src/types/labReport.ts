export interface ExtractedPatientInfo {
  nombre: string | null;
  fecha_recepcion: string | null;
  fecha_validacion: string | null;
  numero_informe: string | null;
  laboratorio: string | null;
}

export interface ExtractedParametro {
  nombre: string;
  unidad: string;
  valor: number;
  rango_min: number | null;
  rango_max: number | null;
}

export interface ExtractedSeccion {
  titulo: string;
  parametros: ExtractedParametro[];
}

export interface ExtractedLabReport {
  paciente: ExtractedPatientInfo;
  secciones: ExtractedSeccion[];
}
