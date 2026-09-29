// Datos DUMMY de servicios (profesionales y seguimiento de envíos) para el
// prototipo. Nombres ficticios; tarifas alineadas con el business case v2
// (médico ~€100, dietista ~€70, entrenador ~€60).

export type ProfessionalRole = 'doctor' | 'midwife' | 'dietitian' | 'trainer' | 'physio' | 'geneticist';

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

export const ROLE_INFO: Record<ProfessionalRole, { label: string; icon: string }> = {
  doctor: { label: 'Doctors', icon: 'medkit-outline' },
  midwife: { label: 'Midwives', icon: 'flower-outline' },
  dietitian: { label: 'Dietitians', icon: 'nutrition-outline' },
  trainer: { label: 'Personal trainers', icon: 'barbell-outline' },
  physio: { label: 'Physiotherapists', icon: 'body-outline' },
  geneticist: { label: 'Geneticists', icon: 'git-network-outline' },
};

export const mockProfessionals: Professional[] = [
  {
    id: 'pro-1',
    name: 'Dr. Laura Méndez',
    role: 'doctor',
    specialty: 'Internal medicine · Preventive health',
    bio: 'Reviews your full report, explains flagged markers and decides if anything needs follow-up with your GP.',
    pricePerSession: 100,
    sessionMinutes: 15,
    rating: 4.9,
    reviews: 128,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Tomorrow, 18:30',
    online: true,
  },
  {
    id: 'pro-2',
    name: 'Dr. Javier Ortega',
    role: 'doctor',
    specialty: 'Endocrinology',
    bio: 'Focus on metabolic health: glucose, insulin resistance and thyroid.',
    pricePerSession: 110,
    sessionMinutes: 20,
    rating: 4.8,
    reviews: 74,
    languages: ['Spanish'],
    nextAvailable: 'Wed 2 Oct, 10:00',
    online: true,
  },
  {
    id: 'pro-3',
    name: 'Marta Ruiz',
    role: 'dietitian',
    specialty: 'Clinical nutrition · Blood sugar',
    bio: 'Turns your results into a realistic eating plan, no extreme diets.',
    pricePerSession: 70,
    sessionMinutes: 45,
    rating: 4.9,
    reviews: 203,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Today, 19:00',
    online: true,
  },
  {
    id: 'pro-4',
    name: 'Pablo Serrano',
    role: 'dietitian',
    specialty: 'Sports nutrition',
    bio: 'Nutrition for people who train: performance, recovery and body composition.',
    pricePerSession: 65,
    sessionMinutes: 45,
    rating: 4.7,
    reviews: 91,
    languages: ['Spanish'],
    nextAvailable: 'Fri 4 Oct, 17:00',
    online: true,
  },
  {
    id: 'pro-5',
    name: 'Álex Navarro',
    role: 'trainer',
    specialty: 'Strength training · Beginners',
    bio: 'Builds a strength routine around your goals and schedule, at home or at the gym.',
    pricePerSession: 60,
    sessionMinutes: 60,
    rating: 4.8,
    reviews: 156,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Tomorrow, 08:00',
    online: false,
  },
  {
    id: 'pro-6',
    name: 'Irene Castillo',
    role: 'physio',
    specialty: 'Sports physiotherapy',
    bio: 'Injury prevention and mobility work so you can train consistently.',
    pricePerSession: 55,
    sessionMinutes: 45,
    rating: 4.9,
    reviews: 67,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Thu 3 Oct, 12:00',
    online: false,
  },
  {
    id: 'pro-8',
    name: 'Marta Echeverría',
    role: 'midwife',
    specialty: 'Midwife · Cycle and fertility',
    bio: 'Helps you read your cycle, hormones and fertility markers, and plan a pregnancy with confidence.',
    pricePerSession: 60,
    sessionMinutes: 30,
    rating: 4.9,
    reviews: 41,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Fri 4 Oct, 17:00',
    online: true,
  },
  {
    id: 'pro-7',
    name: 'Dr. Sofía Llorente',
    role: 'geneticist',
    specialty: 'Clinical genetics',
    bio: 'Interprets family history and genetic risk in the context of your blood tests.',
    pricePerSession: 100,
    sessionMinutes: 30,
    rating: 5.0,
    reviews: 22,
    languages: ['Spanish', 'English'],
    nextAvailable: 'Mon 7 Oct, 16:00',
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
      { label: 'Kit prepared', detail: 'HomeTest warehouse, Madrid', date: '25 Sep', status: 'done' },
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
