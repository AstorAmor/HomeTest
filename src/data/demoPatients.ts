import { dateLocale, num, t } from '@/i18n';
import { ConsultRequest, PatientSummary } from './specialistTypes';

// "Simular X pacientes" del portal de demostración: además de los 4 pacientes fijos, pacientes de
// ejemplo generados siempre igual (mismo número → mismos pacientes), cada uno compartiendo cosas
// distintas, como pasará en la realidad: todo, solo la analítica, solo tensión y glucosa, nada
// todavía, un permiso caducado o retirado… Así se ve cómo queda el portal con muchos pacientes y
// qué ve (y qué no) el médico de cada uno. Nada sale del dispositivo.

export const DEMO_PATIENT_COUNTS = [4, 12, 40] as const;

export type ShareState = 'active' | 'none' | 'expired' | 'revoked';

export interface DemoPatient extends PatientSummary {
  labFromReport?: boolean;
  seed: number; // para generar sus datos de ejemplo siempre igual
}

// Generador pseudoaleatorio con semilla (mulberry32): mismos pacientes cada vez
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};

const WOMEN = ['Lucía', 'María', 'Paula', 'Sara', 'Carmen', 'Ana', 'Marta', 'Irene', 'Nuria', 'Cristina', 'Alba', 'Beatriz', 'Rocío', 'Silvia', 'Patricia', 'Clara', 'Inés', 'Raquel', 'Eva', 'Julia'];
const MEN = ['Pablo', 'Daniel', 'Alejandro', 'David', 'Sergio', 'Jorge', 'Manuel', 'Adrián', 'Álvaro', 'Miguel', 'Raúl', 'Iván', 'Rubén', 'Óscar', 'Hugo', 'Marcos', 'Andrés', 'Diego', 'Víctor', 'Luis'];
const SURNAMES = ['García', 'Fernández', 'López', 'Sánchez', 'Pérez', 'Navarro', 'Romero', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Serrano', 'Molina', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Iglesias', 'Medina'];

const ALL_SCOPES = ['profile', 'lab_reports', 'plan', 'glucose', 'blood_pressure', 'metrics', 'cycle', 'wellbeing', 'activity', 'nutrition', 'wearables'];

// Cómo comparten los pacientes: de "todo" a "nada", en proporciones razonables
const PRESETS: { scopes: string[]; state: ShareState; women?: boolean }[] = [
  { scopes: ['profile', 'lab_reports'], state: 'active' },
  { scopes: ['lab_reports'], state: 'active' },
  { scopes: ALL_SCOPES, state: 'active' },
  { scopes: ['profile', 'lab_reports', 'blood_pressure', 'glucose'], state: 'active' },
  { scopes: ['wearables', 'wellbeing', 'activity'], state: 'active' },
  { scopes: ['profile', 'lab_reports', 'cycle', 'wellbeing'], state: 'active', women: true },
  { scopes: ['profile', 'lab_reports', 'plan', 'nutrition'], state: 'active' },
  { scopes: [], state: 'none' }, // pidió cita o escribió, pero aún no ha compartido nada
  { scopes: [], state: 'expired' },
  { scopes: [], state: 'revoked' },
];

const GOALS = () => [t('More energy'), t('Sleep better'), t('Lose weight'), t('Keep a condition under control'), t('Perform better in sport')];

// Dudas de ejemplo (en español: así escribirán los pacientes)
const QUESTIONS = [
  'Me ha salido el colesterol LDL en 168. ¿Tengo que tomar algo o con dieta vale?',
  'Llevo dos meses con la regla muy abundante y me noto muy cansada. ¿Me hago una analítica?',
  'La TSH me ha salido en 5,2. ¿Es normal o es tiroides?',
  'Desde que entreno más duermo peor. ¿Puede ser el magnesio?',
  'La glucosa en ayunas me sale en 108 desde hace un mes. ¿Me preocupo?',
  'Tomo vitamina D desde marzo. ¿Cuándo vuelvo a medirla?',
  'Tengo la tensión en 138/88 casi todas las mañanas. ¿Qué hago?',
  'He dejado la píldora hace tres meses y aún no me ha vuelto la regla. ¿Es normal?',
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 9), (n * 7) % 60, 0, 0);
  return d.toISOString();
};

// Pacientes de ejemplo que se añaden a los 4 fijos para llegar a `total`
export function syntheticPatients(total: number): DemoPatient[] {
  const out: DemoPatient[] = [];
  for (let i = 0; i < Math.max(0, total - 4); i++) {
    const r = rng(1000 + i);
    const woman = r() < 0.55;
    const first = (woman ? WOMEN : MEN)[Math.floor(r() * 20)];
    const name = `${first} ${SURNAMES[Math.floor(r() * 20)]}`;
    let preset = PRESETS[i % PRESETS.length];
    if (preset.women && !woman) preset = PRESETS[0];
    const goals = GOALS();
    out.push({
      id: `ps-${i + 1}`,
      name,
      scopes: woman ? preset.scopes : preset.scopes.filter((x) => x !== 'cycle'),
      shareState: preset.state,
      shareUntil: preset.state === 'expired' || preset.state === 'revoked' ? daysAgo(3 + (i % 20)) : null,
      openRequests: 0,
      unreadMessages: 0,
      nextAppointment: null,
      appointmentToday: false,
      flaggedMarkers: 0,
      age: 22 + Math.floor(r() * 48),
      sex: woman ? t('Female') : t('Male'),
      goals: preset.scopes.includes('profile') ? [goals[Math.floor(r() * goals.length)]] : undefined,
      seed: 1000 + i,
    });
  }
  return out;
}

// Una duda abierta de cada tres pacientes de ejemplo (los que no han retirado el permiso)
export function syntheticRequests(patients: DemoPatient[], professionalId: string): ConsultRequest[] {
  return patients
    .filter((p, i) => i % 3 === 1 && p.shareState !== 'revoked')
    .map((p, i) => ({
      id: `sx-${p.id}`,
      patientId: p.id,
      patientName: p.name,
      professionalId,
      kind: 'question' as const,
      message: QUESTIONS[(p.seed + i) % QUESTIONS.length],
      status: 'open' as const,
      response: null,
      createdAt: daysAgo(i % 4),
      answeredAt: null,
    }));
}

// Resumen de ejemplo de cada dato compartido (lo que el médico ve de un vistazo en la ficha)
export function demoScopeSummary(p: DemoPatient, scope: string, flagged: number, labDate: string | null): string {
  const r = rng(p.seed * 31 + scope.length);
  const pick = (min: number, max: number) => Math.round(min + r() * (max - min));
  switch (scope) {
    case 'profile':
      return [p.age ? t('{n} years', { n: p.age }) : null, p.sex, p.goals?.length ? p.goals.join(', ') : null].filter(Boolean).join(' · ');
    case 'lab_reports':
      return labDate
        ? t('Blood test of {date} · {n} values out of range', { date: new Date(labDate).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }), n: flagged })
        : t('No blood test uploaded yet');
    case 'plan':
      return t('Active plan · {n} actions', { n: pick(3, 6) });
    case 'glucose':
      return t('Fasting glucose, 14-day average: {v} mg/dL ({n} readings)', { v: pick(86, 112), n: pick(6, 14) });
    case 'blood_pressure':
      return t('14-day average: {s}/{d} mmHg ({n} readings)', { s: pick(116, 142), d: pick(72, 92), n: pick(5, 14) });
    case 'metrics':
      return t('Home cholesterol test: LDL {v} mg/dL', { v: pick(95, 175) });
    case 'cycle':
      return t('Day {d} of the cycle · cycles of {len} days', { d: pick(2, 26), len: pick(26, 35) });
    case 'wellbeing':
      return t('Sleep {s}/5 · energy {e}/5 (last 14 days)', { s: pick(2, 5), e: pick(2, 5) });
    case 'activity':
      return t('{n} workouts in 30 days', { n: pick(2, 16) });
    case 'nutrition':
      return t('{n} meals logged this week', { n: pick(3, 18) });
    case 'wearables':
      return t('{steps} steps a day · {h} h of sleep', { steps: pick(4, 12) * 1000 - pick(0, 900), h: num((pick(55, 80) / 10).toFixed(1)) });
    default:
      return '';
  }
}
