// Centros de extracción para "Book an appointment" (Lab). De momento, los 8 centros
// propios de Eurofins Megalab en la ciudad de Madrid, con coordenadas y horario de
// EXTRACCIONES del buscador oficial (eurofins-megalab.com/horarios-y-centros,
// consultado el 2026-09-29). Revisar horarios antes de abrir reservas reales.
// En agosto hay horario reducido; Máiquez y Núñez de Balboa cierran casi todo el mes.

export interface OpeningWindow {
  open: string; // HH:MM, primera extracción
  close: string; // HH:MM, última extracción
}

export interface LabCenter {
  id: string;
  network: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  weekdays: OpeningWindow; // lunes a viernes
  saturday?: OpeningWindow; // sin sábado = cerrado
  closedInAugust?: boolean;
  notes?: string; // accesibilidad y transporte
}

const PHONE = '+34 914 202 205';

export const LAB_CENTERS: LabCenter[] = [
  {
    id: 'eurofins-alfonso-xii',
    network: 'Eurofins Megalab',
    name: 'Alfonso XII',
    address: 'C/ Alfonso XII, 66 · 28014 Madrid',
    lat: 40.4080449,
    lng: -3.6888375,
    phone: PHONE,
    weekdays: { open: '08:00', close: '14:30' },
    saturday: { open: '08:30', close: '10:30' },
    notes: 'Step-free access. Near Atocha metro and train station, bus 19.',
  },
  {
    id: 'eurofins-orense',
    network: 'Eurofins Megalab',
    name: 'Calle Orense',
    address: 'C/ Orense, 29, 2º D · 28020 Madrid',
    lat: 40.4517932,
    lng: -3.6953079,
    phone: PHONE,
    weekdays: { open: '08:30', close: '13:50' },
    saturday: { open: '09:00', close: '11:00' },
  },
  {
    id: 'eurofins-habana',
    network: 'Eurofins Megalab',
    name: 'Habana',
    address: 'Paseo de la Habana, 2 · 28036 Madrid',
    lat: 40.4473413,
    lng: -3.6903928,
    phone: PHONE,
    weekdays: { open: '07:00', close: '19:00' },
    saturday: { open: '08:00', close: '13:00' },
  },
  {
    id: 'eurofins-jorge-juan',
    network: 'Eurofins Megalab',
    name: 'Jorge Juan',
    address: 'C/ Jorge Juan, 39 · 28001 Madrid',
    lat: 40.4238433,
    lng: -3.6821648,
    phone: PHONE,
    weekdays: { open: '07:30', close: '13:30' },
    saturday: { open: '08:00', close: '13:00' },
  },
  {
    id: 'eurofins-maiquez',
    network: 'Eurofins Megalab',
    name: 'Máiquez',
    address: 'C/ Jorge Juan, 104 (entrance on Máiquez, 2) · 28009 Madrid',
    lat: 40.4231379,
    lng: -3.6729301,
    phone: PHONE,
    weekdays: { open: '08:00', close: '13:30' },
    closedInAugust: true,
    notes: 'Step-free access. Metro Goya and O’Donnell.',
  },
  {
    id: 'eurofins-nunez-de-balboa',
    network: 'Eurofins Megalab',
    name: 'Núñez de Balboa',
    address: 'C/ Núñez de Balboa, 119 · 28006 Madrid',
    lat: 40.4369251,
    lng: -3.6819388,
    phone: PHONE,
    weekdays: { open: '08:00', close: '13:30' },
    closedInAugust: true,
    notes: 'Metro Avenida de América and Núñez de Balboa (Velázquez exit).',
  },
  {
    id: 'eurofins-pajaritos',
    network: 'Eurofins Megalab',
    name: 'Pajaritos',
    address: 'C/ Pajaritos, 19 · 28007 Madrid',
    lat: 40.4029055,
    lng: -3.6715391,
    phone: PHONE,
    weekdays: { open: '08:00', close: '18:30' },
    saturday: { open: '08:30', close: '10:30' },
    notes: 'Step-free access. Metro Pacífico and Conde de Casal.',
  },
  {
    id: 'eurofins-sagasta',
    network: 'Eurofins Megalab',
    name: 'Sagasta',
    address: 'C/ Sagasta, 18 · 28004 Madrid',
    lat: 40.428177,
    lng: -3.6987281,
    phone: PHONE,
    weekdays: { open: '07:00', close: '19:00' },
    saturday: { open: '08:00', close: '13:00' },
  },
];

export const hoursLabel = (c: LabCenter) =>
  `Mon–Fri ${c.weekdays.open}–${c.weekdays.close}` +
  (c.saturday ? ` · Sat ${c.saturday.open}–${c.saturday.close}` : ' · Sat closed');

// Ventana de extracciones de un día (YYYY-MM-DD), o null si está cerrado.
export function windowFor(c: LabCenter, day: string): OpeningWindow | null {
  const d = new Date(`${day}T12:00:00`);
  if (c.closedInAugust && d.getMonth() === 7) return null;
  const dow = d.getDay();
  if (dow === 0) return null;
  if (dow === 6) return c.saturday ?? null;
  return c.weekdays;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Huecos de 15 minutos dentro del horario de extracciones. Si el día es hoy, solo
// los que empiezan dentro de más de una hora.
export function slotsFor(c: LabCenter, day: string, now = new Date()): string[] {
  const w = windowFor(c, day);
  if (!w) return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = day === today;
  const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + 60 : 0;
  const out: string[] = [];
  for (let m = toMin(w.open); m <= toMin(w.close); m += 15) if (m >= earliest) out.push(toTime(m));
  return out;
}

export const directionsUrl = (c: LabCenter) =>
  `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
