import { exerciseName, getExercise, equipmentLabel } from '@/data/workouts/catalog';
import { BLOCK_ORDER, blockLabel, doseText, levelLabel, placeLabel, programFacts, restText, sessionTitle, setText, setsText } from '@/data/workouts/labels';
import type { SetLog, WorkoutProgram } from '@/data/workouts/types';
import { dateLocale, getLang, num, t, tn } from '@/i18n';
import { isCustomProgram } from './customRoutine';
import { plannedSets } from './setPlan';
import { estimateMinutes } from './workoutGenerator';
import { byMonth, setsByExercise, workoutHistory, type HistoryEntry, type LoggedWorkout } from './workoutHistory';
import { workoutLabel } from './workoutSports';
import { daysText } from './workoutWeek';

// Exportar el entrenamiento (fundador, 2026-11-09: «exportar tanto el plan como el histórico… para compartirlo con
// el entrenador personal, un LLM…»): el programa con sus rutinas serie a serie y lo entrenado en un periodo, con un
// resumen por ejercicio. Sale como texto (Markdown sencillo, que una IA lee bien y se pega en cualquier chat) y como
// PDF con la marca (utils/workoutPdf.ts). Lógica pura; la pantalla es src/screens/workouts/WorkoutExportScreen.tsx.
// Todo en el idioma de la app. No lleva el nombre ni otros datos de la persona.

export type ExportPeriod = 1 | 3 | 6 | 'all';
export const EXPORT_PERIODS: { id: ExportPeriod; label: string }[] = [
  { id: 1, label: '1 month' },
  { id: 3, label: '3 months' },
  { id: 6, label: '6 months' },
  { id: 'all', label: 'All history' }, // «All» ya es «Todas» en es.ts
];

export interface ExportOptions {
  programId: string | null; // el programa del plan; null = sin plan
  period: ExportPeriod | null; // el historial; null = sin historial
  now?: Date;
}

export interface PlanItem {
  name: string;
  dose: string; // "3 × 8–10 · 20 kg"
  rest: string; // "descanso 90 s"
  perSet: string | null; // serie a serie, solo si no son todas iguales
  note: string | null;
}
export interface PlanRoutine {
  title: string;
  days: string; // "Lun, Jue" o ""
  minutes: number;
  blocks: { label: string; items: PlanItem[] }[];
}
export interface PlanPart {
  title: string;
  byline: string[];
  note: string | null;
  routines: PlanRoutine[];
}

export interface HistoryItem {
  when: string; // "Lun 3 nov, 18:30"
  title: string;
  program: string | null; // el programa, si no es el del plan
  minutes: number;
  facts: string[]; // "18 series", "4.320 kg" o la intensidad
  exercises: { name: string; sets: string }[];
}
export interface ProgressRow {
  name: string;
  sessions: number;
  first: string; // "16 kg × 10 (2 oct)"
  last: string;
  best: string;
}
export interface HistoryPart {
  period: string; // "últimos 3 meses"
  count: number;
  minutes: number;
  perWeek: string; // "1,8"
  volumeKg: number;
  months: { month: string; items: HistoryItem[] }[];
  progress: ProgressRow[];
}

export interface WorkoutExport {
  exportedAt: string;
  plan: PlanPart | null;
  history: HistoryPart | null;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (d: Date) => d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const whenText = (iso: string) => {
  const d = new Date(iso);
  return `${capital(d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }))}, ${d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}`;
};
const monthText = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return capital(new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }));
};
const kgTotal = (kg: number) => `${kg.toLocaleString(dateLocale())} kg`;
// Un ejercicio que ya no está en el catálogo sale con su id legible
const nameOf = (id: string) => exerciseName(getExercise(id)) || id.replace(/_/g, ' ');
// En los lastrados el peso es el lastre: «+10 kg × 6», como en la rutina (si no, una IA lo leería como el peso total)
const withPlus = (id: string, text: string) => (getExercise(id)?.load === 'added' ? text.replace(/(^|[^\d+.,])(\d+(?:[.,]\d+)?) kg/g, '$1+$2 kg') : text);

// El nombre de un entreno apuntado (su tipo o, con «Otro», su deporte): workoutLabel, en workoutSports.ts
const INTENSITY_LABEL: Record<LoggedWorkout['intensity'], string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

export const sourceLine = (p: Pick<WorkoutProgram, 'source' | 'professionalName'>) =>
  p.source === 'professional' ? t('From {name}', { name: p.professionalName || t('your specialist') }) : t('Made by you');

export const exportFileName = (now = new Date()) =>
  `Kuova-${getLang() === 'es' ? 'entrenamientos' : 'workouts'}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// ── El plan ──

export function planPart(p: WorkoutProgram): PlanPart {
  const own = isCustomProgram(p);
  const byline = [sourceLine(p), ...programFacts(p)];
  // Lo que se pidió al generador (en las rutinas hechas a mano no cuenta)
  if (!own) {
    byline.push(levelLabel(p.prefs.level), t('{m} min per session', { m: p.prefs.minutes }), placeLabel(p.prefs.place));
    if (p.prefs.place === 'home_kit' && p.prefs.equipment.length) byline.push(p.prefs.equipment.map(equipmentLabel).join(', '));
    if (p.prefs.lowImpact) byline.push(t('No jumping'));
  }
  const routines = p.sessions.map((s) => ({
    title: sessionTitle(s, own),
    days: daysText(s),
    minutes: estimateMinutes(s),
    blocks: BLOCK_ORDER.map((b) => ({
      label: blockLabel(b),
      items: s.exercises
        .filter((it) => it.block === b)
        .map((it) => {
          const sets = plannedSets(it);
          const differ = !!it.setPlan?.length && sets.some((x) => x.kg !== sets[0].kg || x.reps !== sets[0].reps);
          const plus = getExercise(it.exerciseId)?.load === 'added' ? '+' : '';
          return {
            name: nameOf(it.exerciseId),
            dose: doseText(it),
            rest: restText(it.restSec),
            perSet: differ ? sets.map((x) => `${x.kg ? `${plus}${num(x.kg)} kg × ` : '× '}${x.reps}`).join(' · ') : null,
            note: it.note?.trim() || null,
          };
        }),
    })).filter((b) => b.items.length),
  }));
  return { title: own ? p.title : t(p.title), byline, note: p.note?.trim() ? (own ? p.note.trim() : t(p.note.trim())) : null, routines };
}

// ── El historial ──

export function periodStart(period: ExportPeriod, entries: Pick<HistoryEntry, 'at'>[], now = new Date()): Date {
  if (period === 'all') {
    const first = entries.reduce((min, e) => Math.min(min, Date.parse(e.at)), now.getTime());
    return new Date(first);
  }
  const from = new Date(now);
  from.setMonth(from.getMonth() - period);
  return from;
}

const periodText = (period: ExportPeriod) =>
  period === 'all' ? t('all your history') : period === 1 ? t('last month') : t('last {n} months', { n: period });

// La serie con más peso (a igual peso, más repeticiones; sin peso, más repeticiones o más tiempo)
const heavier = (a: SetLog, b: SetLog) => (a.kg ?? 0) - (b.kg ?? 0) || (a.reps ?? 0) - (b.reps ?? 0) || (a.sec ?? 0) - (b.sec ?? 0);
const topSet = (sets: SetLog[]) => sets.reduce((best, s) => (heavier(s, best) > 0 ? s : best), sets[0]);

// Por ejercicio, la serie más pesada la primera y la última vez del periodo y la mejor de todas
export function progressRows(entries: HistoryEntry[]): ProgressRow[] {
  const rows = new Map<string, { sessions: number; first: { at: string; set: SetLog }; last: { at: string; set: SetLog }; best: { at: string; set: SetLog } }>();
  const oldestFirst = [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const e of oldestFirst) {
    if (e.kind !== 'session') continue;
    for (const g of setsByExercise(e.sets)) {
      const set = topSet(g.sets);
      const row = rows.get(g.exerciseId);
      if (!row) rows.set(g.exerciseId, { sessions: 1, first: { at: e.at, set }, last: { at: e.at, set }, best: { at: e.at, set } });
      else {
        row.sessions += 1;
        row.last = { at: e.at, set };
        if (heavier(set, row.best.set) > 0) row.best = { at: e.at, set };
      }
    }
  }
  return [...rows.entries()]
    .map(([id, r]) => {
      const text = (x: { at: string; set: SetLog }) => `${withPlus(id, setText(x.set))} (${shortDate(x.at)})`;
      return { name: nameOf(id), sessions: r.sessions, first: text(r.first), last: text(r.last), best: text(r.best) };
    })
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

export function historyPart(
  programs: Pick<WorkoutProgram, 'id' | 'title' | 'sessions' | 'completions' | 'prefs'>[],
  logged: LoggedWorkout[],
  period: ExportPeriod,
  planProgramId: string | null,
  now = new Date(),
): HistoryPart {
  const all = workoutHistory(programs, logged).filter((e) => Date.parse(e.at) <= now.getTime());
  const from = periodStart(period, all, now);
  const entries = all.filter((e) => Date.parse(e.at) >= from.getTime());
  // La media por semana, desde el primer entreno del periodo (si empezaste hace 5 semanas, «3 meses» no la baja)
  const since = entries.reduce((min, e) => Math.min(min, Date.parse(e.at)), now.getTime());
  const weeks = Math.max(1, (now.getTime() - since) / (7 * 864e5));
  const item = (e: HistoryEntry): HistoryItem => {
    if (e.kind === 'logged') {
      return { when: whenText(e.at), title: workoutLabel(e), program: null, minutes: e.minutes, facts: [t(INTENSITY_LABEL[e.intensity])], exercises: [] };
    }
    const p = programs.find((x) => x.id === e.programId);
    const own = !!p && isCustomProgram(p);
    return {
      when: whenText(e.at),
      title: e.session ? sessionTitle(e.session, own) : own ? e.programTitle : t(e.programTitle),
      program: e.programId !== planProgramId && e.session ? (own ? e.programTitle : t(e.programTitle)) : null,
      minutes: e.minutes,
      facts: [e.sets.length ? tn(e.sets.length, '{n} set', '{n} sets') : null, e.volumeKg ? kgTotal(e.volumeKg) : null].filter((x): x is string => !!x),
      exercises: setsByExercise(e.sets).map((g) => ({ name: nameOf(g.exerciseId), sets: withPlus(g.exerciseId, setsText(g.sets)) })),
    };
  };
  return {
    period: periodText(period),
    count: entries.length,
    minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    perWeek: num(Math.round((entries.length / weeks) * 10) / 10),
    volumeKg: entries.reduce((sum, e) => sum + (e.kind === 'session' ? e.volumeKg : 0), 0),
    months: byMonth(entries).map((m) => ({ month: monthText(m.month), items: m.entries.map(item) })),
    progress: progressRows(entries),
  };
}

export function buildWorkoutExport(programs: WorkoutProgram[], logged: LoggedWorkout[], o: ExportOptions): WorkoutExport {
  const now = o.now ?? new Date();
  const p = o.programId ? programs.find((x) => x.id === o.programId) : undefined;
  return {
    exportedAt: longDate(now),
    plan: p ? planPart(p) : null,
    history: o.period ? historyPart(programs, logged, o.period, p?.id ?? null, now) : null,
  };
}

// Las cifras del historial en una línea: "24 entrenos · 1.140 min · 1,8 por semana · 52.300 kg levantados"
export const historySummary = (h: HistoryPart) =>
  [
    tn(h.count, '{n} workout', '{n} workouts'),
    `${h.minutes.toLocaleString(dateLocale())} min`,
    t('{n} a week', { n: h.perWeek }),
    h.volumeKg ? t('{kg} lifted', { kg: kgTotal(h.volumeKg) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

// ── Como texto, para una IA o un mensaje ──

export function workoutExportText(doc: WorkoutExport): string {
  const out: string[] = [];
  out.push(`# ${t('Workouts · Kuova Health')}`);
  out.push(t('Exported on {date}.', { date: doc.exportedAt }) + ' ' + t('Weights in kg; «8–10» are reps; «30 s» and «0:30» are time; «+kg» is weight added to your body weight.'));

  if (doc.plan) {
    const p = doc.plan;
    out.push('', `## ${t('Plan: {name}', { name: p.title })}`, p.byline.join(' · '));
    if (p.note) out.push(t('Note from the trainer: «{note}»', { note: p.note }));
    for (const r of p.routines) {
      out.push('', `### ${r.title}${r.days ? ` (${r.days})` : ''} · ~${r.minutes} min`);
      if (!r.blocks.length) out.push(t('No exercises yet.'));
      for (const b of r.blocks) {
        out.push(`${b.label}:`);
        for (const it of b.items) {
          out.push(`- ${it.name}: ${[it.dose, it.rest].filter(Boolean).join(', ')}`);
          if (it.perSet) out.push(`  ${t('Set by set: {sets}', { sets: it.perSet })}`);
          if (it.note) out.push(`  ${t('Note: {note}', { note: it.note })}`);
        }
      }
    }
  }

  if (doc.history) {
    const h = doc.history;
    out.push('', `## ${t('History: {period}', { period: h.period })}`);
    if (!h.count) out.push(t('No workouts in this period.'));
    else {
      out.push(historySummary(h), t('Most recent first.'));
      for (const m of h.months) {
        out.push('', `### ${m.month}`);
        for (const e of m.items) {
          out.push(`- ${[e.when, e.title + (e.program ? ` (${e.program})` : ''), `${e.minutes} min`, ...e.facts].join(' · ')}`);
          for (const x of e.exercises) out.push(`  - ${x.name}: ${x.sets}`);
        }
      }
      if (h.progress.length) {
        out.push('', `## ${t('Progress by exercise')}`, t('Heaviest set the first and the last time in this period, and the best one.'));
        // Una sola vez: esa serie; si no, la primera → la última y la mejor si no es la última
        for (const r of h.progress) {
          const what = r.sessions === 1 ? r.last : `${r.first} → ${r.last}${r.best !== r.last ? ` · ${t('best {set}', { set: r.best })}` : ''}`;
          out.push(`- ${r.name} (${tn(r.sessions, '{n} session', '{n} sessions')}): ${what}`);
        }
      }
    }
  }
  out.push('', t('Exported from Kuova Health · kuovahealth.com'));
  return out.join('\n');
}
