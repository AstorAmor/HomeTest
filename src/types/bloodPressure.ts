export interface BloodPressureEntry {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  fecha: string; // ISO timestamp de la medición (editable por el usuario)
  source: 'photo' | 'manual';
  createdAt: string;
}

export interface ExtractedBloodPressure {
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
}
