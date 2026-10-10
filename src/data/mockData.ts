import { Patient } from '@/types';
import { t } from '@/i18n';

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

export type DiagnosticStatus = 'ok' | 'waiting' | 'attention';

export interface DiagnosticTest {
  id: string;
  nombre: string;
  status: DiagnosticStatus;
  statusLabel?: string;
}

export const mockDiagnosticTests: DiagnosticTest[] = [
  { id: 'fobt', nombre: 'FOBT', status: 'ok' },
  { id: 'vih', nombre: 'HIV', status: 'waiting', statusLabel: 'Waiting for results' },
  { id: 'hepa', nombre: 'Hep A', status: 'ok' },
  { id: 'apob', nombre: 'ApoB', status: 'ok' },
];

export interface UpcomingMarkerGroup {
  category: string;
  markers: string[];
}

export interface UpcomingAnalysis {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  timeSlot: string;
  sampleType: string;
  preparation: string[];
  markerGroups: UpcomingMarkerGroup[];
}

// Primera letra en mayúscula (algunas traducciones se usan también a mitad de frase)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const mockUpcomingAnalyses: UpcomingAnalysis[] = [
  {
    id: 'up-1',
    nombre: cap(t('Blood Analysis')),
    descripcion: t('Glucose, Insulin, Lipid Profile...'),
    fecha: '2026-10-10',
    timeSlot: '08:00 – 10:00',
    sampleType: t('At-home blood collection kit'),
    preparation: [
      t('Fast for 8 hours (water is fine)'),
      t('Avoid intense exercise the day before'),
      t('Take the sample before 10:00'),
    ],
    markerGroups: [
      { category: t('Metabolic'), markers: [t('Glucose'), t('HbA1c'), t('Insulin'), t('HOMA-IR')] },
      { category: t('Lipids'), markers: [t('Total cholesterol'), t('LDL'), t('HDL'), t('Triglycerides'), t('ApoB')] },
      { category: t('Liver'), markers: [t('ALT'), t('AST'), t('GGT')] },
      { category: t('Kidney'), markers: [t('Creatinine'), t('eGFR')] },
      { category: t('Thyroid'), markers: [t('TSH'), t('Free T4')] },
      { category: t('Inflammation'), markers: [t('hs-CRP')] },
      { category: t('Vitamins & iron'), markers: [t('Vitamin D'), t('Vitamin B12'), t('Ferritin')] },
    ],
  },
  {
    id: 'up-2',
    nombre: t('Diagnostic Test'),
    descripcion: t('FOBT...'),
    fecha: '2026-10-17',
    timeSlot: t('Any time'),
    sampleType: t('Stool sample kit'),
    preparation: [t('Follow the kit instructions'), t('Send it back within 24 hours')],
    markerGroups: [{ category: t('Colorectal screening'), markers: [t('Faecal occult blood (FOBT)')] }],
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
