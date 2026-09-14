// Tipos del MVP

export interface Patient {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  created_at: string;
}

export interface Order {
  id: string;
  patient_id: string;
  tipo_test: string;
  estado: 'pendiente_recogida' | 'recogido' | 'enviado' | 'en_laboratorio' | 'resultado_listo';
  fecha_recogida?: string;
  fecha_envio?: string;
  fecha_entrega_laboratorio?: string;
  fecha_resultado?: string;
  direccion_recogida?: string;
  created_at: string;
}

export interface LabResult {
  id: string;
  order_id: string;
  patient_id: string;
  nombre_parametro: string;
  valor: number;
  unidad: string;
  rango_min?: number;
  rango_max?: number;
  fecha: string;
  informe_url?: string;
  extraido_por: 'ocr' | 'manual';
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
}
