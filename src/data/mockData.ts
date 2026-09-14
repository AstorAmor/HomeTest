import { Patient } from '@/types';

export const mockPatient: Patient = {
  id: 'patient-001',
  nombre: 'Juan García López',
  email: 'juan.garcia@example.com',
  telefono: '+34 666 123 456',
  direccion: 'Calle Mayor 42, 28001 Madrid, España',
  created_at: '2026-01-15T10:30:00Z',
};

export type BiomarkerStatus = 'excellent' | 'good' | 'attention' | 'high';

export interface Biomarker {
  id: string;
  nombre: string;
  valor: string;
  unidad: string;
  status: BiomarkerStatus;
  statusLabel: string;
  history: number[];
}

export const mockBiomarkers: Biomarker[] = [
  {
    id: 'sugar',
    nombre: 'Sugar',
    valor: '94',
    unidad: 'mg/dL',
    status: 'excellent',
    statusLabel: 'Excellent!',
    history: [88, 91, 90, 93, 89, 94],
  },
  {
    id: 'cholesterol',
    nombre: 'Total Cholesterol',
    valor: '165',
    unidad: 'mg/dL',
    status: 'good',
    statusLabel: 'Good',
    history: [150, 158, 155, 172, 160, 165],
  },
  {
    id: 'blood_pressure',
    nombre: 'Blood Pressure',
    valor: '120/80',
    unidad: 'mmHg',
    status: 'good',
    statusLabel: 'Good',
    history: [118, 122, 119, 125, 121, 120],
  },
  {
    id: 'cortisol',
    nombre: 'Cortisol',
    valor: '18',
    unidad: 'µg/dL (approx. morning)',
    status: 'excellent',
    statusLabel: 'Excellent!',
    history: [22, 21, 20, 19, 18.5, 18],
  },
];

export const mockNextTestDate = '2026-10-10';
export const mockResultsEtaDays = 3;

export interface Recommendation {
  id: string;
  title: string;
  imageKey: 'daily_walk' | 'sleep_well';
}

export const mockRecommendations: Recommendation[] = [
  { id: 'rec-1', title: 'Daily walk', imageKey: 'daily_walk' },
  { id: 'rec-2', title: 'Sleep well', imageKey: 'sleep_well' },
];

export type DiagnosticStatus = 'ok' | 'waiting' | 'attention';

export interface DiagnosticTest {
  id: string;
  nombre: string;
  status: DiagnosticStatus;
  statusLabel?: string;
}

export const mockDiagnosticTests: DiagnosticTest[] = [
  { id: 'fobt', nombre: 'FOBT', status: 'ok' },
  { id: 'vih', nombre: 'VIH', status: 'waiting', statusLabel: 'Waiting for results' },
  { id: 'hepa', nombre: 'Hep A', status: 'ok' },
  { id: 'apob', nombre: 'ApoB', status: 'ok' },
];

export interface UpcomingAnalysis {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
}

export const mockUpcomingAnalyses: UpcomingAnalysis[] = [
  {
    id: 'up-1',
    nombre: 'Blood Analysis',
    descripcion: 'Glucose, Insulin, Lipid Profile...',
    fecha: '2026-09-23',
  },
  {
    id: 'up-2',
    nombre: 'Diagnostic Test',
    descripcion: 'FOBT...',
    fecha: '2026-10-03',
  },
];

export type LabResultStatus = 'good' | 'attention';

export interface LabResultParam {
  nombre: string;
  valor: string;
  estado: 'normal' | 'high' | 'low';
  min: number;
  max: number;
  posicion: number; // 0 to 1, position of the marker on the bar
}

export interface LabResultPanel {
  id: string;
  nombre: string;
  fecha: string;
  status: LabResultStatus;
  statusLabel: string;
  parametros: LabResultParam[];
}

export const mockLabResultPanels: LabResultPanel[] = [
  {
    id: 'panel-1',
    nombre: 'Full Blood Count',
    fecha: '2026-09-23',
    status: 'good',
    statusLabel: 'Good',
    parametros: [
      { nombre: 'Hb', valor: '14.2 g/dL (normal)', estado: 'normal', min: 0, max: 1, posicion: 0.5 },
      { nombre: 'WBC', valor: '6.5 x10^9/L (normal)', estado: 'normal', min: 0, max: 1, posicion: 0.4 },
    ],
  },
  {
    id: 'panel-2',
    nombre: 'Thyroid Panel',
    fecha: '2026-10-03',
    status: 'attention',
    statusLabel: 'Action Required',
    parametros: [
      { nombre: 'TSH', valor: '6.8 mIU/L (High)', estado: 'high', min: 0, max: 1, posicion: 0.85 },
      { nombre: 'Free T4', valor: '1.1 ng/dL (Normal)', estado: 'normal', min: 0, max: 1, posicion: 0.45 },
    ],
  },
];

export interface Doctor {
  nombre: string;
  especialidad: string;
}

export const mockDoctor: Doctor = {
  nombre: 'Dr. Sarah Johnson',
  especialidad: 'Specialist',
};
