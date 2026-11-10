import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { metasEs } from '@/i18n/metasEs';
import { workoutsEs } from '@/i18n/workoutsEs';
import { dietEs } from '@/i18n/dietEs';
import { historialEs } from '@/i18n/historialEs';
import { FEATURE_GUIDE } from '@/data/featureGuide';
import { LOCK_BG_NAME } from '@/logic/historial';

// Notas del fundador del 2026-11-06 (peso y Analíticas en Mis datos, la página de cada marcador, el plan del
// especialista, Descartar y borrar entrenos, Bloqueo): cada texto nuevo tiene su traducción.
// Igual que src/i18n/index.ts: es.ts gana a los demás
const ES: Record<string, string> = { ...workoutsEs, ...dietEs, ...metasEs, ...historialEs, ...es };

type Fs = { readFileSync: (p: string, enc: 'utf8') => string };
const FILES = [
  'src/screens/LabMarkerScreen.tsx',
  'src/screens/MyDataScreen.tsx',
  'src/screens/PlansScreen.tsx',
  'src/screens/ProgressScreen.tsx',
  'src/screens/UploadTestScreen.tsx',
  'src/components/LabValueRow.tsx',
  'src/components/LabValuesList.tsx',
  'src/components/OutOfRangeSummary.tsx',
  'src/screens/ReportMarkerDetailScreen.tsx',
  'src/screens/LabReportScreen.tsx',
  'src/screens/workouts/WorkoutHistoryScreen.tsx',
  'src/screens/workouts/WorkoutBuilderScreen.tsx',
  'src/screens/HistorialScreens.tsx',
  'src/components/historial/EmergencyCard.tsx',
  'src/screens/TodayScreen.tsx',
  'src/components/WelcomePrompts.tsx',
  // La gráfica de «Tus últimos días»
  'src/screens/DaysScreen.tsx',
  'src/components/DaysChart.tsx',
  // Modo gratis: el candado de Entrenamientos
  'src/components/FeatureGate.tsx',
  'src/screens/MoreScreen.tsx',
  // Entrenamientos con varias rutinas y sus días de la semana, la biblioteca y la tarjeta de cada programa
  'src/screens/workouts/CustomRoutineScreen.tsx',
  'src/screens/workouts/WorkoutsScreen.tsx',
  'src/screens/workouts/WorkoutSessionScreen.tsx',
  'src/components/workouts/ExerciseLibrary.tsx',
  'src/components/workouts/WorkoutModal.tsx',
  'src/logic/workoutWeek.ts',
  'src/data/workouts/labels.ts',
  'src/components/metas/MetaParts.tsx',
  // Cada ejercicio, cerrado en una línea y abierto serie a serie (Editar rutina y Ver las sesiones)
  'src/components/workouts/RoutineExerciseCard.tsx',
  // «Calorías y macros» de tu menú, con el panel del dietista
  'src/screens/diet/DietMacrosScreen.tsx',
  'src/components/diet/MacroTargetsPanel.tsx',
  'src/screens/diet/DietScreen.tsx',
  // El portal del dietista (el mismo panel, que siempre cuadra)
  'src/screens/pro/ProDietScreen.tsx',
];

const keysIn = (src: string) => {
  const found = new Set<string>();
  for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'\n])*)'/g)) found.add(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(/\bt\(\s*"((?:\\"|[^"\n])*)"/g)) found.add(m[1]);
  // t(x ? '…' : '…') en una línea, con una condición sin comillas
  for (const m of src.matchAll(/\bt\([ \t]*[\w.!?=<> \t]+\?[ \t]*'((?:\\'|[^'\n])*)'[ \t]*:[ \t]*'((?:\\'|[^'\n])*)'/g)) {
    found.add(m[1]);
    found.add(m[2]);
  }
  return found;
};

describe('Notas del 2026-11-06 en español', () => {
  it('cada t(«…») de las pantallas tocadas tiene su traducción', async () => {
    const fs = (await import('node:fs' as string)) as Fs;
    const missing: string[] = [];
    for (const f of FILES) for (const k of keysIn(fs.readFileSync(f, 'utf8'))) if (!(k in ES)) missing.push(`${f}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('la sección del plan y su guía, también', () => {
    const guide = FEATURE_GUIDE.plan;
    // appPrefs.ts (subtítulo de la sección) y WebShell.tsx (menú de la web) se pasan por t() al pintarse
    const texts = ['Your goals and targets, workouts, meal plan and your specialist’s plan', guide.what, guide.youDo, guide.youGet, 'Your goals', 'Lab tests'];
    // Los nombres de los fondos de Bloqueo (t(LOCK_BG_NAME[b]) en HistorialScreens.tsx)
    texts.push(...Object.values(LOCK_BG_NAME));
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });
});
