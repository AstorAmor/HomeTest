import { t } from '@/i18n';
// Datos DUMMY de servicios (profesionales y seguimiento de envíos) para el
// prototipo. Nombres ficticios; tarifas alineadas con el business case v2
// (médico ~€100, dietista ~€70, entrenador ~€60).

export type ProfessionalRole = 'doctor' | 'psychologist' | 'midwife' | 'dietitian' | 'trainer' | 'physio' | 'geneticist';

export interface Professional {
  id: string;
  name: string;
  role: ProfessionalRole;
  specialty: string;
  bio: string;
  pricePerSession: number;
  sessionMinutes: number;
  rating: number;
  reviews: number;
  languages: string[];
  nextAvailable: string;
  online: boolean;
}

// Icono de cada tipo de profesional (MaterialCommunityIcons): el mismo en Today (carrusel), en el
// filtro de Professionals y donde aparezca el rol.
export const ROLE_INFO: Record<ProfessionalRole, { label: string; icon: string; palette: [string, string, string] }> = {
  doctor: { label: t('Doctors'), icon: 'stethoscope', palette: ['#0E2A24', '#2E6B57', '#C9A36B'] },
  psychologist: { label: t('Psychologists'), icon: 'head-heart-outline', palette: ['#1E2A4A', '#4B5BA6', '#C7B6F2'] },
  midwife: { label: t('Midwives'), icon: 'human-pregnant', palette: ['#7A2E4E', '#C2477A', '#F7B6D2'] },
  dietitian: { label: t('Dietitians'), icon: 'food-apple-outline', palette: ['#3E6B5C', '#8DB6A2', '#E9D7B8'] },
  trainer: { label: t('Personal trainers'), icon: 'dumbbell', palette: ['#9C4A2F', '#D9663F', '#F0B84D'] },
  physio: { label: t('Physiotherapists'), icon: 'human-handsup', palette: ['#0F3D4C', '#2F8FA6', '#9FE0E8'] },
  geneticist: { label: t('Genetic counsellors'), icon: 'dna', palette: ['#8A6D3F', '#C9A36B', '#F3E2B8'] },
};

export const mockProfessionals: Professional[] = [
  // Profesionales con los que trabaja Kuova (2026-10-10). Valoraciones y textos provisionales:
  // confirmar con cada uno antes de enseñarlo fuera. rating 0 = aún sin valoraciones ("Nuevo en Kuova").
  {
    id: 'pro-gema-martinez',
    name: t('Dr. Gema Martínez Tamés'),
    role: 'doctor',
    specialty: t('Endocrinology'),
    bio: t('Hormones, thyroid and metabolism: she reviews your results and tells you what to do next.'),
    pricePerSession: 110,
    sessionMinutes: 20,
    rating: 4.9,
    reviews: 0,
    languages: ['Spanish'],
    nextAvailable: t('Tue 13 Oct, 17:00'),
    online: true,
  },
  {
    id: 'pro-alejandro-alonso',
    name: t('Dr. Alejandro Alonso Cabrero'),
    role: 'doctor',
    specialty: t('Haematology'),
    bio: t('Blood count, iron, ferritin and anaemia: what your values mean and when they need a closer look.'),
    pricePerSession: 110,
    sessionMinutes: 20,
    rating: 0,
    reviews: 0,
    languages: ['Spanish'],
    nextAvailable: t('Wed 14 Oct, 18:00'),
    online: true,
  },
  {
    id: 'pro-covadonga-carrera',
    name: t('Dr. Covadonga Carrera'),
    role: 'doctor',
    specialty: t('Dermatology'),
    bio: t('Skin, hair and nails, and how they relate to your blood tests and hormones.'),
    pricePerSession: 110,
    sessionMinutes: 20,
    rating: 0,
    reviews: 0,
    languages: ['Spanish'],
    nextAvailable: t('Thu 15 Oct, 16:30'),
    online: true,
  },
  {
    id: 'pro-andrea-otero',
    name: t('Dr. Andrea Otero Gonzalez'),
    role: 'geneticist',
    specialty: t('Genetic counselling'),
    bio: t('Goes through your family history with you and tells you whether a genetic test makes sense, and which one.'),
    pricePerSession: 80,
    sessionMinutes: 45,
    rating: 0,
    reviews: 0,
    languages: ['Spanish'],
    nextAvailable: t('Mon 12 Oct, 12:00'),
    online: true,
  },
  {
    id: 'pro-1',
    name: t('Dr. Laura Méndez'),
    role: 'doctor',
    specialty: t('Internal medicine · Preventive health'),
    bio: t('Reviews your full report, explains flagged markers and decides if anything needs follow-up with your GP.'),
    pricePerSession: 100,
    sessionMinutes: 15,
    rating: 4.9,
    reviews: 128,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Tomorrow, 18:30'),
    online: true,
  },
  {
    id: 'pro-2',
    name: t('Dr. Javier Ortega'),
    role: 'doctor',
    specialty: t('Endocrinology'),
    bio: t('Focus on metabolic health: glucose, insulin resistance and thyroid.'),
    pricePerSession: 110,
    sessionMinutes: 20,
    rating: 4.8,
    reviews: 74,
    languages: ['Spanish'],
    nextAvailable: t('Wed 2 Oct, 10:00'),
    online: true,
  },
  {
    id: 'pro-3',
    name: t('Marta Ruiz'),
    role: 'dietitian',
    specialty: t('Clinical nutrition · Blood sugar'),
    bio: t('Turns your results into a realistic eating plan, no extreme diets.'),
    pricePerSession: 70,
    sessionMinutes: 45,
    rating: 4.9,
    reviews: 203,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Today, 19:00'),
    online: true,
  },
  {
    id: 'pro-4',
    name: t('Pablo Serrano'),
    role: 'dietitian',
    specialty: t('Sports nutrition'),
    bio: t('Nutrition for people who train: performance, recovery and body composition.'),
    pricePerSession: 65,
    sessionMinutes: 45,
    rating: 4.7,
    reviews: 91,
    languages: ['Spanish'],
    nextAvailable: t('Fri 4 Oct, 17:00'),
    online: true,
  },
  {
    id: 'pro-5',
    name: t('Álex Navarro'),
    role: 'trainer',
    specialty: t('Strength training · Beginners'),
    bio: t('Builds a strength routine around your goals and schedule, at home or at the gym.'),
    pricePerSession: 60,
    sessionMinutes: 60,
    rating: 4.8,
    reviews: 156,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Tomorrow, 08:00'),
    online: false,
  },
  {
    id: 'pro-6',
    name: t('Irene Castillo'),
    role: 'physio',
    specialty: t('Sports physiotherapy'),
    bio: t('Injury prevention and mobility work so you can train consistently.'),
    pricePerSession: 55,
    sessionMinutes: 45,
    rating: 4.9,
    reviews: 67,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Thu 3 Oct, 12:00'),
    online: false,
  },
  {
    id: 'pro-8',
    name: t('Marta Echeverría'),
    role: 'midwife',
    specialty: t('Midwife · Cycle and fertility'),
    bio: t('Helps you read your cycle, hormones and fertility markers, and plan a pregnancy with confidence.'),
    pricePerSession: 60,
    sessionMinutes: 30,
    rating: 4.9,
    reviews: 41,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Fri 4 Oct, 17:00'),
    online: true,
  },
  {
    id: 'pro-7',
    name: t('Dr. Sofía Llorente'),
    role: 'geneticist',
    specialty: t('Clinical genetics'),
    bio: t('Interprets family history and genetic risk in the context of your blood tests.'),
    pricePerSession: 100,
    sessionMinutes: 30,
    rating: 5.0,
    reviews: 22,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Mon 7 Oct, 16:00'),
    online: true,
  },
  {
    id: 'pro-8',
    name: t('Marta Ibáñez, MSc'),
    role: 'geneticist',
    specialty: t('Genetic counselling · Family history and hereditary cancer'),
    bio: t('Goes through your family history with you, explains your risk in plain words and tells you if a genetic test makes sense, and which one.'),
    pricePerSession: 80,
    sessionMinutes: 45,
    rating: 4.9,
    reviews: 31,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Thu 10 Oct, 12:00'),
    online: true,
  },
  {
    id: 'pro-9',
    name: t('Clara Ruiz, PsyD'),
    role: 'psychologist',
    specialty: t('General health psychologist · Stress, anxiety and sleep'),
    bio: t('Helps you understand what is behind stress, low mood or poor sleep, and gives you practical tools to handle them.'),
    pricePerSession: 60,
    sessionMinutes: 50,
    rating: 4.9,
    reviews: 38,
    languages: ['Spanish', 'English'],
    nextAvailable: t('Tue 15 Oct, 18:00'),
    online: true,
  },
];

export type ShipmentStepStatus = 'done' | 'current' | 'pending';

export interface ShipmentStep {
  label: string;
  detail?: string;
  date?: string;
  status: ShipmentStepStatus;
}

export interface Shipment {
  id: string;
  testName: string;
  direction: 'to_you' | 'to_lab';
  carrier: string;
  trackingNumber: string;
  eta: string;
  steps: ShipmentStep[];
}

export interface TestHistoryItem {
  id: string;
  testName: string;
  date: string;
  status: string;
}

export const mockShipments: Shipment[] = [
  {
    id: 'ship-1',
    testName: 'Blood Analysis kit',
    direction: 'to_you',
    carrier: 'SEUR',
    trackingNumber: 'SEU 7812 3345 9021',
    eta: 'Thu 10 Oct, 08:00 – 10:00',
    steps: [
      { label: 'Order confirmed', date: '22 Sep', status: 'done' },
      { label: 'Kit prepared', detail: 'Kuova warehouse, Madrid', date: '25 Sep', status: 'done' },
      { label: 'Handed to carrier', detail: 'SEUR Madrid hub', date: '26 Sep', status: 'done' },
      { label: 'In transit', detail: 'Scheduled for your slot', status: 'current' },
      { label: 'Delivered', detail: 'Take your sample and book the pickup', status: 'pending' },
    ],
  },
  {
    id: 'ship-2',
    testName: 'Blood sample → Lab',
    direction: 'to_lab',
    carrier: 'Correos Express',
    trackingNumber: 'CEX 5520 1187 3346',
    eta: 'Same day as pickup',
    steps: [
      { label: 'Pickup booked', status: 'pending' },
      { label: 'Collected from your home', status: 'pending' },
      { label: 'Received at the lab', status: 'pending' },
      { label: 'Analysing', status: 'pending' },
      { label: 'Results ready', status: 'pending' },
    ],
  },
];

export const mockTestHistory: TestHistoryItem[] = [
  { id: 'h-1', testName: 'Follow-up blood analysis', date: '25 Sep 2026', status: 'Results ready' },
  { id: 'h-2', testName: 'Baseline blood analysis', date: '27 Mar 2026', status: 'Results ready' },
];
